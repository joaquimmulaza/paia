-- Testes pgTAP de F1 · Catálogo: categorias, lojas, produtos, imagens, RLS,
-- permissões por coluna, normalização e contadores.
-- Corre com `npm run db:test` (supabase test db), só contra a base local.
-- Tudo corre numa transação que termina em rollback: nada fica gravado.
-- O estado é preparado como postgres; cada bloco troca de papel com
-- `set local role` e volta com `reset role`.
begin;

create extension if not exists pgtap with schema extensions;

select plan(283);

-- Os testes não dependem do seed: dentro desta transação apagam-se os
-- destaques, as lojas, os produtos e as imagens que o seed criou (o rollback
-- final repõe-nos). Os destaques vão primeiro: a FK para stores é restrict.
delete from public.store_features;
delete from public.product_images;
delete from public.products;
delete from public.stores;

-- Utilitários de teste (os mesmos de F0).
create function pg_temp.signup(p_id uuid, p_email text)
returns void
language sql
as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, '',
          jsonb_build_object('full_name', 'Pessoa Teste', 'phone', '912345678', 'affiliation', 'staff', 'terms_accepted', true),
          now(), now());
$$;

create function pg_temp.as_user(p_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

create function pg_temp.cat(p_slug text)
returns uuid
language sql
as $$
  select id from public.categories where slug = p_slug;
$$;
grant execute on function pg_temp.cat(text) to authenticated, service_role;

create function pg_temp.store_count(p_store uuid)
returns int
language sql
as $$
  select published_products_count from public.stores where id = p_store;
$$;

-- ===========================================================================
-- (a) Semente das categorias
-- ===========================================================================
select is((select count(*)::int from public.categories), 8, '(a) a semente tem 8 categorias');
select is(
  (select array_agg(slug order by position) from public.categories),
  array['doces', 'salgados', 'snacks', 'yogurt-e-bebidas', 'gelados', 'acessorios', 'roupas-e-moda', 'outros'],
  '(a) os slugs da semente estão pela ordem de position');
select is(
  (select array_agg(name order by position) from public.categories),
  array['Doces', 'Salgados', 'Snacks', 'Yogurt e bebidas', 'Gelados', 'Acessórios', 'Roupas e moda', 'Outros'],
  '(a) os nomes da semente estão pela ordem de position');
select is(
  (select array_agg(position order by position) from public.categories),
  array[0, 1, 2, 3, 4, 5, 6, 7],
  '(a) as posições vão de 0 a 7');

-- RLS ligada nas quatro tabelas novas.
select ok((select relrowsecurity from pg_class where oid = 'public.categories'::regclass), 'RLS ligada em categories');
select ok((select relrowsecurity from pg_class where oid = 'public.stores'::regclass), 'RLS ligada em stores');
select ok((select relrowsecurity from pg_class where oid = 'public.products'::regclass), 'RLS ligada em products');
select ok((select relrowsecurity from pg_class where oid = 'public.product_images'::regclass), 'RLS ligada em product_images');

-- ===========================================================================
-- Preparação (como postgres)
-- ===========================================================================
select pg_temp.signup('10000000-0000-0000-0000-000000000001', 'dona.aprovada@exemplo.test');
select pg_temp.signup('10000000-0000-0000-0000-000000000002', 'dono.pendente@exemplo.test');
select pg_temp.signup('10000000-0000-0000-0000-000000000003', 'dono.suspenso@exemplo.test');
select pg_temp.signup('10000000-0000-0000-0000-000000000004', 'dono.contador@exemplo.test');
select pg_temp.signup('10000000-0000-0000-0000-000000000005', 'sem.loja@exemplo.test');
select pg_temp.signup('10000000-0000-0000-0000-000000000009', 'admin@exemplo.test');

insert into public.stores (id, owner_id, name, slug, description, category_id, logo_path, status, submitted_at, decided_at, decided_by)
values
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '  Doces   da Ana ', 'doces-da-ana',
   E'Linha 1\n\nLinha 2', pg_temp.cat('doces'), 'b0000000/logo.webp', 'approved', now(), now(), '10000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Loja Pendente', 'loja-pendente',
   '', pg_temp.cat('salgados'), null, 'pending_approval', now(), null, null),
  ('b0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Loja Suspensa', 'loja-suspensa',
   '', pg_temp.cat('snacks'), null, 'suspended', now(), now(), '10000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'Loja Contador', 'loja-contador',
   '', pg_temp.cat('outros'), null, 'approved', now(), now(), '10000000-0000-0000-0000-000000000009');

insert into public.products (id, store_id, category_id, name, description, price_kz, stock, is_published, moderation_status, moderation_reason)
values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'),
   ' Pastéis   de nata ', E'a\r\nb', 1500, 10, true, 'visible', null),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'),
   'Rascunho', '', 500, 1, false, 'visible', null),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'),
   'Escondido', '', 500, 1, true, 'hidden', '  Fotografia   imprópria '),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', pg_temp.cat('snacks'),
   'Da loja suspensa', '', 500, 1, true, 'visible', null),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', pg_temp.cat('salgados'),
   'Da loja pendente', '', 500, 1, true, 'visible', null);

insert into public.product_images (id, product_id, path, position)
values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000/c0000001/0.webp', 0),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'b0000000/c0000003/0.webp', 0),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'b0000000/c0000002/0.webp', 0),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 'b0000003/c0000004/0.webp', 0);

-- Categoria escondida, para ver que anon não a lê.
insert into public.categories (name, slug, position, is_visible) values ('Escondida', 'escondida', 8, false);

-- ===========================================================================
-- Normalização do texto livre
-- ===========================================================================
select is(
  (select name from public.stores where id = 'b0000000-0000-0000-0000-000000000001'),
  'Doces da Ana', 'o nome da loja fica normalizado numa só linha');
select is(
  (select description from public.stores where id = 'b0000000-0000-0000-0000-000000000001'),
  E'Linha 1\n\nLinha 2', 'a descrição da loja guarda as quebras de linha tal como vieram');
select is(
  (select description from public.products where id = 'c0000000-0000-0000-0000-000000000001'),
  E'a\nb', 'na descrição do produto \r\n passa a \n');
select is(
  (select name from public.products where id = 'c0000000-0000-0000-0000-000000000001'),
  'Pastéis de nata', 'o nome do produto fica normalizado');
select is(
  (select moderation_reason from public.products where id = 'c0000000-0000-0000-0000-000000000003'),
  'Fotografia imprópria', 'o motivo de moderação fica normalizado');

update public.products
   set description = E'  Primeira \t  linha  \n   segunda\n\n\n\n\nterceira​  \n\n'
 where id = 'c0000000-0000-0000-0000-000000000002';
select is(
  (select description from public.products where id = 'c0000000-0000-0000-0000-000000000002'),
  E'Primeira linha\nsegunda\n\nterceira',
  'a descrição colapsa espaços por linha, faz btrim por linha, junta 3+ quebras em 2 e tira caracteres invisíveis');
select is(
  private.normalize_multiline(E'x\n\ny'), E'x\n\ny', 'normalize_multiline mantém uma linha em branco');
select is(
  private.normalize_multiline(U&'a\2028b\2029c'), E'a\nb\nc',
  'normalize_multiline converte os separadores Unicode de linha e de parágrafo (U+2028, U+2029) em \n');

select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id)
     values ('10000000-0000-0000-0000-000000000005', E' \t ', 'loja-vazia', pg_temp.cat('doces')) $$,
  '23514', null, 'um nome de loja só com espaços é recusado');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values ('b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'), E'Bolo\x01', 100, 1) $$,
  '23514', 'INVALID_TEXT', 'um nome de produto com caracteres de controlo é recusado');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, description, price_kz, stock)
     values ('b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'), 'Bolo', E'linha\x01', 100, 1) $$,
  '23514', 'INVALID_TEXT', 'uma descrição com caracteres de controlo (além de \n) é recusada');
insert into public.products (id, store_id, category_id, name, price_kz, stock)
values ('c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'),
        E'Bolo\nde nata', 100, 1);
select is(
  (select name from public.products where id = 'c0000000-0000-0000-0000-000000000009'),
  'Bolo de nata', 'o nome do produto fica numa só linha (a quebra passa a espaço)');

-- ===========================================================================
-- (b) a (e) Leitura como anon
-- ===========================================================================
set local role anon;

select results_eq(
  $$ select slug from public.stores order by slug $$,
  $$ values ('doces-da-ana'::text), ('loja-contador'::text) $$,
  '(b) anon só vê as lojas approved');
select is(
  (select count(*)::int from public.stores where id = 'b0000000-0000-0000-0000-000000000002'),
  0, '(b) anon não vê a loja pending_approval');
select is(
  (select count(*)::int from public.stores where id = 'b0000000-0000-0000-0000-000000000003'),
  0, '(b) anon não vê a loja suspended');

select throws_ok($$ select owner_id from public.stores $$, '42501', null, '(c) anon não lê stores.owner_id');
select throws_ok($$ select decided_by from public.stores $$, '42501', null, '(c) anon não lê stores.decided_by');
select throws_ok($$ select decided_at from public.stores $$, '42501', null, '(c) anon não lê stores.decided_at');
select throws_ok($$ select submitted_at from public.stores $$, '42501', null, '(c) anon não lê stores.submitted_at');
select throws_ok($$ select status from public.stores $$, '42501', null, '(c) anon não lê stores.status');
select throws_ok($$ select id from public.stores where status = 'pending_approval' $$, '42501', null,
  '(c) anon não filtra stores por status');
select throws_ok($$ select id from public.stores order by owner_id $$, '42501', null,
  '(c) anon não ordena stores por owner_id');
select throws_ok($$ select is_published from public.products $$, '42501', null, '(c) anon não lê products.is_published');
select throws_ok($$ select moderation_status from public.products $$, '42501', null, '(c) anon não lê products.moderation_status');
select throws_ok($$ select moderation_reason from public.products $$, '42501', null, '(c) anon não lê products.moderation_reason');
select throws_ok($$ select * from public.stores $$, '42501', null, '(c) anon não faz select * em stores');
select throws_ok($$ select * from public.products $$, '42501', null, '(c) anon não faz select * em products');
-- product_images só tem colunas públicas (todas concedidas), por isso o
-- select * funciona, mas continua a devolver só as linhas públicas.
select results_eq(
  $$ select id from (select * from public.product_images) x $$,
  $$ values ('d0000000-0000-0000-0000-000000000001'::uuid) $$,
  '(c) select * em product_images só devolve as imagens públicas');

select results_eq(
  $$ select name from public.products order by name $$,
  $$ values ('Pastéis de nata'::text) $$,
  '(d) anon só vê o produto publicado e visível da loja aprovada');
select is(
  (select count(*)::int from public.products where id = 'c0000000-0000-0000-0000-000000000002'),
  0, '(d) anon não vê o produto não publicado, nem por id');
select is(
  (select count(*)::int from public.products where id = 'c0000000-0000-0000-0000-000000000003'),
  0, '(d) anon não vê o produto hidden, nem por id');
select is(
  (select count(*)::int from public.products where id = 'c0000000-0000-0000-0000-000000000004'),
  0, '(d) anon não vê o produto da loja suspended, nem por id');
select is(
  (select count(*)::int from public.products where id = 'c0000000-0000-0000-0000-000000000005'),
  0, '(d) anon não vê o produto da loja pending_approval');

select results_eq(
  $$ select id from public.product_images $$,
  $$ values ('d0000000-0000-0000-0000-000000000001'::uuid) $$,
  '(e) anon só vê a imagem do produto público');
select is(
  (select count(*)::int from public.product_images where product_id = 'c0000000-0000-0000-0000-000000000003'),
  0, '(e) anon não vê as imagens do produto hidden');
select is(
  (select count(*)::int from public.product_images where product_id = 'c0000000-0000-0000-0000-000000000002'),
  0, '(e) anon não vê as imagens do produto não publicado');
select is(
  (select count(*)::int from public.product_images where product_id = 'c0000000-0000-0000-0000-000000000004'),
  0, '(e) anon não vê as imagens do produto da loja suspended');

select is(
  (select count(*)::int from public.categories where slug = 'escondida'),
  0, 'anon não vê categorias com is_visible = false');
select is((select count(*)::int from public.categories), 8, 'anon vê as 8 categorias visíveis');
select throws_ok($$ select is_visible from public.categories $$, '42501', null, 'anon não lê categories.is_visible');
select throws_ok(
  $$ insert into public.categories (name, slug) values ('Nova', 'nova') $$,
  '42501', null, 'anon não insere categorias');
select throws_ok(
  $$ update public.stores set name = 'X' where id = 'b0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'anon não altera lojas');

reset role;

-- ===========================================================================
-- (f) Como authenticated (a dona da loja aprovada)
-- ===========================================================================
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
set local role authenticated;

select is(
  (select count(*)::int from public.stores where id = 'b0000000-0000-0000-0000-000000000001'),
  1, 'authenticated lê a loja aprovada');
select is(
  (select count(*)::int from public.products where id = 'c0000000-0000-0000-0000-000000000002'),
  0, 'a dona não lê o seu produto não publicado pela leitura pública');

select throws_ok($$ select owner_id from public.stores $$, '42501', null, '(c) authenticated não lê stores.owner_id');
select throws_ok($$ select decided_by from public.stores $$, '42501', null, '(c) authenticated não lê stores.decided_by');
select throws_ok($$ select decided_at from public.stores $$, '42501', null, '(c) authenticated não lê stores.decided_at');
select throws_ok($$ select submitted_at from public.stores $$, '42501', null, '(c) authenticated não lê stores.submitted_at');
select throws_ok($$ select status from public.stores $$, '42501', null, '(c) authenticated não lê stores.status');
select throws_ok($$ select id from public.stores where status = 'pending_approval' $$, '42501', null,
  '(c) authenticated não filtra stores por status');
select throws_ok($$ select id from public.stores order by owner_id $$, '42501', null,
  '(c) authenticated não ordena stores por owner_id');
select throws_ok($$ select is_published from public.products $$, '42501', null, '(c) authenticated não lê products.is_published');
select throws_ok($$ select moderation_status from public.products $$, '42501', null, '(c) authenticated não lê products.moderation_status');
select throws_ok($$ select moderation_reason from public.products $$, '42501', null, '(c) authenticated não lê products.moderation_reason');
select throws_ok(
  $$ select p.full_name from public.stores s join public.profiles p on p.id = s.owner_id $$,
  '42501', null, 'authenticated não junta stores a profiles por owner_id');

select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id)
     values ('10000000-0000-0000-0000-000000000001', 'Outra', 'outra-loja', pg_temp.cat('doces')) $$,
  '42501', null, '(f) a dona não insere em stores');
select throws_ok(
  $$ update public.stores set name = 'Mudado' where id = 'b0000000-0000-0000-0000-000000000001' $$,
  '42501', null, '(f) a dona não altera stores');
select throws_ok(
  $$ delete from public.stores where id = 'b0000000-0000-0000-0000-000000000001' $$,
  '42501', null, '(f) a dona não apaga stores');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values ('b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'), 'Novo', 100, 1) $$,
  '42501', null, '(f) a dona não insere em products');
select throws_ok(
  $$ update public.products set price_kz = 1 where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501', null, '(f) a dona não altera products');
select throws_ok(
  $$ delete from public.products where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501', null, '(f) a dona não apaga products');
select throws_ok(
  $$ insert into public.product_images (product_id, path, position)
     values ('c0000000-0000-0000-0000-000000000001', 'x.webp', 1) $$,
  '42501', null, '(f) a dona não insere em product_images');
select throws_ok(
  $$ update public.product_images set path = 'y.webp' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '42501', null, '(f) a dona não altera product_images');
select throws_ok(
  $$ delete from public.product_images where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '42501', null, '(f) a dona não apaga product_images');

reset role;
select set_config('request.jwt.claims', '', true);

-- ===========================================================================
-- (g) published_products_count
-- ===========================================================================
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000001'), 1,
  '(g) a loja aprovada conta só o produto publicado e visível');
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000004'), 0, '(g) uma loja sem produtos tem 0');

insert into public.products (id, store_id, category_id, name, price_kz, stock, is_published)
values
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000004', pg_temp.cat('outros'), 'Um', 100, 1, true),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000004', pg_temp.cat('outros'), 'Dois', 100, 1, true);
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000004'), 2, '(g) dois produtos publicados contam 2');

update public.products set moderation_status = 'hidden', moderation_reason = 'Teste'
 where id = 'c0000000-0000-0000-0000-000000000006';
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000004'), 1, '(g) ocultar um produto desce para 1');

delete from public.products where id = 'c0000000-0000-0000-0000-000000000007';
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000004'), 0, '(g) depois do delete a contagem fica certa');

insert into public.products (id, store_id, category_id, name, price_kz, stock)
values ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000004', pg_temp.cat('outros'), 'Três', 100, 1);
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000004'), 0, '(g) um produto por publicar não conta');
update public.products set is_published = true where id = 'c0000000-0000-0000-0000-000000000008';
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000004'), 1, '(g) publicar sobe para 1');

-- Mudar stock ou preço não toca na loja. Dentro da transação now() não
-- muda, por isso fixa-se primeiro um updated_at antigo (sem o trigger).
alter table public.stores disable trigger set_updated_at;
update public.stores set updated_at = '2000-01-01T00:00:00Z' where id = 'b0000000-0000-0000-0000-000000000004';
alter table public.stores enable trigger set_updated_at;

update public.products set stock = 5 where id = 'c0000000-0000-0000-0000-000000000008';
update public.products set price_kz = 250 where id = 'c0000000-0000-0000-0000-000000000008';
select is(
  (select updated_at from public.stores where id = 'b0000000-0000-0000-0000-000000000004'),
  '2000-01-01T00:00:00Z'::timestamptz, '(g) mudar stock ou preço não altera stores.updated_at');
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000004'), 1, '(g) mudar stock ou preço mantém a contagem');

update public.products set is_published = false where id = 'c0000000-0000-0000-0000-000000000008';
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000004'), 0, '(g) despublicar desce a contagem');
select isnt(
  (select updated_at from public.stores where id = 'b0000000-0000-0000-0000-000000000004'),
  '2000-01-01T00:00:00Z'::timestamptz, '(g) quando a contagem muda, stores.updated_at muda');

-- O service_role (servidor) escreve e o contador acompanha.
set local role service_role;
insert into public.products (store_id, category_id, name, price_kz, stock, is_published)
values ('b0000000-0000-0000-0000-000000000004', pg_temp.cat('outros'), 'Do servidor', 100, 1, true);
reset role;
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000004'), 1, '(g) uma escrita do service_role atualiza o contador');

-- store_id é imutável.
select throws_ok(
  $$ update public.products set store_id = 'b0000000-0000-0000-0000-000000000004'
      where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'NOT_ALLOWED', 'um produto não muda de loja');

-- ===========================================================================
-- (h) e (i) CHECKs
-- ===========================================================================
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values ('b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'), 'Grátis', 0, 1) $$,
  '23514', null, '(h) price_kz = 0 é recusado');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values ('b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'), 'Caro', 10000001, 1) $$,
  '23514', null, '(h) price_kz acima de 10 000 000 é recusado');
select lives_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values ('b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'), 'No limite', 10000000, 9999) $$,
  '(h) price_kz = 10 000 000 e stock = 9999 são aceites');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values ('b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'), 'Negativo', 100, -1) $$,
  '23514', null, '(h) stock = -1 é recusado');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values ('b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'), 'Muito', 100, 10000) $$,
  '23514', null, '(h) stock = 10000 é recusado');
select throws_ok(
  format($$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values ('b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'), %L, 100, 1) $$, repeat('n', 81)),
  '23514', null, '(h) um nome de produto com 81 caracteres é recusado');
select throws_ok(
  format($$ update public.stores set description = %L where id = 'b0000000-0000-0000-0000-000000000004' $$, repeat('d', 281)),
  '23514', null, '(h) uma descrição de loja com 281 caracteres é recusada');
select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id)
     values ('10000000-0000-0000-0000-000000000005', 'Maiúsculas', 'Loja-Ana', pg_temp.cat('doces')) $$,
  '23514', null, '(h) um slug de loja com maiúsculas é recusado');
select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id)
     values ('10000000-0000-0000-0000-000000000005', 'Hífens', 'loja--ana', pg_temp.cat('doces')) $$,
  '23514', null, '(h) um slug de loja com hífens seguidos é recusado');
select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id)
     values ('10000000-0000-0000-0000-000000000005', 'Hífen', '-loja-ana', pg_temp.cat('doces')) $$,
  '23514', null, '(h) um slug de loja a começar por hífen é recusado');
select throws_ok(
  $$ insert into public.categories (name, slug) values ('Má', 'Ma') $$,
  '23514', null, '(h) um slug de categoria com maiúsculas é recusado');
select throws_ok(
  $$ insert into public.categories (name, slug) values ('Fim', 'fim-') $$,
  '23514', null, '(h) um slug de categoria a acabar em hífen é recusado');
select throws_ok(
  $$ insert into public.categories (name, slug) values ('DOCES', 'doces-2') $$,
  '23505', null, 'o nome da categoria é único sem distinguir maiúsculas');
select throws_ok(
  $$ insert into public.product_images (product_id, path, position)
     values ('c0000000-0000-0000-0000-000000000001', 'p5.webp', 5) $$,
  '23514', null, '(h) position = 5 numa imagem é recusado');

insert into public.product_images (product_id, path, position)
select 'c0000000-0000-0000-0000-000000000001', 'p' || g || '.webp', g from generate_series(1, 4) g;
select is(
  (select count(*)::int from public.product_images where product_id = 'c0000000-0000-0000-0000-000000000001'),
  5, '(h) um produto aceita 5 imagens');
select throws_ok(
  $$ insert into public.product_images (product_id, path, position)
     values ('c0000000-0000-0000-0000-000000000001', 'p6.webp', 4) $$,
  '23505', null, '(h) a sexta imagem é recusada (as 5 posições 0–4 já estão ocupadas)');

-- Caminhos de ficheiros.
select throws_ok(
  $$ update public.product_images set path = 'b0000000/../segredo.webp' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'um caminho de imagem com .. é recusado');
select throws_ok(
  $$ update public.product_images set path = 'B0000000/Foto.webp' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'um caminho de imagem com maiúsculas é recusado');
select throws_ok(
  $$ update public.stores set logo_path = '/abs/logo.webp' where id = 'b0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'um logo_path absoluto é recusado');
select throws_ok(
  $$ update public.stores set cover_path = 'b0000000/..' where id = 'b0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'um cover_path com .. é recusado');

-- Decisões e estado da loja.
select throws_ok(
  $$ update public.stores set status = 'approved' where id = 'b0000000-0000-0000-0000-000000000002' $$,
  '23514', null, '(i) status = approved sem decided_at é recusado');
select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id, status, submitted_at, decided_at)
     values ('10000000-0000-0000-0000-000000000005', 'Rejeitada', 'rejeitada', pg_temp.cat('doces'), 'rejected', now(), now()) $$,
  '23514', null, '(i) status = rejected sem decided_by é recusado');
select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id, status)
     values ('10000000-0000-0000-0000-000000000005', 'Pendente', 'pendente-sem-data', pg_temp.cat('doces'), 'pending_approval') $$,
  '23514', null, 'uma loja fora de draft sem submitted_at é recusada');
select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id)
     values ('10000000-0000-0000-0000-000000000001', 'Segunda', 'segunda-loja', pg_temp.cat('doces')) $$,
  '23505', null, 'cada dono tem no máximo uma loja');

-- Avaliações.
select throws_ok(
  $$ update public.stores set rating_avg = 5.5, rating_count = 2 where id = 'b0000000-0000-0000-0000-000000000004' $$,
  '23514', null, 'rating_avg acima de 5 é recusado');
select throws_ok(
  $$ update public.stores set rating_avg = 0.5, rating_count = 2 where id = 'b0000000-0000-0000-0000-000000000004' $$,
  '23514', null, 'rating_avg abaixo de 1 é recusado');
select throws_ok(
  $$ update public.stores set rating_avg = null, rating_count = 3 where id = 'b0000000-0000-0000-0000-000000000004' $$,
  '23514', null, 'rating_count > 0 sem rating_avg é recusado');
select throws_ok(
  $$ update public.stores set rating_avg = 4.5, rating_count = 0 where id = 'b0000000-0000-0000-0000-000000000004' $$,
  '23514', null, 'rating_avg sem avaliações é recusado');
select lives_ok(
  $$ update public.stores set rating_avg = 4.5, rating_count = 2 where id = 'b0000000-0000-0000-0000-000000000004' $$,
  'rating_avg 4.5 com 2 avaliações é aceite');

-- Moderação.
select throws_ok(
  $$ update public.products set moderation_status = 'hidden' where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'ocultar um produto sem motivo é recusado');
select throws_ok(
  $$ update public.products set moderation_reason = 'Motivo' where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'um produto visível com motivo de moderação é recusado');
select throws_ok(
  $$ update public.products set moderation_reason = '   ' where id = 'c0000000-0000-0000-0000-000000000003' $$,
  '23514', null, 'um motivo de moderação só com espaços é recusado');
select throws_ok(
  $$ update public.products set moderation_reason = E'Motivo\x02' where id = 'c0000000-0000-0000-0000-000000000003' $$,
  '23514', 'INVALID_TEXT', 'um motivo de moderação com caracteres de controlo é recusado');

-- ON DELETE: imagens vão com o produto; uma loja com produtos não se apaga.
delete from public.products where id = 'c0000000-0000-0000-0000-000000000003';
select is(
  (select count(*)::int from public.product_images where id = 'd0000000-0000-0000-0000-000000000002'),
  0, 'apagar o produto apaga as suas imagens (cascade)');
select throws_ok(
  $$ delete from public.stores where id = 'b0000000-0000-0000-0000-000000000001' $$,
  '23503', null, 'uma loja com produtos não se apaga (restrict)');

-- ===========================================================================
-- (j) Funções, esquema private e privilégios
-- ===========================================================================
select ok(not has_function_privilege('anon', 'private.recalc_store_counters(uuid)', 'execute'),
  '(j) anon não executa private.recalc_store_counters');
select ok(not has_function_privilege('authenticated', 'private.recalc_store_counters(uuid)', 'execute'),
  '(j) authenticated não executa private.recalc_store_counters');
select ok(not has_function_privilege('anon', 'private.normalize_multiline(text)', 'execute'),
  'anon não executa private.normalize_multiline');
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and (has_function_privilege('anon', p.oid, 'execute')
           or has_function_privilege('authenticated', p.oid, 'execute'))),
  0, 'nenhuma função de private é executável por anon ou authenticated');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon não tem USAGE em private');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated não tem USAGE em private');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('is_store_public', 'is_product_public')),
  0, 'as auxiliares is_store_public e is_product_public não existem');

-- Lista exata das colunas que anon e authenticated podem ler.
select results_eq(
  $$ select grantee::text collate "default", table_name::text collate "default",
            column_name::text collate "default", privilege_type::text collate "default"
       from information_schema.column_privileges
      where table_schema = 'public'
        and table_name in ('categories', 'stores', 'products', 'product_images')
        and grantee in ('anon', 'authenticated')
      order by 1, 2, 3, 4 $$,
  $$ select r, v.t, v.c, 'SELECT'
       from unnest(array['anon', 'authenticated']) r,
            (values
              ('categories', 'id'), ('categories', 'name'), ('categories', 'slug'), ('categories', 'position'),
              ('stores', 'id'), ('stores', 'name'), ('stores', 'slug'), ('stores', 'description'),
              ('stores', 'category_id'), ('stores', 'logo_path'), ('stores', 'cover_path'),
              ('stores', 'rating_avg'), ('stores', 'rating_count'), ('stores', 'published_products_count'),
              ('stores', 'created_at'),
              ('products', 'id'), ('products', 'store_id'), ('products', 'category_id'), ('products', 'name'),
              ('products', 'description'), ('products', 'price_kz'), ('products', 'stock'), ('products', 'created_at'),
              ('product_images', 'id'), ('product_images', 'product_id'), ('product_images', 'path'),
              ('product_images', 'position')
            ) v(t, c)
      order by 1, 2, 3, 4 $$,
  'anon e authenticated têm exatamente as colunas públicas, só com SELECT');

select ok(
  (select bool_and(has_table_privilege('service_role', t, p))
     from unnest(array['public.categories', 'public.stores', 'public.products', 'public.product_images']) t,
          unnest(array['select', 'insert', 'update', 'delete']) p),
  'service_role tem select, insert, update e delete nas quatro tabelas');
select ok(
  not (select bool_or(has_table_privilege(r, t, p))
         from unnest(array['anon', 'authenticated']) r,
              unnest(array['public.categories', 'public.stores', 'public.products', 'public.product_images']) t,
              unnest(array['select', 'insert', 'update', 'delete', 'truncate']) p),
  'anon e authenticated não têm nenhum privilégio de tabela inteira nas quatro tabelas');

-- ===========================================================================
-- (k) Funções públicas do catálogo: pesquisa, detalhe e lojas
-- ===========================================================================
-- As cinco funções públicas: invoker, stable (search_key é immutable),
-- search_path vazio e executáveis só por anon e authenticated (não por PUBLIC).
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('search_key', 'search_products', 'get_product', 'list_stores', 'get_store')
      and not p.prosecdef
      and p.proconfig @> array['search_path=""']
      and p.provolatile = case when p.proname = 'search_key' then 'i' else 's' end),
  5, '(k) as cinco funções são security invoker, com search_path vazio e a volatilidade certa');
select ok(
  (select bool_and(has_function_privilege(r, p.oid, 'execute'))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
          unnest(array['anon', 'authenticated']) r
    where n.nspname = 'public'
      and p.proname in ('search_key', 'search_products', 'get_product', 'list_stores', 'get_store')),
  '(k) anon e authenticated executam as cinco funções');
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
          aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where n.nspname = 'public'
      and p.proname in ('search_key', 'search_products', 'get_product', 'list_stores', 'get_store')
      and a.grantee = 0),
  0, '(k) PUBLIC não executa nenhuma das cinco funções');

select is(public.search_key('  PASTÉIS  '), 'pasteis', '(k) search_key tira acentos, maiúsculas e espaços nas pontas');
select is(public.search_key(null), '', '(k) search_key de nulo é texto vazio');

-- Preparação: lojas e produtos próprios desta secção, com datas fixas.
select pg_temp.signup('10000000-0000-0000-0000-000000000011', 'pesquisa.doces@exemplo.test');
select pg_temp.signup('10000000-0000-0000-0000-000000000012', 'pesquisa.salgados@exemplo.test');
select pg_temp.signup('10000000-0000-0000-0000-000000000013', 'pesquisa.suspensa@exemplo.test');
select pg_temp.signup('10000000-0000-0000-0000-000000000014', 'pesquisa.pendente@exemplo.test');

insert into public.stores (id, owner_id, name, slug, description, category_id, logo_path, status, submitted_at, decided_at, decided_by)
values
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', 'Pesquisa Doces', 'pesquisa-doces',
   'Doces para testar', pg_temp.cat('doces'), 'e0000000/logo.webp', 'approved', now(), now(), '10000000-0000-0000-0000-000000000009'),
  ('e0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000012', 'Pesquisa Salgados', 'pesquisa-salgados',
   '', pg_temp.cat('salgados'), null, 'approved', now(), now(), '10000000-0000-0000-0000-000000000009'),
  ('e0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000013', 'Pesquisa Suspensa', 'pesquisa-suspensa',
   '', pg_temp.cat('salgados'), null, 'suspended', now(), now(), '10000000-0000-0000-0000-000000000009'),
  ('e0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000014', 'Pesquisa Pendente', 'pesquisa-pendente',
   '', pg_temp.cat('salgados'), null, 'pending_approval', now(), null, null);

insert into public.products (id, store_id, category_id, name, description, price_kz, stock, is_published, moderation_status, moderation_reason, created_at)
values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', pg_temp.cat('salgados'),
   'Pastéis de carne (3)', 'Três pastéis', 300, 5, true, 'visible', null, '2026-01-03T10:00:00Z'),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'),
   'Bolo de chocolate', E'Fofo\ne húmido', 1000, 2, true, 'visible', null, '2026-01-02T10:00:00Z'),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'),
   'Brigadeiro', '', 200, 0, true, 'visible', null, '2026-01-01T10:00:00Z'),
  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', pg_temp.cat('gelados'),
   'Gelado por publicar', '', 400, 1, false, 'visible', null, '2026-01-06T10:00:00Z'),
  ('f0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'),
   'Doce ocultado', '', 400, 1, true, 'hidden', 'Teste', '2026-01-06T10:00:00Z'),
  ('f0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000003', pg_temp.cat('salgados'),
   'Pastéis da suspensa', '', 300, 1, true, 'visible', null, '2026-01-06T10:00:00Z'),
  ('f0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'),
   'Queijada', '', 500, 3, true, 'visible', null, '2026-01-04T10:00:00Z'),
  ('f0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001', pg_temp.cat('snacks'),
   'Pipocas', '', 150, 9, true, 'visible', null, '2026-01-05T10:00:00Z'),
  ('f0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', pg_temp.cat('salgados'),
   repeat('x', 80), '', 700, 1, true, 'visible', null, '2026-01-02T09:00:00Z');

-- Imagens de propósito fora de ordem: a principal é a de position = 0.
insert into public.product_images (product_id, path, position)
values
  ('f0000000-0000-0000-0000-000000000002', 'e0000000/f0000002/1.webp', 1),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000/f0000002/0.webp', 0),
  ('f0000000-0000-0000-0000-000000000005', 'e0000000/f0000005/0.webp', 0);

set local role anon;

-- Pesquisa (ponto a vigiar 1).
select ok(
  exists (select 1 from public.search_products('pasteis') where name = 'Pastéis de carne (3)'),
  '(k) «pasteis» encontra «Pastéis de carne (3)»');
select ok(
  exists (select 1 from public.search_products('PASTÉIS') where name = 'Pastéis de carne (3)'),
  '(k) «PASTÉIS» encontra «Pastéis de carne (3)»');
select ok(
  exists (select 1 from public.search_products('  carne (3) ') where name = 'Pastéis de carne (3)'),
  '(k) a pesquisa ignora espaços nas pontas e trata parênteses como texto');
select ok(
  not exists (select 1 from public.search_products('pasteis') where name = 'Pastéis da suspensa'),
  '(k) a pesquisa não devolve produtos de lojas não aprovadas');
select is((select count(*)::int from public.search_products('%')), 0, '(k) «%» é texto, não curinga');
select is((select count(*)::int from public.search_products('_')), 0, '(k) «_» é texto, não curinga');
select is((select count(*)::int from public.search_products('a,b(')), 0, '(k) «a,b(» devolve 0 linhas sem erro');
select is((select count(*)::int from public.search_products(E'\\')), 0, '(k) «\» devolve 0 linhas sem erro');
select lives_ok(
  format($$ select * from public.search_products(%L) $$, repeat('a', 200)),
  '(k) uma pesquisa com 200 caracteres não falha');
select results_eq(
  format($$ select id from public.search_products(%L) $$, repeat('x', 80) || 'yyy'),
  $$ values ('f0000000-0000-0000-0000-000000000009'::uuid) $$,
  '(k) a pesquisa é cortada a 80 caracteres');
select is(
  (select count(*)::int from public.search_products('', p_store_slug => 'pesquisa-doces')),
  (select count(*)::int from public.search_products(null, p_store_slug => 'pesquisa-doces')),
  '(k) uma pesquisa vazia não filtra');

-- Filtros.
select ok(
  (select bool_and(category_slug = 'doces') and count(*) > 0
     from public.search_products(p_category_slug => 'doces', p_limit => 50)),
  '(k) o filtro de categoria só devolve doces');
select results_eq(
  $$ select id from public.search_products(p_store_slug => 'pesquisa-doces') $$,
  $$ values ('f0000000-0000-0000-0000-000000000008'::uuid), ('f0000000-0000-0000-0000-000000000007'::uuid),
            ('f0000000-0000-0000-0000-000000000002'::uuid), ('f0000000-0000-0000-0000-000000000003'::uuid) $$,
  '(k) o filtro de loja só devolve os produtos visíveis dessa loja, dos mais recentes para os mais antigos');
select is(
  (select count(*)::int from public.search_products(p_store_slug => 'pesquisa-suspensa')),
  0, '(k) filtrar por uma loja suspensa devolve 0 linhas');
select is(
  (select count(*)::int from public.search_products(p_category_slug => 'nao-existe')),
  0, '(k) filtrar por uma categoria que não existe devolve 0 linhas');

-- Colunas devolvidas e imagem principal.
select results_eq(
  $$ select name, price_kz, stock, created_at, store_name, store_slug, category_slug, main_image_path
       from public.search_products(p_store_slug => 'pesquisa-doces', p_category_slug => 'doces')
      where id = 'f0000000-0000-0000-0000-000000000002' $$,
  $$ values ('Bolo de chocolate'::text, 1000, 2, '2026-01-02T10:00:00Z'::timestamptz, 'Pesquisa Doces'::text,
             'pesquisa-doces'::text, 'doces'::text, 'e0000000/f0000002/0.webp'::text) $$,
  '(k) search_products devolve as colunas públicas e a imagem de position = 0');
select is(
  (select main_image_path from public.search_products(p_store_slug => 'pesquisa-doces')
    where id = 'f0000000-0000-0000-0000-000000000007'),
  null, '(k) um produto sem imagens tem main_image_path nulo');

-- Cursor por chave (3 doces de pesquisa-doces, p_limit = 2).
select results_eq(
  $$ select id from public.search_products(p_store_slug => 'pesquisa-doces', p_category_slug => 'doces', p_limit => 2) $$,
  $$ values ('f0000000-0000-0000-0000-000000000007'::uuid), ('f0000000-0000-0000-0000-000000000002'::uuid) $$,
  '(k) recentes: a primeira página tem os 2 mais recentes');
select results_eq(
  $$ select id from public.search_products(p_store_slug => 'pesquisa-doces', p_category_slug => 'doces', p_limit => 2,
       p_after_created_at => '2026-01-02T10:00:00Z', p_after_id => 'f0000000-0000-0000-0000-000000000002') $$,
  $$ values ('f0000000-0000-0000-0000-000000000003'::uuid) $$,
  '(k) recentes: a segunda página devolve só o terceiro, sem repetir');
select results_eq(
  $$ select id from public.search_products(p_store_slug => 'pesquisa-doces', p_category_slug => 'doces',
       p_sort => 'preco-asc', p_limit => 2) $$,
  $$ values ('f0000000-0000-0000-0000-000000000003'::uuid), ('f0000000-0000-0000-0000-000000000007'::uuid) $$,
  '(k) preco-asc: a primeira página tem os 2 mais baratos');
select results_eq(
  $$ select id from public.search_products(p_store_slug => 'pesquisa-doces', p_category_slug => 'doces',
       p_sort => 'preco-asc', p_limit => 2,
       p_after_price => 500, p_after_id => 'f0000000-0000-0000-0000-000000000007') $$,
  $$ values ('f0000000-0000-0000-0000-000000000002'::uuid) $$,
  '(k) preco-asc: a segunda página devolve só o terceiro, sem repetir');
select results_eq(
  $$ select id from public.search_products(p_store_slug => 'pesquisa-doces', p_category_slug => 'doces',
       p_sort => 'preco-desc', p_limit => 2,
       p_after_price => 500, p_after_id => 'f0000000-0000-0000-0000-000000000007') $$,
  $$ values ('f0000000-0000-0000-0000-000000000003'::uuid) $$,
  '(k) preco-desc: a página seguinte continua a descer no preço');
select throws_ok(
  $$ select * from public.search_products(p_after_id => 'f0000000-0000-0000-0000-000000000007') $$,
  'P0001', 'INVALID_CURSOR', '(k) um cursor incompleto é recusado');

-- Limite e ordem inválida.
select is(
  (select count(*)::int from public.search_products(p_store_slug => 'pesquisa-doces', p_limit => 0)),
  1, '(k) p_limit abaixo de 1 passa a 1');
select throws_ok(
  $$ select * from public.search_products(p_sort => 'x') $$,
  'P0001', 'INVALID_SORT', '(k) uma ordem desconhecida dá INVALID_SORT');

-- get_product (ponto a vigiar 2).
select results_eq(
  $$ select name, description, price_kz, stock, created_at, category_name, category_slug, store_name, store_slug,
            store_rating_avg, store_rating_count, images
       from public.get_product('f0000000-0000-0000-0000-000000000002') $$,
  $$ values ('Bolo de chocolate'::text, E'Fofo\ne húmido'::text, 1000, 2, '2026-01-02T10:00:00Z'::timestamptz,
             'Doces'::text, 'doces'::text, 'Pesquisa Doces'::text, 'pesquisa-doces'::text, null::numeric, 0,
             '[{"path": "e0000000/f0000002/0.webp", "position": 0}, {"path": "e0000000/f0000002/1.webp", "position": 1}]'::jsonb) $$,
  '(k) get_product devolve o produto com as imagens ordenadas por position');
select is(
  (select images from public.get_product('f0000000-0000-0000-0000-000000000007')),
  '[]'::jsonb, '(k) um produto sem imagens tem images = []');
select is((select count(*)::int from public.get_product('f0000000-0000-0000-0000-000000000004')), 0,
  '(k) get_product de um produto não publicado devolve 0 linhas');
select is((select count(*)::int from public.get_product('f0000000-0000-0000-0000-000000000005')), 0,
  '(k) get_product de um produto hidden devolve 0 linhas');
select is((select count(*)::int from public.get_product('f0000000-0000-0000-0000-000000000006')), 0,
  '(k) get_product de um produto de loja suspensa devolve 0 linhas');
select is((select count(*)::int from public.get_product('00000000-0000-0000-0000-000000000000')), 0,
  '(k) get_product de um id que não existe devolve 0 linhas');

-- list_stores e get_store.
select results_eq(
  $$ select slug from public.list_stores() $$,
  $$ values ('pesquisa-doces'::text), ('pesquisa-salgados'::text), ('doces-da-ana'::text), ('loja-contador'::text) $$,
  '(k) list_stores devolve só as aprovadas, por produtos publicados e depois por nome');
select results_eq(
  $$ select slug from public.list_stores('PESQUISA') $$,
  $$ values ('pesquisa-doces'::text), ('pesquisa-salgados'::text) $$,
  '(k) list_stores pesquisa no nome sem distinguir maiúsculas');
select results_eq(
  $$ select slug from public.list_stores(p_category_slug => 'salgados') $$,
  $$ values ('pesquisa-salgados'::text) $$,
  '(k) list_stores filtra por categoria e não mostra as não aprovadas');
select is((select count(*)::int from public.list_stores('%')), 0, '(k) list_stores trata «%» como texto');
select results_eq(
  $$ select name, slug, description, category_name, category_slug, logo_path, published_products_count,
            rating_avg, rating_count, product_categories
       from public.get_store('pesquisa-doces') $$,
  $$ values ('Pesquisa Doces'::text, 'pesquisa-doces'::text, 'Doces para testar'::text, 'Doces'::text, 'doces'::text,
             'e0000000/logo.webp'::text, 4, null::numeric, 0,
             '[{"name": "Doces", "slug": "doces"}, {"name": "Snacks", "slug": "snacks"}]'::jsonb) $$,
  '(k) get_store devolve a loja e só as categorias dos seus produtos visíveis');
select is((select count(*)::int from public.get_store('pesquisa-pendente')), 0,
  '(k) get_store de uma loja pendente devolve 0 linhas');
select is((select count(*)::int from public.get_store('pesquisa-suspensa')), 0,
  '(k) get_store de uma loja suspensa devolve 0 linhas');

reset role;

-- Também como authenticated (a dona da loja pendente não a vê pela leitura pública).
select pg_temp.as_user('10000000-0000-0000-0000-000000000014');
set local role authenticated;
select is((select count(*)::int from public.get_store('pesquisa-pendente')), 0,
  '(k) a dona da loja pendente não a vê em get_store');
select ok(
  exists (select 1 from public.search_products('pasteis') where name = 'Pastéis de carne (3)'),
  '(k) authenticated também pesquisa');
reset role;
select set_config('request.jwt.claims', '', true);

-- ===========================================================================
-- (l) Storage: buckets públicos de leitura, sem políticas de escrita
-- ===========================================================================
select results_eq(
  $$ select id, name, public, file_size_limit, allowed_mime_types
       from storage.buckets where id in ('store-media', 'product-media') order by id $$,
  $$ values ('product-media'::text, 'product-media'::text, true, 2097152::bigint, '{image/jpeg,image/png,image/webp}'::text[]),
            ('store-media'::text, 'store-media'::text, true, 2097152::bigint, '{image/jpeg,image/png,image/webp}'::text[]) $$,
  '(l) os buckets store-media e product-media existem, públicos, com 2 MB e só jpeg, png e webp');
select is(
  (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'),
  0, '(l) não há políticas em storage.objects (a escrita do dono fica para F2)');

-- ===========================================================================
-- (m) Destaques de lojas (store_features), geridos pela administração
-- ===========================================================================
-- Tabela, acesso e índices.
select ok((select relrowsecurity from pg_class where oid = 'public.store_features'::regclass),
  '(m) RLS ligada em store_features');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'store_features'),
  0, '(m) store_features não tem políticas');
select ok(
  not (select bool_or(has_table_privilege(r, 'public.store_features', p))
         from unnest(array['anon', 'authenticated']) r,
              unnest(array['select', 'insert', 'update', 'delete', 'truncate']) p),
  '(m) anon e authenticated não têm privilégios de tabela em store_features');
select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'store_features' and grantee in ('anon', 'authenticated')),
  0, '(m) anon e authenticated não têm privilégios de coluna em store_features');
select ok(
  (select bool_and(has_table_privilege('service_role', 'public.store_features', p))
     from unnest(array['select', 'insert', 'update', 'delete']) p),
  '(m) service_role tem select, insert, update e delete em store_features');
select ok(
  exists (select 1 from pg_indexes
           where schemaname = 'public' and tablename = 'store_features'
             and indexdef like 'CREATE UNIQUE INDEX % ON public.store_features USING btree (store_id, source) WHERE is_active'),
  '(m) índice único parcial (store_id, source) where is_active');
select is(
  (select array_agg(a.attname::text order by a.attname::text)
     from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
    where i.indrelid = 'public.store_features'::regclass and i.indpred is null and not i.indisprimary),
  array['created_by', 'position', 'store_id', 'updated_by'],
  '(m) há índices a começar por store_id, created_by, updated_by e position');
select ok(
  exists (select 1 from pg_index i
           where i.indrelid = 'public.store_features'::regclass and i.indnatts = 2
             and (select attname from pg_attribute where attrelid = i.indrelid and attnum = i.indkey[0]) = 'position'
             and (select attname from pg_attribute where attrelid = i.indrelid and attnum = i.indkey[1]) = 'created_at'),
  '(m) índice (position, created_at)');

-- Funções: propriedades e permissões.
select ok(
  (select p.prosecdef and p.provolatile = 's' and p.proconfig @> array['search_path=""']
     from pg_proc p where p.oid = 'public.list_featured_stores()'::regprocedure),
  '(m) list_featured_stores é security definer, stable e com search_path vazio');
select ok(
  has_function_privilege('anon', 'public.list_featured_stores()', 'execute')
  and has_function_privilege('authenticated', 'public.list_featured_stores()', 'execute'),
  '(m) anon e authenticated executam list_featured_stores');
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_list_store_features', 'admin_save_store_feature', 'admin_set_store_feature_active',
                        'admin_remove_store_feature', 'admin_reorder_store_features')
      and p.prosecdef and p.proconfig @> array['search_path=""']
      and has_function_privilege('authenticated', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')),
  5, '(m) as cinco funções de gestão são security definer, com search_path vazio, só para authenticated');
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
          aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where n.nspname = 'public'
      and (p.proname like 'admin\_%store\_feature%' or p.proname = 'list_featured_stores')
      and a.grantee = 0),
  0, '(m) PUBLIC não executa nenhuma das funções de destaques');

-- Preparação (como postgres): lojas próprias desta secção.
select pg_temp.signup(('10000000-0000-0000-0000-0000000001' || lpad(g::text, 2, '0'))::uuid,
                      'destaque' || g || '@exemplo.test')
  from generate_series(1, 11) g;

insert into public.stores (id, owner_id, name, slug, category_id, status, submitted_at, decided_at, decided_by)
select ('a1000000-0000-0000-0000-0000000000' || lpad(v.n::text, 2, '0'))::uuid,
       ('10000000-0000-0000-0000-0000000001' || lpad(v.n::text, 2, '0'))::uuid,
       v.name, v.slug, pg_temp.cat('doces'), v.status::public.store_status, now(),
       case when v.status <> 'pending_approval' then now() end,
       case when v.status <> 'pending_approval' then '10000000-0000-0000-0000-000000000009'::uuid end
  from (values
    (1, 'Destaque Sem Período', 'destaque-sem-periodo', 'approved'),
    (2, 'Destaque Período Atual', 'destaque-periodo-atual', 'approved'),
    (3, 'Destaque Passado', 'destaque-passado', 'approved'),
    (4, 'Destaque Futuro', 'destaque-futuro', 'approved'),
    (5, 'Destaque Inativo', 'destaque-inativo', 'approved'),
    (6, 'Destaque Suspensa', 'destaque-suspensa', 'suspended'),
    (7, 'Destaque Pendente', 'destaque-pendente', 'pending_approval'),
    (8, 'Destaque Livre', 'destaque-livre', 'approved'),
    (9, 'Destaque Fim Agora', 'destaque-fim-agora', 'approved'),
    (10, 'Destaque Início Agora', 'destaque-inicio-agora', 'approved'),
    (11, 'Destaque Empate', 'destaque-empate', 'approved')
  ) v(n, name, slug, status);

-- Dentro da transação now() é fixo: os limites testam [starts_at, ends_at).
insert into public.store_features (id, store_id, source, position, starts_at, ends_at, is_active, note, created_at)
values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'admin', 2, null, null, true,
   'Nota interna', now() - interval '2 days'),
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'admin', 1,
   now() - interval '1 day', now() + interval '1 day', true, null, now()),
  ('a2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'admin', 0,
   now() - interval '10 days', now() - interval '1 day', true, null, now()),
  ('a2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'admin', 0,
   now() + interval '1 day', null, true, null, now()),
  ('a2000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 'admin', 0, null, null, false, null, now()),
  ('a2000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', 'admin', 0, null, null, true, null, now()),
  ('a2000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000009', 'admin', 0, null, now(), true, null, now()),
  ('a2000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000010', 'admin', 3, now(), null, true, null, now()),
  ('a2000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000011', 'admin', 2, null, null, true,
   null, now() - interval '1 day'),
  -- Um destaque pago na mesma loja que um admin: a loja aparece uma só vez.
  ('a2000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', 'paid', 4, null, null, true,
   null, now() - interval '3 days'),
  -- Desligado, de uma loja pendente: não pode ser religado.
  ('a2000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000007', 'admin', 0, null, null, false,
   null, now());

-- CHECKs e índice único.
select throws_ok(
  $$ insert into public.store_features (store_id, starts_at, ends_at)
     values ('a1000000-0000-0000-0000-000000000008', now(), now() - interval '1 hour') $$,
  '23514', null, '(m) ends_at antes de starts_at é recusado');
select throws_ok(
  $$ insert into public.store_features (store_id, starts_at, ends_at)
     values ('a1000000-0000-0000-0000-000000000008', now(), now()) $$,
  '23514', null, '(m) ends_at igual a starts_at é recusado');
select throws_ok(
  $$ insert into public.store_features (store_id, position) values ('a1000000-0000-0000-0000-000000000008', -1) $$,
  '23514', null, '(m) position negativa é recusada');
select throws_ok(
  format($$ insert into public.store_features (store_id, note) values ('a1000000-0000-0000-0000-000000000008', %L) $$,
         repeat('n', 281)),
  '23514', null, '(m) uma nota com 281 caracteres é recusada');
select throws_ok(
  $$ insert into public.store_features (store_id, note) values ('a1000000-0000-0000-0000-000000000008', E'Nota\x01') $$,
  '23514', 'INVALID_TEXT', '(m) uma nota com caracteres de controlo é recusada');
select throws_ok(
  $$ insert into public.store_features (store_id) values ('a1000000-0000-0000-0000-000000000001') $$,
  '23505', null, '(m) no máximo um destaque admin ativo por loja');
select throws_ok(
  $$ insert into public.store_features (store_id) values ('00000000-0000-0000-0000-000000000000') $$,
  '23503', null, '(m) um destaque de uma loja que não existe é recusado');
select throws_ok(
  $$ delete from public.stores where id = 'a1000000-0000-0000-0000-000000000001' $$,
  '23503', null, '(m) uma loja em destaque não se apaga (restrict)');

-- list_featured_stores como anon (ponto a vigiar 6).
set local role anon;

select results_eq(
  $$ select slug, source from public.list_featured_stores() $$,
  $$ values ('destaque-periodo-atual'::text, 'admin'::public.feature_source),
            ('destaque-sem-periodo'::text, 'admin'::public.feature_source),
            ('destaque-empate'::text, 'admin'::public.feature_source),
            ('destaque-inicio-agora'::text, 'admin'::public.feature_source) $$,
  '(m) só os destaques ativos, no período e de lojas aprovadas, por position e depois created_at');
select ok(
  exists (select 1 from public.list_featured_stores() where slug = 'destaque-sem-periodo'),
  '(m) o destaque ativo sem período aparece');
select ok(
  exists (select 1 from public.list_featured_stores() where slug = 'destaque-periodo-atual'),
  '(m) o destaque de período atual aparece');
select ok(
  not exists (select 1 from public.list_featured_stores()
               where slug in ('destaque-passado', 'destaque-futuro', 'destaque-inativo', 'destaque-suspensa',
                              'destaque-fim-agora')),
  '(m) não aparecem os de período passado, futuro, terminado agora, inativos nem de loja suspensa');
select results_eq(
  $$ select name, slug, description, category_name, category_slug, logo_path, published_products_count,
            rating_avg, rating_count, source
       from public.list_featured_stores() where slug = 'destaque-sem-periodo' $$,
  $$ values ('Destaque Sem Período'::text, 'destaque-sem-periodo'::text, ''::text, 'Doces'::text, 'doces'::text,
             null::text, 0, null::numeric, 0, 'admin'::public.feature_source) $$,
  '(m) list_featured_stores devolve as colunas de list_stores e source');
select throws_ok($$ select note from public.list_featured_stores() $$, '42703', null,
  '(m) list_featured_stores não tem a coluna note');
select throws_ok($$ select created_by from public.list_featured_stores() $$, '42703', null,
  '(m) list_featured_stores não tem a coluna created_by');
select throws_ok($$ select updated_by from public.list_featured_stores() $$, '42703', null,
  '(m) list_featured_stores não tem a coluna updated_by');
select throws_ok($$ select id from public.store_features $$, '42501', null, '(m) anon não lê store_features');
select throws_ok($$ select public.admin_list_store_features() $$, '42501', null,
  '(m) anon não executa as funções de gestão');

reset role;

-- Não administrador: NOT_ALLOWED em cada uma das cinco funções.
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
set local role authenticated;

select throws_ok($$ select id from public.store_features $$, '42501', null, '(m) authenticated não lê store_features');
select ok(exists (select 1 from public.list_featured_stores()), '(m) authenticated também lê list_featured_stores');
select throws_ok($$ select * from public.admin_list_store_features() $$, 'P0001', 'NOT_ALLOWED',
  '(m) não administrador: admin_list_store_features dá NOT_ALLOWED');
select throws_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000008', 0, null, null, null) $$,
  'P0001', 'NOT_ALLOWED', '(m) não administrador: admin_save_store_feature dá NOT_ALLOWED');
select throws_ok(
  $$ select public.admin_set_store_feature_active('a2000000-0000-0000-0000-000000000001', false) $$,
  'P0001', 'NOT_ALLOWED', '(m) não administrador: admin_set_store_feature_active dá NOT_ALLOWED');
select throws_ok(
  $$ select public.admin_remove_store_feature('a2000000-0000-0000-0000-000000000001') $$,
  'P0001', 'NOT_ALLOWED', '(m) não administrador: admin_remove_store_feature dá NOT_ALLOWED');
select throws_ok(
  $$ select public.admin_reorder_store_features(array['a2000000-0000-0000-0000-000000000001'::uuid]) $$,
  'P0001', 'NOT_ALLOWED', '(m) não administrador: admin_reorder_store_features dá NOT_ALLOWED');

reset role;
select is((select count(*)::int from public.store_features where id = 'a2000000-0000-0000-0000-000000000001' and is_active),
  1, '(m) as chamadas recusadas não mudaram nada');

-- Administrador.
insert into public.admin_users (user_id) values ('10000000-0000-0000-0000-000000000009');
select pg_temp.as_user('10000000-0000-0000-0000-000000000009');
set local role authenticated;

select results_eq(
  $$ select id, store_slug, store_status, is_live from public.admin_list_store_features()
      where id in ('a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000003',
                   'a2000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000005')
      order by id $$,
  $$ values ('a2000000-0000-0000-0000-000000000001'::uuid, 'destaque-sem-periodo'::text, 'approved'::public.store_status, true),
            ('a2000000-0000-0000-0000-000000000003'::uuid, 'destaque-passado'::text, 'approved'::public.store_status, false),
            ('a2000000-0000-0000-0000-000000000005'::uuid, 'destaque-inativo'::text, 'approved'::public.store_status, false),
            ('a2000000-0000-0000-0000-000000000006'::uuid, 'destaque-suspensa'::text, 'suspended'::public.store_status, false) $$,
  '(m) admin_list_store_features diz se cada destaque aparece agora (is_live)');
select is(
  (select note from public.admin_list_store_features() where id = 'a2000000-0000-0000-0000-000000000001'),
  'Nota interna', '(m) admin_list_store_features mostra a nota interna');
select is(
  (select count(*)::int from public.admin_list_store_features() where id = 'a2000000-0000-0000-0000-000000000012'),
  0, '(m) admin_list_store_features não mostra destaques pagos');

-- Criar.
select set_config('test.f_new',
  public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000008', 5, null, null, E'  Nota \t  da   equipa ')::text,
  true);
select results_eq(
  $$ select store_id, source, position, starts_at, ends_at, is_active, note, is_live
       from public.admin_list_store_features() where id = current_setting('test.f_new')::uuid $$,
  $$ values ('a1000000-0000-0000-0000-000000000008'::uuid, 'admin'::public.feature_source, 5,
             null::timestamptz, null::timestamptz, true, 'Nota da equipa'::text, true) $$,
  '(m) admin_save_store_feature cria um destaque admin ativo, com a nota normalizada');
select ok(
  exists (select 1 from public.list_featured_stores() where slug = 'destaque-livre'),
  '(m) o destaque criado aparece em list_featured_stores');
select throws_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000008', 5, null, null, E'  Nota \t  da   equipa ') $$,
  'P0001', 'FEATURE_EXISTS', '(m) repetir a criação dá FEATURE_EXISTS');
select is(
  (select count(*)::int from public.admin_list_store_features() where store_id = 'a1000000-0000-0000-0000-000000000008'),
  1, '(m) repetir a criação não cria um segundo destaque');

-- Alterar.
select is(
  public.admin_save_store_feature(current_setting('test.f_new')::uuid, 'a1000000-0000-0000-0000-000000000008', 0,
    now() - interval '1 hour', now() + interval '1 hour', '   '),
  current_setting('test.f_new')::uuid, '(m) alterar devolve o mesmo id');
select results_eq(
  $$ select position, starts_at, ends_at, note, is_live
       from public.admin_list_store_features() where id = current_setting('test.f_new')::uuid $$,
  $$ values (0, now() - interval '1 hour', now() + interval '1 hour', null::text, true) $$,
  '(m) admin_save_store_feature altera o destaque (uma nota só com espaços fica nula)');

-- Erros de entrada.
select throws_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000005', 0, now(), now() - interval '1 hour', null) $$,
  'P0001', 'INVALID_PERIOD', '(m) fim antes do início dá INVALID_PERIOD');
select throws_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000005', 0, now(), now(), null) $$,
  'P0001', 'INVALID_PERIOD', '(m) fim igual ao início dá INVALID_PERIOD');
select throws_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000007', 0, null, null, null) $$,
  'P0001', 'STORE_NOT_APPROVED', '(m) uma loja pendente dá STORE_NOT_APPROVED');
select throws_ok(
  $$ select public.admin_save_store_feature(null, '00000000-0000-0000-0000-000000000000', 0, null, null, null) $$,
  'P0001', 'STORE_NOT_APPROVED', '(m) uma loja que não existe dá STORE_NOT_APPROVED');
select throws_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000001', 0, null, null, null) $$,
  'P0001', 'FEATURE_EXISTS', '(m) uma loja que já tem destaque ativo dá FEATURE_EXISTS');
select throws_ok(
  $$ select public.admin_save_store_feature(current_setting('test.f_new')::uuid, 'a1000000-0000-0000-0000-000000000001',
       0, null, null, null) $$,
  'P0001', 'FEATURE_EXISTS', '(m) mudar um destaque para uma loja que já tem destaque ativo dá FEATURE_EXISTS');
select throws_ok(
  $$ select public.admin_save_store_feature('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000008',
       0, null, null, null) $$,
  'P0001', 'NOT_FOUND', '(m) um p_id desconhecido dá NOT_FOUND');
select throws_ok(
  format($$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000005', 0, null, null, %L) $$,
         repeat('n', 281)),
  'P0001', 'INVALID_TEXT', '(m) uma nota com mais de 280 caracteres dá INVALID_TEXT, antes da escrita');
select lives_ok(
  format($$ select public.admin_save_store_feature(%L, 'a1000000-0000-0000-0000-000000000008', null, null, null, %L) $$,
         current_setting('test.f_new'), '  ' || repeat('n', 280) || '  '),
  '(m) uma nota com 280 caracteres depois de normalizada é aceite');
select is(
  (select position from public.admin_list_store_features() where id = current_setting('test.f_new')::uuid),
  0, '(m) p_position nulo ao alterar mantém a posição');
select throws_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000005', 0, null, null, E'Nota\x01') $$,
  'P0001', 'INVALID_TEXT', '(m) uma nota com caracteres de controlo dá INVALID_TEXT, antes da escrita');
select throws_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000005', -1, null, null, null) $$,
  'P0001', 'INVALID_POSITION', '(m) uma posição negativa dá INVALID_POSITION');

-- Ativar e desativar.
select lives_ok(
  $$ select public.admin_set_store_feature_active(current_setting('test.f_new')::uuid, false) $$,
  '(m) admin_set_store_feature_active desativa');
select ok(
  not exists (select 1 from public.list_featured_stores() where slug = 'destaque-livre'),
  '(m) um destaque desativado sai de list_featured_stores');
select lives_ok(
  $$ select public.admin_set_store_feature_active(current_setting('test.f_new')::uuid, false) $$,
  '(m) desativar outra vez não falha (idempotente)');
select results_eq(
  $$ select is_active, is_live from public.admin_list_store_features() where id = current_setting('test.f_new')::uuid $$,
  $$ values (false, false) $$, '(m) o destaque continua desativado');
select throws_ok(
  $$ select public.admin_set_store_feature_active('00000000-0000-0000-0000-000000000000', true) $$,
  'P0001', 'NOT_FOUND', '(m) ativar um id desconhecido dá NOT_FOUND');
-- Com o primeiro desativado, pode criar-se outro para a mesma loja; reativar o
-- primeiro dá então FEATURE_EXISTS.
select set_config('test.f_other',
  public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000008', 0, null, null, null)::text, true);
select throws_ok(
  $$ select public.admin_set_store_feature_active(current_setting('test.f_new')::uuid, true) $$,
  'P0001', 'FEATURE_EXISTS', '(m) reativar quando a loja já tem outro destaque ativo dá FEATURE_EXISTS');
select lives_ok(
  $$ select public.admin_remove_store_feature(current_setting('test.f_other')::uuid) $$,
  '(m) admin_remove_store_feature apaga um destaque');
select lives_ok(
  $$ select public.admin_set_store_feature_active(current_setting('test.f_new')::uuid, true) $$,
  '(m) admin_set_store_feature_active reativa');
select is(
  (select position from public.admin_list_store_features() where id = current_setting('test.f_new')::uuid),
  (select max(position) + 1 from public.admin_list_store_features()
    where is_active and id <> current_setting('test.f_new')::uuid),
  '(m) um destaque reativado vai para o fim da ordem');
select lives_ok(
  $$ select public.admin_set_store_feature_active(current_setting('test.f_new')::uuid, true) $$,
  '(m) ativar outra vez não falha (idempotente)');
select is(
  (select position from public.admin_list_store_features() where id = current_setting('test.f_new')::uuid),
  (select max(position) + 1 from public.admin_list_store_features()
    where is_active and id <> current_setting('test.f_new')::uuid),
  '(m) ativar outra vez não muda a posição');
select throws_ok(
  $$ select public.admin_set_store_feature_active('a2000000-0000-0000-0000-000000000014', true) $$,
  'P0001', 'STORE_NOT_APPROVED', '(m) ligar um destaque de uma loja não aprovada dá STORE_NOT_APPROVED');
select is(
  (select is_active from public.admin_list_store_features() where id = 'a2000000-0000-0000-0000-000000000014'),
  false, '(m) o destaque da loja não aprovada continua desligado');
select lives_ok(
  $$ select public.admin_set_store_feature_active('a2000000-0000-0000-0000-000000000006', false) $$,
  '(m) desligar um destaque de uma loja suspensa é permitido');
select ok(
  exists (select 1 from public.list_featured_stores() where slug = 'destaque-livre'),
  '(m) o destaque reativado volta a list_featured_stores');

-- Ordenar. Regra: p_ids tem de ser exatamente o conjunto dos destaques admin
-- ativos (is_active), em qualquer período.
select set_config('test.order',
  (select array_agg(id order by position desc, id desc)
     from public.admin_list_store_features() where is_active)::text, true);
select lives_ok(
  $$ select public.admin_reorder_store_features(current_setting('test.order')::uuid[]) $$,
  '(m) admin_reorder_store_features aceita o conjunto dos destaques ativos');
select is(
  (select array_agg(id order by position) from public.admin_list_store_features() where is_active),
  current_setting('test.order')::uuid[], '(m) a ordem passa a ser a do array');
select is(
  (select array_agg(position order by position) from public.admin_list_store_features() where is_active),
  (select array_agg(g - 1) from generate_series(1, cardinality(current_setting('test.order')::uuid[])) g),
  '(m) position é o índice no array, a contar de 0');
-- O array inverte a ordem: o primeiro é o que estava no fim (o reativado).
select is(
  (select slug from public.list_featured_stores() limit 1), 'destaque-livre',
  '(m) list_featured_stores segue a nova ordem');

select throws_ok(
  $$ select public.admin_reorder_store_features(
       '00000000-0000-0000-0000-000000000000'::uuid || current_setting('test.order')::uuid[]) $$,
  'P0001', 'NOT_FOUND', '(m) um id desconhecido dá NOT_FOUND');
select throws_ok(
  $$ select public.admin_reorder_store_features(
       current_setting('test.order')::uuid[] || (current_setting('test.order')::uuid[])[1]) $$,
  'P0001', 'NOT_FOUND', '(m) um id repetido dá NOT_FOUND');
select throws_ok(
  $$ select public.admin_reorder_store_features((current_setting('test.order')::uuid[])[2:]) $$,
  'P0001', 'NOT_FOUND', '(m) faltar um destaque ativo dá NOT_FOUND');
select throws_ok(
  $$ select public.admin_reorder_store_features(
       current_setting('test.order')::uuid[] || 'a2000000-0000-0000-0000-000000000005'::uuid) $$,
  'P0001', 'NOT_FOUND', '(m) um destaque inativo no array dá NOT_FOUND');
select throws_ok(
  $$ select public.admin_reorder_store_features(
       current_setting('test.order')::uuid[] || 'a2000000-0000-0000-0000-000000000012'::uuid) $$,
  'P0001', 'NOT_FOUND', '(m) um destaque pago no array dá NOT_FOUND');
select throws_ok(
  $$ select public.admin_reorder_store_features(null) $$,
  'P0001', 'NOT_FOUND', '(m) um array nulo, com destaques ativos, dá NOT_FOUND');
select is(
  (select array_agg(id order by position) from public.admin_list_store_features() where is_active),
  current_setting('test.order')::uuid[], '(m) as ordenações recusadas não mudaram nada');

-- Remover.
select lives_ok(
  $$ select public.admin_remove_store_feature(current_setting('test.f_new')::uuid) $$,
  '(m) admin_remove_store_feature apaga o destaque');
select is(
  (select count(*)::int from public.admin_list_store_features() where id = current_setting('test.f_new')::uuid),
  0, '(m) o destaque apagado já não existe');
select throws_ok(
  $$ select public.admin_remove_store_feature(current_setting('test.f_new')::uuid) $$,
  'P0001', 'NOT_FOUND', '(m) apagar outra vez dá NOT_FOUND');

reset role;

-- Autoria (como postgres).
select set_config('request.jwt.claims', '', true);
select pg_temp.as_user('10000000-0000-0000-0000-000000000009');
set local role authenticated;
select set_config('test.f_created',
  public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000008', 0, null, null, null)::text, true);
reset role;
select results_eq(
  $$ select created_by, updated_by from public.store_features where id = current_setting('test.f_created')::uuid $$,
  $$ values ('10000000-0000-0000-0000-000000000009'::uuid, '10000000-0000-0000-0000-000000000009'::uuid) $$,
  '(m) created_by e updated_by ficam com o administrador');

-- Proteção do pago: as funções de gestão não mexem em linhas source = 'paid'.
insert into public.store_features (id, store_id, source, position, note)
values ('a2000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000008', 'paid', 7, 'Pago');
set local role authenticated;
select throws_ok(
  $$ select public.admin_save_store_feature('a2000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000008',
       0, null, null, 'Mudado') $$,
  'P0001', 'NOT_FOUND', '(m) admin_save_store_feature dá NOT_FOUND num destaque pago');
select throws_ok(
  $$ select public.admin_set_store_feature_active('a2000000-0000-0000-0000-000000000013', false) $$,
  'P0001', 'NOT_FOUND', '(m) admin_set_store_feature_active dá NOT_FOUND num destaque pago');
select throws_ok(
  $$ select public.admin_remove_store_feature('a2000000-0000-0000-0000-000000000013') $$,
  'P0001', 'NOT_FOUND', '(m) admin_remove_store_feature dá NOT_FOUND num destaque pago');
reset role;
select results_eq(
  $$ select source, position, is_active, note from public.store_features where id = 'a2000000-0000-0000-0000-000000000013' $$,
  $$ values ('paid'::public.feature_source, 7, true, 'Pago'::text) $$,
  '(m) o destaque pago ficou igual');
select set_config('request.jwt.claims', '', true);

-- Uma loja que passa a suspended sai dos destaques.
update public.stores set status = 'suspended' where id = 'a1000000-0000-0000-0000-000000000002';
set local role anon;
select ok(
  not exists (select 1 from public.list_featured_stores() where slug = 'destaque-periodo-atual'),
  '(m) o destaque de uma loja que passou a suspended não aparece');
reset role;

-- Destaque terminado ainda ativo: criar outro para a mesma loja desliga o
-- terminado na mesma transação e põe o novo no fim da ordem. Um destaque no
-- ar ou agendado continua a dar FEATURE_EXISTS.
select pg_temp.as_user('10000000-0000-0000-0000-000000000009');
set local role authenticated;
select set_config('test.end_before',
  (select coalesce(max(position) + 1, 0) from public.admin_list_store_features()
    where is_active and id <> 'a2000000-0000-0000-0000-000000000003')::text, true);
select set_config('test.f_refeature',
  public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000003', null, null, null, null)::text, true);
select is(
  (select is_active from public.admin_list_store_features() where id = 'a2000000-0000-0000-0000-000000000003'),
  false, '(m) criar um destaque para uma loja com destaque terminado desliga o terminado');
select results_eq(
  $$ select is_active, is_live from public.admin_list_store_features() where id = current_setting('test.f_refeature')::uuid $$,
  $$ values (true, true) $$, '(m) o novo destaque da loja com destaque terminado fica ativo e no ar');
select is(
  (select position from public.admin_list_store_features() where id = current_setting('test.f_refeature')::uuid),
  current_setting('test.end_before')::int,
  '(m) sem posição, o destaque criado vai para o fim da ordem dos ativos');
select lives_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000009', null, null, null, null) $$,
  '(m) um destaque que terminou exatamente agora (ends_at = now()) também é substituído');
select throws_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000002', null, null, null, null) $$,
  'P0001', 'FEATURE_EXISTS', '(m) uma loja com destaque no ar (dentro do período) dá FEATURE_EXISTS');
select throws_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000004', null, null, null, null) $$,
  'P0001', 'FEATURE_EXISTS', '(m) uma loja com destaque agendado dá FEATURE_EXISTS');
select results_eq(
  $$ select id, is_active from public.admin_list_store_features()
      where id in ('a2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000004') order by id $$,
  $$ values ('a2000000-0000-0000-0000-000000000002'::uuid, true), ('a2000000-0000-0000-0000-000000000004'::uuid, true) $$,
  '(m) os destaques no ar e agendados continuam ativos');
select throws_ok(
  $$ select public.admin_save_store_feature(null, 'a1000000-0000-0000-0000-000000000003', null, null, null, null) $$,
  'P0001', 'FEATURE_EXISTS', '(m) repetir a criação depois de substituir o terminado dá FEATURE_EXISTS');
select is(
  (select count(*)::int from public.store_features where store_id = 'a1000000-0000-0000-0000-000000000003'),
  2, '(m) a criação repetida não escreveu nada');
reset role;

-- Posições: as três funções que as atribuem tomam o mesmo trinco de
-- transação antes de ler max(position), para duas ativações ao mesmo tempo
-- não ficarem com a mesma posição.
select ok(
  (select bool_and(pg_get_functiondef(p.oid) like '%pg_advisory_xact_lock(%hashtext(''public.store_features:admin_position'')%')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_save_store_feature', 'admin_set_store_feature_active', 'admin_reorder_store_features')),
  '(m) save, set_active e reorder serializam as posições com o mesmo trinco');
select ok(
  exists (select 1 from pg_locks l
           where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.granted
             and l.objid = (hashtext('public.store_features:admin_position')::bigint & 4294967295)::oid),
  '(m) o trinco das posições fica preso até ao fim da transação');

-- No máximo 10 destaques.
select pg_temp.signup(('10000000-0000-0000-0000-0000000002' || lpad(g::text, 2, '0'))::uuid,
                      'limite' || g || '@exemplo.test')
  from generate_series(1, 12) g;
insert into public.stores (id, owner_id, name, slug, category_id, status, submitted_at, decided_at, decided_by)
select ('a3000000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid,
       ('10000000-0000-0000-0000-0000000002' || lpad(g::text, 2, '0'))::uuid,
       'Limite ' || g, 'limite-' || g, pg_temp.cat('doces'), 'approved', now(), now(),
       '10000000-0000-0000-0000-000000000009'
  from generate_series(1, 12) g;
insert into public.store_features (store_id, position)
select ('a3000000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid, 100 + g from generate_series(1, 12) g;
set local role anon;
select is((select count(*)::int from public.list_featured_stores()), 10, '(m) list_featured_stores devolve no máximo 10');
reset role;

select * from finish();
rollback;
