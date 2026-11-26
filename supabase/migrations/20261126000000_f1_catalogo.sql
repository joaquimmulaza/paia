-- F1 · Catálogo: categorias, lojas, produtos e imagens, com leitura pública.
-- O cliente usa só a chave anon e é tratado como hostil. A leitura pública
-- faz-se nas próprias tabelas, com RLS para anon e authenticated e grant de
-- SELECT coluna a coluna. Nesta fase não há escrita pelo cliente: só o
-- service_role (servidor) e as migrações escrevem. O esquema private
-- continua fechado a anon e authenticated.

-- ---------------------------------------------------------------------------
-- 1. Tipos.
-- ---------------------------------------------------------------------------
create type public.store_status as enum ('draft', 'pending_approval', 'approved', 'rejected', 'suspended');
create type public.moderation_status as enum ('visible', 'hidden');

-- ---------------------------------------------------------------------------
-- 2. Tabelas. Os textos livres são normalizados por trigger e os CHECKs são a
--    última barreira, como em F0. Os nomes ficam numa só linha; as descrições
--    guardam quebras de linha (\n, no máximo uma linha em branco seguida).
--    Os caminhos de ficheiros são relativos ao bucket: minúsculas, dígitos,
--    «/», «_», «.» e «-», sem «..».
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (
      name = btrim(name) and name ~ '[^[:space:]]' and name !~ '[[:cntrl:]]'
      and char_length(name) between 1 and 40
    ),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40),
  position integer not null default 0 check (position >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_lower_name_key on public.categories (lower(name));

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  -- Uma loja por dono. O índice único serve também a FK.
  owner_id uuid not null unique references public.profiles (id) on delete restrict,
  name text not null
    check (
      name = btrim(name) and name ~ '[^[:space:]]' and name !~ '[[:cntrl:]]'
      and char_length(name) between 1 and 60
    ),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  description text not null default ''
    check (
      description = btrim(description, E' \n')
      and translate(description, E'\n', '') !~ '[[:cntrl:]]'
      and description !~ E'\n\n\n'
      and char_length(description) <= 280
    ),
  category_id uuid not null references public.categories (id) on delete restrict,
  logo_path text null
    check (char_length(logo_path) <= 200 and logo_path ~ '^[a-z0-9][a-z0-9/_.-]*$' and strpos(logo_path, '..') = 0),
  cover_path text null
    check (char_length(cover_path) <= 200 and cover_path ~ '^[a-z0-9][a-z0-9/_.-]*$' and strpos(cover_path, '..') = 0),
  status public.store_status not null default 'draft',
  submitted_at timestamptz null,
  decided_at timestamptz null,
  decided_by uuid null references auth.users (id) on delete restrict,
  rating_avg numeric(2, 1) null check (rating_avg is null or rating_avg between 1 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  -- Mantido só por private.recalc_store_counters (recontagem, nunca incremento).
  published_products_count integer not null default 0 check (published_products_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Há média se e só se há avaliações.
  constraint stores_rating_consistent check ((rating_count = 0) = (rating_avg is null)),
  -- Fora de draft, a loja foi submetida.
  constraint stores_submission_recorded check (status = 'draft' or submitted_at is not null),
  -- Uma decisão da administração tem sempre data e autor.
  constraint stores_decision_recorded check (
    status not in ('approved', 'rejected', 'suspended')
    or (decided_at is not null and decided_by is not null)
  )
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  -- Imutável (trigger prevent_product_store_change).
  store_id uuid not null references public.stores (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null
    check (
      name = btrim(name) and name ~ '[^[:space:]]' and name !~ '[[:cntrl:]]'
      and char_length(name) between 1 and 80
    ),
  description text not null default ''
    check (
      description = btrim(description, E' \n')
      and translate(description, E'\n', '') !~ '[[:cntrl:]]'
      and description !~ E'\n\n\n'
      and char_length(description) <= 1000
    ),
  -- Kz inteiros.
  price_kz integer not null check (price_kz > 0 and price_kz <= 10000000),
  stock integer not null check (stock >= 0 and stock <= 9999),
  is_published boolean not null default false,
  moderation_status public.moderation_status not null default 'visible',
  moderation_reason text null
    check (
      moderation_reason = btrim(moderation_reason) and moderation_reason ~ '[^[:space:]]'
      and moderation_reason !~ '[[:cntrl:]]' and char_length(moderation_reason) <= 280
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um produto oculto tem sempre motivo; um visível nunca tem.
  constraint products_moderation_reason_consistent
    check ((moderation_status = 'hidden') = (moderation_reason is not null))
);

-- No máximo 5 imagens por produto: posições 0–4, uma imagem por posição.
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null
    check (char_length(path) <= 200 and path ~ '^[a-z0-9][a-z0-9/_.-]*$' and strpos(path, '..') = 0),
  position smallint not null check (position between 0 and 4),
  unique (product_id, position)
);

-- ---------------------------------------------------------------------------
-- 3. Índices. Cada FK tem um índice cuja primeira coluna é a da FK:
--    stores.owner_id (unique), stores.category_id, stores.decided_by,
--    products.store_id e products.category_id (índices de cursor abaixo) e
--    product_images.product_id (unique (product_id, position)).
--    Os índices de produtos servem a paginação por cursor (created_at, id).
-- ---------------------------------------------------------------------------
create index stores_category_id_idx on public.stores (category_id);
create index stores_decided_by_idx on public.stores (decided_by);
create index stores_status_idx on public.stores (status);
create index products_store_id_created_at_id_idx on public.products (store_id, created_at desc, id desc);
create index products_category_id_created_at_id_idx on public.products (category_id, created_at desc, id desc);
create index products_created_at_id_idx on public.products (created_at desc, id desc);

-- ---------------------------------------------------------------------------
-- 4. Semente das categorias (as 8 iniciais do context.md; a administração vai
--    poder alterá-las).
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, position) values
  ('Doces', 'doces', 0),
  ('Salgados', 'salgados', 1),
  ('Snacks', 'snacks', 2),
  ('Yogurt e bebidas', 'yogurt-e-bebidas', 3),
  ('Gelados', 'gelados', 4),
  ('Acessórios', 'acessorios', 5),
  ('Roupas e moda', 'roupas-e-moda', 6),
  ('Outros', 'outros', 7);

-- ---------------------------------------------------------------------------
-- 5. updated_at e normalização de texto livre.
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();

create trigger set_updated_at
  before update on public.stores
  for each row execute function private.set_updated_at();

create trigger set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

-- Texto com várias linhas (descrições):
--   * retira os mesmos caracteres invisíveis de normalize_text;
--   * \r\n e os separadores Unicode de linha e de parágrafo (U+2028, U+2029)
--     passam a \n;
--   * em cada linha, colapsa espaços, tabs e espaços Unicode num só espaço e
--     faz btrim;
--   * 3 ou mais quebras seguidas passam a 2 (uma linha em branco);
--   * tira espaços e quebras nas pontas.
-- Outros caracteres de controlo (incluindo um \r solto) ficam e são
-- recusados pelo trigger e pelos CHECKs. Devolve nulo para nulo.
create function private.normalize_multiline(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          replace(
            translate(regexp_replace(p, '[​-‏‪-‮⁦-⁩﻿⁠­؜᠎]', '', 'g'), U&'\2028\2029', E'\n\n'),
            E'\r\n', E'\n'
          ),
          '[ \t   -   　]+', ' ', 'g'
        ),
        ' ?\n ?', E'\n', 'g'
      ),
      '\n{3,}', E'\n\n', 'g'
    ),
    E' \n'
  );
$$;
revoke execute on function private.normalize_multiline(text) from public, anon, authenticated;

-- A função de F0 é redefinida para cobrir também stores e products; os ramos
-- de F0 ficam iguais.
create or replace function private.normalize_text_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'profiles' then
    new.full_name := private.normalize_text(new.full_name);
    if new.full_name ~ '[[:cntrl:]]' then
      raise exception using errcode = '23514', message = 'INVALID_TEXT';
    end if;
  elsif tg_table_name = 'academic_info' then
    new.course := private.normalize_text(new.course);
    new.curricular_year := private.normalize_text(new.curricular_year);
    new.shift := private.normalize_text(new.shift);
    new.class_group := private.normalize_text(new.class_group);
    if new.course ~ '[[:cntrl:]]' or new.curricular_year ~ '[[:cntrl:]]'
       or new.shift ~ '[[:cntrl:]]' or new.class_group ~ '[[:cntrl:]]' then
      raise exception using errcode = '23514', message = 'INVALID_TEXT';
    end if;
  elsif tg_table_name = 'stores' then
    new.name := private.normalize_text(new.name);
    new.description := private.normalize_multiline(new.description);
    if new.name ~ '[[:cntrl:]]' or translate(new.description, E'\n', '') ~ '[[:cntrl:]]' then
      raise exception using errcode = '23514', message = 'INVALID_TEXT';
    end if;
  elsif tg_table_name = 'products' then
    new.name := private.normalize_text(new.name);
    new.description := private.normalize_multiline(new.description);
    new.moderation_reason := private.normalize_text(new.moderation_reason);
    if new.name ~ '[[:cntrl:]]' or translate(new.description, E'\n', '') ~ '[[:cntrl:]]'
       or new.moderation_reason ~ '[[:cntrl:]]' then
      raise exception using errcode = '23514', message = 'INVALID_TEXT';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.normalize_text_fields() from public, anon, authenticated;

create trigger normalize_text_fields
  before insert or update on public.stores
  for each row execute function private.normalize_text_fields();

create trigger normalize_text_fields
  before insert or update on public.products
  for each row execute function private.normalize_text_fields();

-- Um produto nunca muda de loja (para todos os papéis): simplifica o
-- contador e o histórico de pedidos.
create function private.prevent_product_store_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.store_id is distinct from old.store_id then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;
  return new;
end;
$$;
revoke execute on function private.prevent_product_store_change() from public, anon, authenticated;

create trigger prevent_product_store_change
  before update of store_id on public.products
  for each row execute function private.prevent_product_store_change();

-- ---------------------------------------------------------------------------
-- 6. Contador de produtos públicos por loja. Recontagem, nunca incremento.
--    * Bloqueia a linha da loja com FOR NO KEY UPDATE antes de contar. Não
--      entra em conflito com o KEY SHARE da FK das inserções concorrentes
--      (FOR UPDATE entraria e poderia dar deadlock), mas serializa os
--      recálculos da mesma loja. Em READ COMMITTED, a contagem seguinte tem
--      um snapshot novo e vê o que quem tinha o bloqueio gravou.
--    * Só escreve quando o valor muda, para não mexer em stores.updated_at
--      nem correr os triggers da loja sem necessidade.
-- ---------------------------------------------------------------------------
create function private.recalc_store_counters(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform 1 from public.stores where id = p_store_id for no key update;

  select count(*)::integer into v_count
    from public.products
   where store_id = p_store_id
     and is_published
     and moderation_status = 'visible';

  update public.stores
     set published_products_count = v_count
   where id = p_store_id
     and published_products_count is distinct from v_count;
end;
$$;
revoke execute on function private.recalc_store_counters(uuid) from public, anon, authenticated;

-- SECURITY DEFINER para que chamar recalc_store_counters não dependa do papel
-- que escreve (o service_role não tem USAGE em private nem EXECUTE nela).
-- store_id é imutável, por isso basta uma loja por evento.
create function private.products_recalc_store_counters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recalc_store_counters(old.store_id);
  else
    perform private.recalc_store_counters(new.store_id);
  end if;
  return null;
end;
$$;
revoke execute on function private.products_recalc_store_counters() from public, anon, authenticated;

create trigger recalc_store_counters
  after insert or delete or update of store_id, is_published, moderation_status on public.products
  for each row execute function private.products_recalc_store_counters();

-- ---------------------------------------------------------------------------
-- 7. RLS. Só políticas de leitura; sem políticas de escrita para anon nem
--    authenticated nesta fase (nem grants). As políticas não usam funções:
--    a visibilidade de products depende da de stores e a de product_images
--    da de products, através das RLS dessas tabelas e de colunas concedidas
--    (stores.id, products.id). As colunas das próprias políticas não
--    precisam de grant: o Postgres só verifica privilégios de coluna nas
--    colunas da consulta do utilizador.
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;

create policy categories_select_visible on public.categories
  for select to anon, authenticated
  using (is_visible);

create policy stores_select_approved on public.stores
  for select to anon, authenticated
  using (status = 'approved');

create policy products_select_public on public.products
  for select to anon, authenticated
  using (
    is_published
    and moderation_status = 'visible'
    and exists (select 1 from public.stores s where s.id = products.store_id)
  );

create policy product_images_select_public on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_images.product_id));

-- ---------------------------------------------------------------------------
-- 8. Permissões por coluna. owner_id, status, submitted_at, decided_at,
--    decided_by, is_published, moderation_* e updated_at ficam de fora.
-- ---------------------------------------------------------------------------
grant select (id, name, slug, position) on public.categories to anon, authenticated;
grant select (
  id, name, slug, description, category_id, logo_path, cover_path,
  rating_avg, rating_count, published_products_count, created_at
) on public.stores to anon, authenticated;
grant select (id, store_id, category_id, name, description, price_kz, stock, created_at)
  on public.products to anon, authenticated;
grant select (id, product_id, path, position) on public.product_images to anon, authenticated;

grant select, insert, update, delete
  on public.categories, public.stores, public.products, public.product_images
  to service_role;

-- ---------------------------------------------------------------------------
-- 9. Pesquisa e páginas públicas do catálogo.
--    * Todas são SECURITY INVOKER: correm com o papel de quem chama, por isso
--      as RLS e os grants por coluna aplicam-se. Usam só colunas concedidas e
--      não voltam a filtrar por is_published, moderation_status nem status
--      (anon nem sequer os pode ler): a visibilidade é das RLS.
--    * Não tocam no esquema private (anon e authenticated não têm USAGE
--      nele). A chave de pesquisa vive em public.search_key.
--    * Erros de entrada: P0001 com INVALID_SORT ou INVALID_CURSOR.
-- ---------------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;

-- Chave de pesquisa: sem acentos, minúsculas e sem espaços nas pontas.
-- Usa o dicionário qualificado para não depender do search_path. É
-- IMMUTABLE por decisão: o dicionário unaccent não muda em produção.
create function public.search_key(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, btrim(coalesce(p, ''))));
$$;
revoke execute on function public.search_key(text) from public;
grant execute on function public.search_key(text) to anon, authenticated;

-- Não é preciso grant em extensions.unaccent: no Supabase a extensão é
-- criada pelo supabase_admin, a quem o revoke global de F0 (do postgres) não
-- se aplica, e anon e authenticated já têm USAGE em extensions. Os testes
-- de pesquisa como anon confirmam-no.

-- Pesquisa de produtos com filtros, três ordens e paginação por cursor.
-- * A consulta é texto fixo (nada vindo do cliente entra no texto) e corre
--   com EXECUTE … USING: cada chamada é planeada com os valores reais, por
--   isso os filtros opcionais não impedem o uso dos índices de cursor. Os
--   valores do cliente entram só como parâmetros ($1…$9).
-- * Sem cursor, o limite é o extremo da ordem (infinity, uuid máximo, …), o
--   que mantém a mesma forma de predicado em todas as páginas.
-- * p_q é cortado a 80 caracteres; a correspondência é position(), por isso
--   %, _, \, vírgulas e parênteses são texto.
create function public.search_products(
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

-- Página de um produto. Um produto que as RLS escondem devolve 0 linhas.
create function public.get_product(p_id uuid)
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
   where p.id = p_id;
$$;
revoke execute on function public.get_product(uuid) from public;
grant execute on function public.get_product(uuid) to anon, authenticated;

-- Lista de lojas aprovadas (as RLS escondem as outras), no máximo 50.
create function public.list_stores(p_q text default null, p_category_slug text default null)
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
  rating_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.name, s.slug, s.description, c.name, c.slug, s.logo_path,
         s.published_products_count, s.rating_avg, s.rating_count
    from public.stores s
    left join public.categories c on c.id = s.category_id
   where (p_category_slug is null or c.slug = p_category_slug)
     and (public.search_key(left(p_q, 80)) = ''
          or position(public.search_key(left(p_q, 80)) in public.search_key(s.name)) > 0)
   order by s.published_products_count desc, s.name asc, s.id asc
   limit 50;
$$;
revoke execute on function public.list_stores(text, text) from public;
grant execute on function public.list_stores(text, text) to anon, authenticated;

-- Página de uma loja: as colunas de list_stores e as categorias dos seus
-- produtos visíveis (para os filtros de C04), pela ordem das categorias.
create function public.get_store(p_slug text)
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
             where exists (select 1 from public.products p where p.store_id = s.id and p.category_id = pc.id)),
           '[]'::jsonb)
    from public.stores s
    left join public.categories c on c.id = s.category_id
   where s.slug = p_slug;
$$;
revoke execute on function public.get_store(text) from public;
grant execute on function public.get_store(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Storage: buckets públicos de leitura, 2 MB, só JPEG, PNG e WebP. Sem
--     políticas de escrita: as do dono ficam para F2.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('store-media', 'store-media', true, 2097152, '{image/jpeg,image/png,image/webp}'),
  ('product-media', 'product-media', true, 2097152, '{image/jpeg,image/png,image/webp}')
on conflict (id) do update
  set name = excluded.name,
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
