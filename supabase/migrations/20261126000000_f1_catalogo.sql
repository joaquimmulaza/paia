-- F1 · Catálogo: categorias, lojas, produtos e imagens, com leitura pública.
-- O cliente usa só a chave anon e é tratado como hostil. A leitura pública
-- faz-se nas próprias tabelas, com RLS para anon e authenticated e grant de
-- SELECT coluna a coluna. Nesta fase não há escrita pelo cliente: só o
-- service_role (servidor) e as migrações escrevem.

-- ---------------------------------------------------------------------------
-- 1. Tipos.
-- ---------------------------------------------------------------------------
create type public.store_status as enum ('draft', 'pending_approval', 'approved', 'rejected', 'suspended');
create type public.moderation_status as enum ('visible', 'hidden');

-- ---------------------------------------------------------------------------
-- 2. Tabelas. Os textos livres são normalizados por trigger e os CHECKs são a
--    última barreira, como em F0.
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (
      name = btrim(name) and name ~ '[^[:space:]]' and name !~ '[[:cntrl:]]'
      and char_length(name) between 1 and 40
    ),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  position integer not null default 0 check (position >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  -- Uma loja por dono. O índice único serve também a FK.
  owner_id uuid not null unique references public.profiles (id) on delete restrict,
  name text not null
    check (
      name = btrim(name) and name ~ '[^[:space:]]' and name !~ '[[:cntrl:]]'
      and char_length(name) between 1 and 60
    ),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  description text not null default ''
    check (description = btrim(description) and description !~ '[[:cntrl:]]' and char_length(description) <= 280),
  category_id uuid not null references public.categories (id) on delete restrict,
  logo_path text null check (char_length(logo_path) <= 200),
  cover_path text null check (char_length(cover_path) <= 200),
  status public.store_status not null default 'draft',
  submitted_at timestamptz null,
  decided_at timestamptz null,
  decided_by uuid null references auth.users (id) on delete restrict,
  rating_avg numeric(2, 1) null,
  rating_count integer not null default 0 check (rating_count >= 0),
  -- Mantido só por private.recalc_store_counters (recontagem, nunca incremento).
  published_products_count integer not null default 0 check (published_products_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Uma decisão da administração tem sempre data e autor.
  constraint stores_decision_recorded check (
    status not in ('approved', 'rejected', 'suspended')
    or (decided_at is not null and decided_by is not null)
  )
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null
    check (
      name = btrim(name) and name ~ '[^[:space:]]' and name !~ '[[:cntrl:]]'
      and char_length(name) between 1 and 80
    ),
  description text not null default ''
    check (description = btrim(description) and description !~ '[[:cntrl:]]' and char_length(description) <= 1000),
  -- Kz inteiros.
  price_kz integer not null check (price_kz > 0 and price_kz <= 10000000),
  stock integer not null check (stock >= 0 and stock <= 9999),
  is_published boolean not null default false,
  moderation_status public.moderation_status not null default 'visible',
  moderation_reason text null check (char_length(moderation_reason) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No máximo 5 imagens por produto: posições 0–4, uma imagem por posição.
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null check (char_length(path) <= 200),
  position smallint not null check (position between 0 and 4),
  unique (product_id, position)
);

-- ---------------------------------------------------------------------------
-- 3. Índices. Cada FK tem um índice cuja primeira coluna é a da FK:
--    stores.owner_id (unique), stores.category_id, stores.decided_by,
--    products.store_id e products.category_id (compostos abaixo) e
--    product_images.product_id (unique (product_id, position)).
-- ---------------------------------------------------------------------------
create index stores_category_id_idx on public.stores (category_id);
create index stores_decided_by_idx on public.stores (decided_by);
create index stores_status_idx on public.stores (status);
create index products_store_id_created_at_idx on public.products (store_id, created_at desc);
create index products_category_id_created_at_idx on public.products (category_id, created_at desc);
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
-- 5. updated_at e normalização de texto livre. A função de F0 é redefinida
--    para cobrir também stores e products; os ramos de F0 ficam iguais.
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
  elsif tg_table_name in ('stores', 'products') then
    new.name := private.normalize_text(new.name);
    new.description := private.normalize_text(new.description);
    if new.name ~ '[[:cntrl:]]' or new.description ~ '[[:cntrl:]]' then
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

-- ---------------------------------------------------------------------------
-- 6. Contador de produtos públicos por loja. Recontagem, nunca incremento,
--    para não derivar. A linha da loja é bloqueada antes de contar: em READ
--    COMMITTED cada instrução plpgsql tem um snapshot novo, por isso a
--    contagem feita depois do bloqueio vê os produtos de quem o tinha antes.
-- ---------------------------------------------------------------------------
create function private.recalc_store_counters(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.stores where id = p_store_id for update;

  update public.stores
     set published_products_count = (
       select count(*)
         from public.products
        where store_id = p_store_id
          and is_published
          and moderation_status = 'visible'
     )
   where id = p_store_id;
end;
$$;
revoke execute on function private.recalc_store_counters(uuid) from public, anon, authenticated;

-- SECURITY DEFINER para que chamar recalc_store_counters não dependa do papel
-- que escreve (service_role não tem USAGE em private nem EXECUTE nela).
create function private.products_recalc_store_counters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.recalc_store_counters(old.store_id);
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.store_id is distinct from old.store_id) then
    perform private.recalc_store_counters(new.store_id);
  end if;
  return null;
end;
$$;
revoke execute on function private.products_recalc_store_counters() from public, anon, authenticated;

create trigger recalc_store_counters
  after insert or update or delete on public.products
  for each row execute function private.products_recalc_store_counters();

-- ---------------------------------------------------------------------------
-- 7. Auxiliares das políticas. SECURITY DEFINER: leem stores.status e
--    products.is_published/moderation_status, que anon e authenticated não
--    podem ler. Devolvem só um booleano, igual para «não existe» e «não é
--    público», por isso não revelam nada.
--    anon e authenticated recebem USAGE em private e EXECUTE só nestas duas;
--    as outras funções de private continuam sem EXECUTE para eles.
-- ---------------------------------------------------------------------------
create function private.is_store_public(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stores where id = p_store_id and status = 'approved'
  );
$$;

create function private.is_product_public(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.products p
      join public.stores s on s.id = p.store_id
     where p.id = p_product_id
       and p.is_published
       and p.moderation_status = 'visible'
       and s.status = 'approved'
  );
$$;

revoke execute on function private.is_store_public(uuid) from public;
revoke execute on function private.is_product_public(uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_store_public(uuid) to anon, authenticated;
grant execute on function private.is_product_public(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. RLS. Só políticas de leitura; sem políticas de escrita para anon nem
--    authenticated nesta fase (nem grants).
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
  using ((select private.is_product_public(id)));

create policy product_images_select_public on public.product_images
  for select to anon, authenticated
  using ((select private.is_product_public(product_id)));

-- ---------------------------------------------------------------------------
-- 9. Permissões por coluna. owner_id, status, submitted_at, decided_at,
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
