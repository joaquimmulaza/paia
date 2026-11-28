-- F2 · Vender: o estudante pede uma loja, a administração decide e a loja
-- aprovada publica produtos.
-- A loja escreve-se só por RPCs SECURITY DEFINER (save_my_store,
-- submit_my_store e, na secção 4, admin_decide_store): o endereço, o estado e
-- o vínculo de estudante decidem-se no servidor. O cliente continua sem
-- grants de escrita em stores. Esta migração só acrescenta; as do F0 e do F1
-- ficam como estão.

-- ---------------------------------------------------------------------------
-- 1. Decisões da administração sobre lojas.
--    * Histórico só de acrescentar: uma linha por decisão (aprovar, recusar,
--      suspender, reativar), com a mensagem e a lista de verificação de A01.
--    * Fechada ao cliente: RLS ligada, sem políticas, e grants só para o
--      service_role. O vendedor lê as suas por get_my_store_decisions, que
--      nunca devolve admin_id.
--    * Uma recusa tem sempre mensagem (o vendedor precisa de saber o que
--      corrigir).
-- ---------------------------------------------------------------------------
create type public.store_decision as enum ('approved', 'rejected', 'suspended', 'reactivated');

create table public.store_decisions (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores (id) on delete restrict,
  admin_id uuid not null references auth.users (id) on delete restrict,
  decision public.store_decision not null,
  message text null
    check (message ~ '[^[:space:]]' and char_length(message) <= 500),
  checklist jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint store_decisions_rejection_has_message check (decision <> 'rejected' or message is not null)
);

-- A primeira coluna de cada índice é a da FK. O de store_id serve também a
-- leitura «mais recente primeiro» de get_my_store e get_my_store_decisions.
create index store_decisions_store_id_created_at_idx on public.store_decisions (store_id, created_at desc, id desc);
create index store_decisions_admin_id_idx on public.store_decisions (admin_id);

alter table public.store_decisions enable row level security;
revoke all on public.store_decisions from public, anon, authenticated;
grant select, insert on public.store_decisions to service_role;

-- ---------------------------------------------------------------------------
-- 2. Endereço da loja (slug), gerado a partir do nome.
--    * store_slug_base: minúsculas sem acentos; cada sequência que não seja
--      [a-z0-9] passa a «-»; sem hífenes nas pontas; no máximo 40
--      caracteres, sem hífen no fim depois do corte. Pode dar vazio.
--    * next_free_store_slug: o primeiro endereço livre para a loja
--      p_store_id (as outras lojas contam, a própria não). Base com menos de
--      3 caracteres: «loja-» mais 4 letras ao acaso. Senão: a base, depois
--      base-2, base-3, …, com a base cortada para caber nos 40.
--    * Quem chama next_free_store_slug toma antes o trinco de transação
--      pg_advisory_xact_lock(hashtext('public.stores:slug')): duas gravações
--      ao mesmo tempo com o mesmo nome não escolhem o mesmo endereço (a
--      segunda espera e vê o da primeira).
-- ---------------------------------------------------------------------------
-- IMMUTABLE por decisão, como public.search_key: o dicionário unaccent não
-- muda em produção.
create function private.store_slug_base(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select rtrim(
    left(
      btrim(
        regexp_replace(
          lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_name, ''))),
          '[^a-z0-9]+', '-', 'g'),
        '-'),
      40),
    '-');
$$;
revoke execute on function private.store_slug_base(text) from public, anon, authenticated;

create function private.next_free_store_slug(p_base text, p_store_id uuid)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_candidate text;
  v_suffix text;
  v_n integer := 2;
begin
  if char_length(coalesce(p_base, '')) < 3 then
    loop
      select 'loja-' || string_agg(chr(97 + floor(random() * 26)::integer), '')
        into v_candidate
        from generate_series(1, 4);
      exit when not exists (
        select 1 from public.stores s where s.slug = v_candidate and s.id is distinct from p_store_id);
    end loop;
    return v_candidate;
  end if;

  if not exists (select 1 from public.stores s where s.slug = p_base and s.id is distinct from p_store_id) then
    return p_base;
  end if;

  loop
    v_suffix := '-' || v_n;
    v_candidate := rtrim(left(p_base, 40 - char_length(v_suffix)), '-') || v_suffix;
    exit when not exists (
      select 1 from public.stores s where s.slug = v_candidate and s.id is distinct from p_store_id);
    v_n := v_n + 1;
  end loop;
  return v_candidate;
end;
$$;
revoke execute on function private.next_free_store_slug(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. A loja do vendedor: guardar o rascunho, enviar para análise e ler.
--    * SECURITY DEFINER, search_path vazio, executáveis só por
--      authenticated. A conta vem sempre de auth.uid(), nunca de um
--      parâmetro: cada conta só toca na sua loja (owner_id é único).
--    * Erros (P0001): NOT_AUTHENTICATED, NOT_STUDENT, INVALID_TEXT,
--      CATEGORY_NOT_FOUND, INVALID_PATH, STORE_LOCKED, NO_STORE,
--      STORE_INCOMPLETE e INVALID_TRANSITION. A entrada é validada antes da
--      escrita, para nenhum 23514 cru chegar ao cliente; o trigger de
--      normalização e os CHECKs do F1 ficam como última barreira.
-- ---------------------------------------------------------------------------

-- Conta autenticada e estudante. Devolve auth.uid().
create function private.require_student()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.affiliation = 'student') then
    raise exception using errcode = 'P0001', message = 'NOT_STUDENT';
  end if;
  return v_uid;
end;
$$;
revoke execute on function private.require_student() from public, anon, authenticated;

-- Cria a loja em draft (se a conta ainda não tem) ou altera-a. Devolve o id.
-- * Rascunho: só exige nome e categoria; a descrição pode ficar vazia e as
--   imagens nulas.
-- * Endereço: recalculado a partir do nome em draft e rejected; em approved
--   fica fixo, para não quebrar ligações partilhadas. pending_approval e
--   suspended dão STORE_LOCKED.
-- * O trinco do endereço é tomado antes de ler a loja, por isso duas
--   gravações da mesma conta também ficam em série (nunca duas lojas por
--   conta, nunca 23505 do owner_id nem do slug).
-- * Categoria: tem de existir e estar visível; a atual da loja continua
--   aceite mesmo que a administração a tenha escondido.
-- * Caminhos: stores/<id da loja>/logo-<uuid>.webp e
--   stores/<id da loja>/cover-<uuid>.webp, ou nulos.
create function public.save_my_store(
  p_name text,
  p_description text,
  p_category_id uuid,
  p_logo_path text,
  p_cover_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_student();
  v_name text := private.normalize_text(p_name);
  v_description text := coalesce(private.normalize_multiline(p_description), '');
  v_store public.stores;
  v_id uuid;
  v_slug text;
begin
  if v_name is null or v_name = '' or char_length(v_name) > 60 or v_name ~ '[[:cntrl:]]'
     or char_length(v_description) > 280 or translate(v_description, E'\n', '') ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'INVALID_TEXT';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.stores:slug'));

  select s.* into v_store from public.stores s where s.owner_id = v_uid for update;

  if found and v_store.status in ('pending_approval', 'suspended') then
    raise exception using errcode = 'P0001', message = 'STORE_LOCKED';
  end if;

  if not exists (
    select 1 from public.categories c
     where c.id = p_category_id and (c.is_visible or c.id = v_store.category_id)) then
    raise exception using errcode = 'P0001', message = 'CATEGORY_NOT_FOUND';
  end if;

  v_id := coalesce(v_store.id, gen_random_uuid());

  if (p_logo_path is not null
      and p_logo_path !~ ('^stores/' || v_id::text || '/logo-[0-9a-f-]{36}\.webp$'))
     or (p_cover_path is not null
      and p_cover_path !~ ('^stores/' || v_id::text || '/cover-[0-9a-f-]{36}\.webp$')) then
    raise exception using errcode = 'P0001', message = 'INVALID_PATH';
  end if;

  if v_store.id is null then
    v_slug := private.next_free_store_slug(private.store_slug_base(v_name), v_id);
    insert into public.stores (id, owner_id, name, slug, description, category_id, logo_path, cover_path)
    values (v_id, v_uid, v_name, v_slug, v_description, p_category_id, p_logo_path, p_cover_path);
  else
    if v_store.status = 'approved' then
      v_slug := v_store.slug;
    else
      v_slug := private.next_free_store_slug(private.store_slug_base(v_name), v_id);
    end if;
    update public.stores s
       set name = v_name,
           slug = v_slug,
           description = v_description,
           category_id = p_category_id,
           logo_path = p_logo_path,
           cover_path = p_cover_path
     where s.id = v_id;
  end if;

  return v_id;
end;
$$;
revoke execute on function public.save_my_store(text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.save_my_store(text, text, uuid, text, text) to authenticated;

-- Envia a loja para análise. Devolve o estado em que fica.
-- * draft ou rejected passam a pending_approval, com submitted_at = now() e
--   a decisão anterior limpa (decided_at, decided_by).
-- * Idempotente: em pending_approval devolve pending_approval sem escrever.
-- * approved e suspended dão INVALID_TRANSITION.
-- * Exige descrição não vazia e logótipo (STORE_INCOMPLETE); o nome e a
--   categoria já são not null.
create function public.submit_my_store()
returns public.store_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_student();
  v_store public.stores;
begin
  select s.* into v_store from public.stores s where s.owner_id = v_uid for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NO_STORE';
  end if;

  if v_store.status = 'pending_approval' then
    return v_store.status;
  end if;
  if v_store.status not in ('draft', 'rejected') then
    raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION';
  end if;
  if v_store.description = '' or v_store.logo_path is null then
    raise exception using errcode = 'P0001', message = 'STORE_INCOMPLETE';
  end if;

  update public.stores s
     set status = 'pending_approval',
         submitted_at = now(),
         decided_at = null,
         decided_by = null
   where s.id = v_store.id;

  return 'pending_approval';
end;
$$;
revoke execute on function public.submit_my_store() from public, anon, authenticated;
grant execute on function public.submit_my_store() to authenticated;

-- A loja da conta, em qualquer estado, com os contadores do painel e a
-- mensagem da decisão mais recente. Zero linhas se a conta não tem loja.
-- Nunca devolve owner_id, decided_by nem nada de store_decisions além da
-- mensagem.
-- * hidden_products_count: produtos com is_published = false.
-- * sold_out_products_count: publicados com stock 0.
create function public.get_my_store()
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  category_id uuid,
  logo_path text,
  cover_path text,
  status public.store_status,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz,
  published_products_count integer,
  hidden_products_count integer,
  sold_out_products_count integer,
  last_message text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.slug, s.description, s.category_id, s.logo_path, s.cover_path,
         s.status, s.submitted_at, s.decided_at, s.created_at,
         s.published_products_count,
         (select count(*)::integer from public.products p where p.store_id = s.id and not p.is_published),
         (select count(*)::integer from public.products p where p.store_id = s.id and p.is_published and p.stock = 0),
         (select d.message from public.store_decisions d
           where d.store_id = s.id
           order by d.created_at desc, d.id desc
           limit 1)
    from public.stores s
   where s.owner_id = (select auth.uid());
$$;
revoke execute on function public.get_my_store() from public, anon, authenticated;
grant execute on function public.get_my_store() to authenticated;

-- As decisões sobre a loja da conta, da mais recente para a mais antiga.
-- Sem admin_id nem checklist.
create function public.get_my_store_decisions()
returns table (
  decision public.store_decision,
  message text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.decision, d.message, d.created_at
    from public.store_decisions d
    join public.stores s on s.id = d.store_id
   where s.owner_id = (select auth.uid())
   order by d.created_at desc, d.id desc;
$$;
revoke execute on function public.get_my_store_decisions() from public, anon, authenticated;
grant execute on function public.get_my_store_decisions() to authenticated;
