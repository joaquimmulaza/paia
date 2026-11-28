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
-- O service_role recebe ALL pelos privilégios por omissão do Supabase: tira-se
-- tudo e dá-se só ler e acrescentar (o histórico nunca se altera nem apaga).
revoke all on public.store_decisions from service_role;
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
-- * Aprovada: a descrição continua não vazia e o logótipo não nulo
--   (STORE_INCOMPLETE), como no envio.
-- * Endereço: em draft e rejected, recalculado quando o endereço-base do nome
--   novo difere do do nome atual; senão fica o atual. Em approved fica fixo,
--   para não quebrar ligações partilhadas. pending_approval e
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

  -- A garantia do endereço livre conta com READ COMMITTED: depois do trinco,
  -- cada instrução tira um snapshot novo e vê o endereço gravado por quem o
  -- largou.
  perform pg_advisory_xact_lock(hashtext('public.stores:slug'));

  select s.* into v_store from public.stores s where s.owner_id = v_uid for update;

  if found and v_store.status in ('pending_approval', 'suspended') then
    raise exception using errcode = 'P0001', message = 'STORE_LOCKED';
  end if;

  -- Aprovada, a loja está à vista: não perde o que o envio exigiu.
  if v_store.status = 'approved' and (v_description = '' or p_logo_path is null) then
    raise exception using errcode = 'P0001', message = 'STORE_INCOMPLETE';
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
    -- Aprovada, ou com o mesmo endereço-base: o endereço atual fica (não
    -- troca de loja-xxxx nem de sufixo -n a cada gravação).
    if v_store.status = 'approved'
       or private.store_slug_base(v_name) = private.store_slug_base(v_store.name) then
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

-- ---------------------------------------------------------------------------
-- 4. Decisão da administração sobre as candidaturas (A01).
--    * Todas SECURITY DEFINER, search_path vazio, executáveis só por
--      authenticated, e começam por verificar private.is_admin()
--      (NOT_ALLOWED), como as do F1.
--    * Erros (P0001): NOT_ALLOWED, NOT_FOUND, INVALID_DECISION,
--      MESSAGE_REQUIRED, INVALID_TEXT, INVALID_CHECKLIST, ALREADY_DECIDED
--      (com o estado atual em detail), INVALID_STATUS e INVALID_CURSOR. A entrada é validada
--      antes de qualquer trinco ou escrita.
--    * A administração vê do dono só o nome, o vínculo e a data de criação
--      da conta.
--    * Sem notificações no F2: o vendedor vê a resposta em get_my_store.
-- ---------------------------------------------------------------------------

-- Aprova ou recusa uma candidatura pendente. Devolve o estado em que fica.
-- * Só approved e rejected (INVALID_DECISION); suspender e reativar são de
--   outra fase.
-- * Mensagem: normalizada com private.normalize_multiline; vazia ou só com
--   espaços fica nula; até 500 caracteres, sem caracteres de controlo além
--   de \n (INVALID_TEXT). A recusa exige mensagem (MESSAGE_REQUIRED).
-- * checklist: objeto com chaves só de name_description, allowed, images e
--   account, e valores booleanos; pode vir incompleto; nulo vale {}.
-- * Concorrência: a linha da loja fica FOR UPDATE antes de ler o estado.
--   Dois admins ao mesmo tempo: o segundo espera, relê a linha já decidida e
--   recebe ALREADY_DECIDED, sem escrever. Por isso há uma só decisão por
--   envio. Não há trinco de transação aqui; se um dia houver, é tomado antes
--   do trinco da linha, como em save_my_store.
-- * Ecrã desatualizado: p_expected_submitted_at é o submitted_at que o A01
--   mostrou. Se a loja foi entretanto decidida e reenviada, o submitted_at
--   da linha já é outro e a decisão dá ALREADY_DECIDED (detail = estado
--   atual), como se outra pessoa da equipa tivesse decidido.
-- * Um admin não decide a sua própria loja (NOT_ALLOWED).
-- * Defesa em profundidade: o UPDATE só toca numa linha ainda em
--   pending_approval; se não tocar em nenhuma, dá ALREADY_DECIDED.
create function public.admin_decide_store(
  p_store_id uuid,
  p_decision public.store_decision,
  p_message text,
  p_checklist jsonb,
  p_expected_submitted_at timestamptz
)
returns public.store_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_message text := private.normalize_multiline(p_message);
  v_checklist jsonb := coalesce(p_checklist, '{}'::jsonb);
  v_status public.store_status;
  v_submitted_at timestamptz;
  v_owner_id uuid;
  v_new_status public.store_status;
  v_rows integer;
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception using errcode = 'P0001', message = 'INVALID_DECISION';
  end if;

  if v_message !~ '[^[:space:]]' then
    v_message := null;
  end if;
  if char_length(v_message) > 500 or translate(v_message, E'\n', '') ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'INVALID_TEXT';
  end if;
  if p_decision = 'rejected' and v_message is null then
    raise exception using errcode = 'P0001', message = 'MESSAGE_REQUIRED';
  end if;

  if jsonb_typeof(v_checklist) <> 'object'
     or exists (
       select 1 from jsonb_each(v_checklist) e
        where e.key not in ('name_description', 'allowed', 'images', 'account')
           or jsonb_typeof(e.value) <> 'boolean') then
    raise exception using errcode = 'P0001', message = 'INVALID_CHECKLIST';
  end if;

  select s.status, s.submitted_at, s.owner_id into v_status, v_submitted_at, v_owner_id
    from public.stores s
   where s.id = p_store_id
     for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_owner_id = v_uid then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;
  if v_status <> 'pending_approval' or v_submitted_at is distinct from p_expected_submitted_at then
    raise exception using errcode = 'P0001', message = 'ALREADY_DECIDED', detail = v_status::text;
  end if;

  v_new_status := p_decision::text::public.store_status;

  update public.stores s
     set status = v_new_status,
         decided_at = now(),
         decided_by = v_uid
   where s.id = p_store_id and s.status = 'pending_approval';
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception using errcode = 'P0001', message = 'ALREADY_DECIDED', detail = v_status::text;
  end if;

  insert into public.store_decisions (store_id, admin_id, decision, message, checklist)
  values (p_store_id, v_uid, p_decision, v_message, v_checklist);

  return v_new_status;
end;
$$;
revoke execute on function public.admin_decide_store(uuid, public.store_decision, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.admin_decide_store(uuid, public.store_decision, text, jsonb, timestamptz) to authenticated;

-- Candidaturas num estado, com paginação por cursor.
-- * pending_approval: (submitted_at, id) asc, a mais antiga primeiro; a
--   página seguinte é (submitted_at, id) > cursor.
-- * Outros estados: (decided_at, id) desc, a decisão mais recente primeiro;
--   a página seguinte é (decided_at, id) < cursor.
-- * draft não é candidatura: dá INVALID_STATUS.
-- * O cursor tem as duas partes ou nenhuma (INVALID_CURSOR). p_limit fica
--   entre 1 e 50 (20 por omissão), como em search_products.
create function public.admin_list_store_applications(
  p_status public.store_status,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  slug text,
  category_name text,
  logo_path text,
  owner_name text,
  owner_affiliation public.affiliation,
  submitted_at timestamptz,
  decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;

  if p_status = 'draft' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS';
  end if;

  if (p_cursor_at is null) <> (p_cursor_id is null) then
    raise exception using errcode = 'P0001', message = 'INVALID_CURSOR';
  end if;

  if p_status = 'pending_approval' then
    return query
      select s.id, s.name, s.slug, c.name, s.logo_path, p.full_name, p.affiliation, s.submitted_at, s.decided_at
        from public.stores s
        join public.profiles p on p.id = s.owner_id
        left join public.categories c on c.id = s.category_id
       where s.status = p_status
         and (p_cursor_at is null or (s.submitted_at, s.id) > (p_cursor_at, p_cursor_id))
       order by s.submitted_at asc, s.id asc
       limit v_limit;
  else
    return query
      select s.id, s.name, s.slug, c.name, s.logo_path, p.full_name, p.affiliation, s.submitted_at, s.decided_at
        from public.stores s
        join public.profiles p on p.id = s.owner_id
        left join public.categories c on c.id = s.category_id
       where s.status = p_status
         and (p_cursor_at is null or (s.decided_at, s.id) < (p_cursor_at, p_cursor_id))
       order by s.decided_at desc, s.id desc
       limit v_limit;
  end if;
end;
$$;
revoke execute on function public.admin_list_store_applications(public.store_status, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.admin_list_store_applications(public.store_status, timestamptz, uuid, integer)
  to authenticated;

-- Uma candidatura, em qualquer estado. Zero linhas se a loja não existe.
create function public.admin_get_store_application(p_store_id uuid)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  category_name text,
  logo_path text,
  cover_path text,
  status public.store_status,
  submitted_at timestamptz,
  owner_name text,
  owner_affiliation public.affiliation,
  owner_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;

  return query
    select s.id, s.name, s.slug, s.description, c.name, s.logo_path, s.cover_path, s.status, s.submitted_at,
           p.full_name, p.affiliation, p.created_at
      from public.stores s
      join public.profiles p on p.id = s.owner_id
      left join public.categories c on c.id = s.category_id
     where s.id = p_store_id;
end;
$$;
revoke execute on function public.admin_get_store_application(uuid) from public, anon, authenticated;
grant execute on function public.admin_get_store_application(uuid) to authenticated;

-- As decisões sobre uma loja, da mais recente para a mais antiga, com o nome
-- de quem decidiu (só a administração o vê).
create function public.admin_list_store_decisions(p_store_id uuid)
returns table (
  decision public.store_decision,
  message text,
  checklist jsonb,
  admin_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;

  return query
    select d.decision, d.message, d.checklist, p.full_name, d.created_at
      from public.store_decisions d
      left join public.profiles p on p.id = d.admin_id
     where d.store_id = p_store_id
     order by d.created_at desc, d.id desc;
end;
$$;
revoke execute on function public.admin_list_store_decisions(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_store_decisions(uuid) to authenticated;

-- Número de candidaturas à espera de decisão (o contador do painel).
create function public.admin_count_pending_stores()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;

  return (select count(*)::integer from public.stores s where s.status = 'pending_approval');
end;
$$;
revoke execute on function public.admin_count_pending_stores() from public, anon, authenticated;
grant execute on function public.admin_count_pending_stores() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Produtos e fotos do vendedor: políticas e grants.
--    * O dono escreve os produtos e as fotos da sua loja diretamente nas
--      tabelas (sem RPC), com RLS e grants por coluna. Ler: em qualquer
--      estado da loja (owns_store). Escrever: só com a loja approved
--      (owns_approved_store).
--    * As políticas do dono não dependem das RLS de stores (o dono de uma
--      loja em draft não vê a sua loja por elas): usam os ajudantes
--      SECURITY DEFINER abaixo, que estão em public porque authenticated não
--      tem USAGE em private.
--    * As políticas públicas do F1 ficam como estão; as do dono só
--      acrescentam as linhas da própria loja, e só para authenticated.
--    * moderation_status e moderation_reason são da administração: ficam
--      fora dos grants de escrita (42501). store_id não se altera (nem grant
--      nem o trigger prevent_product_store_change do F1).
-- ---------------------------------------------------------------------------

-- A conta autenticada é dona da loja p_store_id (em qualquer estado).
create function public.owns_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
     where s.id = p_store_id and s.owner_id = (select auth.uid()));
$$;
revoke execute on function public.owns_store(uuid) from public, anon, authenticated;
grant execute on function public.owns_store(uuid) to authenticated;

-- A conta autenticada é dona da loja p_store_id e a loja está approved.
create function public.owns_approved_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
     where s.id = p_store_id and s.owner_id = (select auth.uid()) and s.status = 'approved');
$$;
revoke execute on function public.owns_approved_store(uuid) from public, anon, authenticated;
grant execute on function public.owns_approved_store(uuid) to authenticated;

create policy products_select_owner on public.products
  for select to authenticated
  using (public.owns_store(store_id));

create policy products_insert_owner on public.products
  for insert to authenticated
  with check (public.owns_approved_store(store_id));

create policy products_update_owner on public.products
  for update to authenticated
  using (public.owns_approved_store(store_id))
  with check (public.owns_approved_store(store_id));

create policy products_delete_owner on public.products
  for delete to authenticated
  using (public.owns_approved_store(store_id));

-- A subconsulta em products passa pelas RLS de products, onde o dono vê os
-- seus produtos por products_select_owner.
create policy product_images_select_owner on public.product_images
  for select to authenticated
  using (exists (
    select 1 from public.products p
     where p.id = product_images.product_id and public.owns_store(p.store_id)));

create policy product_images_insert_owner on public.product_images
  for insert to authenticated
  with check (exists (
    select 1 from public.products p
     where p.id = product_images.product_id and public.owns_approved_store(p.store_id)));

create policy product_images_update_owner on public.product_images
  for update to authenticated
  using (exists (
    select 1 from public.products p
     where p.id = product_images.product_id and public.owns_approved_store(p.store_id)))
  with check (exists (
    select 1 from public.products p
     where p.id = product_images.product_id and public.owns_approved_store(p.store_id)));

create policy product_images_delete_owner on public.product_images
  for delete to authenticated
  using (exists (
    select 1 from public.products p
     where p.id = product_images.product_id and public.owns_approved_store(p.store_id)));

-- As colunas a mais que authenticated lê só valem nas linhas que as RLS lhe
-- mostram: as públicas (publicadas e visíveis, sem motivo de moderação) e as
-- da própria loja. anon continua sem elas.
grant select (is_published, moderation_status, moderation_reason, updated_at) on public.products to authenticated;
grant insert (store_id, category_id, name, description, price_kz, stock, is_published) on public.products to authenticated;
grant update (category_id, name, description, price_kz, stock, is_published) on public.products to authenticated;
grant delete on public.products to authenticated;
grant insert (product_id, path, position) on public.product_images to authenticated;
grant update (position) on public.product_images to authenticated;
grant delete on public.product_images to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Regras das fotos.
--    * Um produto publicado tem sempre pelo menos uma foto (PHOTO_REQUIRED):
--      não se publica sem foto e não se apaga a última foto de um publicado.
--      Apagar o produto inteiro apaga as fotos em cascata.
--    * O caminho de cada foto é products/<loja>/<produto>/<uuid>.webp
--      (INVALID_PATH), o mesmo que can_write_media aceita no Storage.
--    * As regras valem para o cliente (authenticated). Os papéis de
--      manutenção (postgres, supabase_admin, service_role) ficam de fora: o
--      seed e os testes do F1 têm produtos publicados sem fotos e caminhos
--      antigos, e a administração (F4) precisa de corrigir dados. As cascatas
--      das FKs correm como dono da tabela (postgres) e passam também.
--    * Os triggers são SECURITY INVOKER (current_user é o papel de quem
--      escreve) e não chamam nada em private (authenticated não tem USAGE).
--      Como authenticated, leem pelas RLS do dono, que vê tudo o que é da sua
--      loja.
--    * Concorrência: publicar (UPDATE da linha do produto) e apagar uma foto
--      (FOR NO KEY UPDATE na linha do produto) ficam em série. Quem espera
--      volta a contar as fotos com um snapshot novo (READ COMMITTED).
--    * A categoria de um produto do dono tem de estar visível ao criar e ao
--      mudar de categoria (CATEGORY_NOT_FOUND).
--    * set_product_image_order troca as posições numa só transação, com a
--      unique (product_id, position) adiada até ao fim da troca.
-- ---------------------------------------------------------------------------

-- A unique de F1 passa a deferrable initially immediate (o mesmo nome, o
-- mesmo índice): imediata como antes, adiável só por set_product_image_order.
-- Tabela pequena; o índice é reconstruído dentro da migração.
alter table public.product_images drop constraint product_images_product_id_position_key;
alter table public.product_images
  add constraint product_images_product_id_position_key unique (product_id, position) deferrable initially immediate;

create function private.enforce_product_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_published
     and (tg_op = 'INSERT' or not old.is_published)
     and current_user not in ('postgres', 'supabase_admin', 'service_role')
     and not exists (select 1 from public.product_images i where i.product_id = new.id) then
    raise exception using errcode = 'P0001', message = 'PHOTO_REQUIRED';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_product_photos() from public, anon, authenticated;

create trigger enforce_product_photos
  before insert or update of is_published on public.products
  for each row execute function private.enforce_product_photos();

-- A categoria de um produto escrito pelo dono tem de estar visível
-- (CATEGORY_NOT_FOUND): ao criar, sempre; ao alterar, só quando category_id
-- muda (o produto mantém uma categoria que a administração escondeu depois,
-- como save_my_store). Mesma isenção de papéis que as regras das fotos.
-- Como authenticated, a RLS categories_select_visible só mostra as visíveis
-- (e is_visible nem tem grant), por isso basta procurar o id.
create function private.check_product_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)
     and not exists (select 1 from public.categories c where c.id = new.category_id) then
    raise exception using errcode = 'P0001', message = 'CATEGORY_NOT_FOUND';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_product_category() from public, anon, authenticated;

create trigger check_product_category
  before insert or update of category_id on public.products
  for each row execute function private.check_product_category();

create function private.keep_last_photo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_published boolean;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return old;
  end if;

  -- O produto já não está visível: é uma cascata do DELETE do produto.
  select p.is_published into v_published
    from public.products p
   where p.id = old.product_id
     for no key update;
  if not found then
    return old;
  end if;

  if v_published and not exists (
       select 1 from public.product_images i
        where i.product_id = old.product_id and i.id <> old.id) then
    raise exception using errcode = 'P0001', message = 'PHOTO_REQUIRED';
  end if;
  return old;
end;
$$;
revoke execute on function private.keep_last_photo() from public, anon, authenticated;

create trigger keep_last_photo
  before delete on public.product_images
  for each row execute function private.keep_last_photo();

create function private.check_product_image_path()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_store_id uuid;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  select p.store_id into v_store_id from public.products p where p.id = new.product_id;
  if v_store_id is null
     or new.path !~ ('^products/' || v_store_id::text || '/' || new.product_id::text || '/[0-9a-f-]{36}\.webp$') then
    raise exception using errcode = 'P0001', message = 'INVALID_PATH';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_product_image_path() from public, anon, authenticated;

create trigger check_product_image_path
  before insert on public.product_images
  for each row execute function private.check_product_image_path();

-- Nova ordem das fotos de um produto: p_image_ids[1] fica na posição 0, e
-- assim por diante.
-- * Só o dono de uma loja approved (NOT_ALLOWED; um produto que não existe
--   dá o mesmo, para não revelar ids).
-- * p_image_ids tem de ser exatamente as imagens do produto, cada uma uma
--   vez (INVALID_ORDER).
-- * A linha do produto fica FOR NO KEY UPDATE: duas ordenações, ou uma
--   ordenação e uma foto apagada, ficam em série.
create function public.set_product_image_order(p_product_id uuid, p_image_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
begin
  select p.store_id into v_store_id
    from public.products p
   where p.id = p_product_id
     for no key update;
  if not coalesce(public.owns_approved_store(v_store_id), false) then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;

  if p_image_ids is null
     or array_position(p_image_ids, null) is not null
     or cardinality(p_image_ids) <> (select count(distinct x) from unnest(p_image_ids) as x)
     or cardinality(p_image_ids) <> (select count(*) from public.product_images i where i.product_id = p_product_id)
     or exists (
       select 1 from unnest(p_image_ids) as x
        where not exists (select 1 from public.product_images i where i.id = x and i.product_id = p_product_id)) then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER';
  end if;

  set constraints public.product_images_product_id_position_key deferred;
  update public.product_images i
     set position = (o.ord - 1)::smallint
    from unnest(p_image_ids) with ordinality as o (id, ord)
   where i.id = o.id and i.position <> (o.ord - 1)::smallint;
  set constraints public.product_images_product_id_position_key immediate;
end;
$$;
revoke execute on function public.set_product_image_order(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.set_product_image_order(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Storage: o dono escreve e apaga os ficheiros da sua loja.
--    * can_write_media decide pelo caminho; nunca lança erro (cada segmento é
--      verificado com uma expressão regular antes do cast para uuid). Um
--      «../» ou outra extensão não casam e dão false.
--      - store-media: stores/<loja>/(logo|cover)-<uuid>.webp, com a loja do
--        chamador em draft, rejected ou approved (não em pending_approval nem
--        suspended, como save_my_store);
--      - product-media: products/<loja>/<produto>/<uuid>.webp, com a loja do
--        chamador approved e o produto dessa loja.
--    * Políticas para authenticated: INSERT e DELETE, e SELECT com a mesma
--      regra, porque um DELETE com WHERE (e o da Storage API, com RETURNING)
--      só vê as linhas que uma política de SELECT deixa ver. A leitura
--      pública dos ficheiros vem dos buckets públicos, não desta política.
--    * Sem UPDATE: o cliente envia com upsert false e um nome novo de cada
--      vez. Apagar ficheiros pela administração fica para F4.
-- ---------------------------------------------------------------------------
create function public.can_write_media(p_bucket text, p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_uuid constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  v_parts text[];
begin
  if v_uid is null or p_bucket is null or p_name is null then
    return false;
  end if;

  if p_bucket = 'store-media' then
    v_parts := regexp_match(p_name, '^stores/(' || v_uuid || ')/(?:logo|cover)-' || v_uuid || '\.webp$');
    if v_parts is null then
      return false;
    end if;
    return exists (
      select 1 from public.stores s
       where s.id = v_parts[1]::uuid and s.owner_id = v_uid and s.status in ('draft', 'rejected', 'approved'));
  end if;

  if p_bucket = 'product-media' then
    v_parts := regexp_match(p_name, '^products/(' || v_uuid || ')/(' || v_uuid || ')/' || v_uuid || '\.webp$');
    if v_parts is null then
      return false;
    end if;
    return exists (
      select 1 from public.products p
        join public.stores s on s.id = p.store_id
       where s.id = v_parts[1]::uuid and p.id = v_parts[2]::uuid
         and s.owner_id = v_uid and s.status = 'approved');
  end if;

  return false;
end;
$$;
revoke execute on function public.can_write_media(text, text) from public, anon, authenticated;
grant execute on function public.can_write_media(text, text) to authenticated;

create policy media_insert_owner on storage.objects
  for insert to authenticated
  with check (bucket_id in ('store-media', 'product-media') and public.can_write_media(bucket_id, name));

create policy media_select_owner on storage.objects
  for select to authenticated
  using (bucket_id in ('store-media', 'product-media') and public.can_write_media(bucket_id, name));

create policy media_delete_owner on storage.objects
  for delete to authenticated
  using (bucket_id in ('store-media', 'product-media') and public.can_write_media(bucket_id, name));

-- ---------------------------------------------------------------------------
-- 8. O catálogo público continua só com produtos à venda.
--    * search_products, get_product e get_store (F1) são SECURITY INVOKER e
--      a visibilidade vinha só das RLS. Com products_select_owner, o dono de
--      uma loja aprovada passava a ver nelas os seus produtos por publicar e
--      os ocultados pela moderação (e as categorias deles nos filtros de
--      get_store).
--    * As três passam a filtrar por public.is_listed_product: o mesmo
--      predicado de products_select_public (publicado, visível e de uma loja
--      approved), lido como definer, porque anon não tem grant em
--      is_published nem em moderation_status.
--    * create or replace com as mesmas assinaturas, o mesmo modo (SECURITY
--      INVOKER) e os mesmos grants; o corpo é o do F1 mais esse filtro.
--    * list_stores e list_featured_stores não mudam: só leem
--      stores.published_products_count, que o trigger do F1 mantém com
--      produtos publicados e visíveis.
-- ---------------------------------------------------------------------------

-- O produto p_id está à venda no catálogo público. Uma busca pela chave
-- primária; não revela nada que a leitura pública não mostre.
create function public.is_listed_product(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.products p
      join public.stores s on s.id = p.store_id
     where p.id = p_id and p.is_published and p.moderation_status = 'visible' and s.status = 'approved');
$$;
revoke execute on function public.is_listed_product(uuid) from public, anon, authenticated;
grant execute on function public.is_listed_product(uuid) to anon, authenticated;

create or replace function public.search_products(
  p_q text default null,
  p_category_slug text default null,
  p_store_slug text default null,
  p_sort text default 'recentes',
  p_after_created_at timestamptz default null,
  p_after_price integer default null,
  p_after_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  price_kz integer,
  stock integer,
  created_at timestamptz,
  store_name text,
  store_slug text,
  category_slug text,
  main_image_path text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_sort text := coalesce(p_sort, 'recentes');
  v_q text := public.search_key(left(p_q, 80));
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
  v_min_id constant uuid := '00000000-0000-0000-0000-000000000000';
  v_max_id constant uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_cursor text;
  v_order text;
begin
  if v_sort = 'recentes' then
    if (p_after_created_at is null) <> (p_after_id is null) then
      raise exception using errcode = 'P0001', message = 'INVALID_CURSOR';
    end if;
    v_cursor := $c$(p.created_at, p.id) < (coalesce($5, 'infinity'::timestamptz), coalesce($7, $9))$c$;
    v_order := 'p.created_at desc, p.id desc';
  elsif v_sort = 'preco-asc' then
    if (p_after_price is null) <> (p_after_id is null) then
      raise exception using errcode = 'P0001', message = 'INVALID_CURSOR';
    end if;
    v_cursor := '(p.price_kz, p.id) > (coalesce($6, 0), coalesce($7, $8))';
    v_order := 'p.price_kz asc, p.id asc';
  elsif v_sort = 'preco-desc' then
    if (p_after_price is null) <> (p_after_id is null) then
      raise exception using errcode = 'P0001', message = 'INVALID_CURSOR';
    end if;
    v_cursor := '(p.price_kz, p.id) < (coalesce($6, 2147483647), coalesce($7, $9))';
    v_order := 'p.price_kz desc, p.id desc';
  else
    raise exception using errcode = 'P0001', message = 'INVALID_SORT';
  end if;

  return query execute
    $q$select p.id, p.name, p.price_kz, p.stock, p.created_at, s.name, s.slug, c.slug,
              (select i.path from public.product_images i where i.product_id = p.id and i.position = 0)
         from public.products p
         join public.stores s on s.id = p.store_id
         left join public.categories c on c.id = p.category_id
        where $q$ || v_cursor || $q$
          and public.is_listed_product(p.id)
          and ($2::text is null or p.category_id = (select c2.id from public.categories c2 where c2.slug = $2))
          and ($3::text is null or p.store_id = (select s2.id from public.stores s2 where s2.slug = $3))
          and ($1 = '' or position($1 in public.search_key(p.name)) > 0)
        order by $q$ || v_order || $q$
        limit $4$q$
    using v_q, p_category_slug, p_store_slug, v_limit,
          p_after_created_at, p_after_price, p_after_id, v_min_id, v_max_id;
end;
$$;
revoke execute on function public.search_products(text, text, text, text, timestamptz, integer, uuid, integer) from public;
grant execute on function public.search_products(text, text, text, text, timestamptz, integer, uuid, integer)
  to anon, authenticated;

create or replace function public.get_product(p_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  price_kz integer,
  stock integer,
  created_at timestamptz,
  category_name text,
  category_slug text,
  store_name text,
  store_slug text,
  store_rating_avg numeric,
  store_rating_count integer,
  images jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.name, p.description, p.price_kz, p.stock, p.created_at,
         c.name, c.slug, s.name, s.slug, s.rating_avg, s.rating_count,
         coalesce(
           (select jsonb_agg(jsonb_build_object('path', i.path, 'position', i.position) order by i.position)
              from public.product_images i
             where i.product_id = p.id),
           '[]'::jsonb)
    from public.products p
    join public.stores s on s.id = p.store_id
    left join public.categories c on c.id = p.category_id
   where p.id = p_id and public.is_listed_product(p.id);
$$;
revoke execute on function public.get_product(uuid) from public;
grant execute on function public.get_product(uuid) to anon, authenticated;

create or replace function public.get_store(p_slug text)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  category_name text,
  category_slug text,
  logo_path text,
  published_products_count integer,
  rating_avg numeric,
  rating_count integer,
  product_categories jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.name, s.slug, s.description, c.name, c.slug, s.logo_path,
         s.published_products_count, s.rating_avg, s.rating_count,
         coalesce(
           (select jsonb_agg(jsonb_build_object('name', pc.name, 'slug', pc.slug) order by pc.position, pc.name)
              from public.categories pc
             where exists (
               select 1 from public.products p
                where p.store_id = s.id and p.category_id = pc.id and public.is_listed_product(p.id))),
           '[]'::jsonb)
    from public.stores s
    left join public.categories c on c.id = s.category_id
   where s.slug = p_slug;
$$;
revoke execute on function public.get_store(text) from public;
grant execute on function public.get_store(text) to anon, authenticated;
