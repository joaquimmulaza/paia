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
--   * \r\n passa a \n;
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
            regexp_replace(p, '[​-‏‪-‮⁦-⁩﻿⁠­؜᠎]', '', 'g'),
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
