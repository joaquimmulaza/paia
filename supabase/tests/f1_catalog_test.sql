-- Testes pgTAP de F1 · Catálogo: categorias, lojas, produtos, imagens, RLS,
-- permissões por coluna, normalização e contadores.
-- Corre com `npm run db:test` (supabase test db), só contra a base local.
-- Tudo corre numa transação que termina em rollback: nada fica gravado.
-- O estado é preparado como postgres; cada bloco troca de papel com
-- `set local role` e volta com `reset role`.
begin;

create extension if not exists pgtap with schema extensions;

select plan(81);

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
grant execute on function pg_temp.cat(text) to service_role;

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

insert into public.stores (id, owner_id, name, slug, description, category_id, status, submitted_at, decided_at, decided_by)
values
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '  Doces   da Ana ', 'doces-da-ana',
   ' Bolos e  pastéis ', pg_temp.cat('doces'), 'approved', now(), now(), '10000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Loja Pendente', 'loja-pendente',
   '', pg_temp.cat('salgados'), 'pending_approval', now(), null, null),
  ('b0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Loja Suspensa', 'loja-suspensa',
   '', pg_temp.cat('snacks'), 'suspended', now(), now(), '10000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'Loja Contador', 'loja-contador',
   '', pg_temp.cat('outros'), 'approved', now(), now(), '10000000-0000-0000-0000-000000000009');

insert into public.products (id, store_id, category_id, name, description, price_kz, stock, is_published, moderation_status)
values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'),
   ' Pastéis   de nata ', 'Caixa de 6', 1500, 10, true, 'visible'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'),
   'Rascunho', '', 500, 1, false, 'visible'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'),
   'Escondido', '', 500, 1, true, 'hidden'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', pg_temp.cat('snacks'),
   'Da loja suspensa', '', 500, 1, true, 'visible'),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', pg_temp.cat('salgados'),
   'Da loja pendente', '', 500, 1, true, 'visible');

insert into public.product_images (id, product_id, path, position)
values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000/c0000000/0.webp', 0),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'b0000000/c0000003/0.webp', 0);

-- Categoria escondida, para ver que anon não a lê.
insert into public.categories (name, slug, position, is_visible) values ('Escondida', 'escondida', 8, false);

-- ===========================================================================
-- Normalização do texto livre
-- ===========================================================================
select is(
  (select name || '|' || description from public.stores where id = 'b0000000-0000-0000-0000-000000000001'),
  'Doces da Ana|Bolos e pastéis',
  'o nome e a descrição da loja ficam normalizados');
select is(
  (select name from public.products where id = 'c0000000-0000-0000-0000-000000000001'),
  'Pastéis de nata',
  'o nome do produto fica normalizado');
select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id)
     values ('10000000-0000-0000-0000-000000000005', E' \t ', 'loja-vazia', pg_temp.cat('doces')) $$,
  '23514', null, 'um nome de loja só com espaços é recusado');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values ('b0000000-0000-0000-0000-000000000001', pg_temp.cat('doces'), E'Bolo\x01', 100, 1) $$,
  '23514', 'INVALID_TEXT', 'um nome de produto com caracteres de controlo é recusado');

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
select throws_ok($$ select is_published from public.products $$, '42501', null, '(c) anon não lê products.is_published');
select throws_ok($$ select moderation_reason from public.products $$, '42501', null, '(c) anon não lê products.moderation_reason');
select throws_ok($$ select * from public.stores $$, '42501', null, '(c) anon não faz select * em stores');

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

select is(
  (select count(*)::int from public.product_images where product_id = 'c0000000-0000-0000-0000-000000000001'),
  1, '(e) anon vê a imagem do produto público');
select is(
  (select count(*)::int from public.product_images where product_id = 'c0000000-0000-0000-0000-000000000003'),
  0, '(e) anon não vê as imagens do produto hidden');

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
-- (f) Escrita como authenticated (a dona da loja aprovada)
-- ===========================================================================
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
set local role authenticated;

select is(
  (select count(*)::int from public.stores where id = 'b0000000-0000-0000-0000-000000000001'),
  1, 'authenticated lê a loja aprovada');
select is(
  (select count(*)::int from public.products where id = 'c0000000-0000-0000-0000-000000000002'),
  0, 'a dona não lê o seu produto não publicado pela leitura pública');

select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id)
     values ('10000000-0000-0000-0000-000000000001', 'Outra', 'outra-loja', '00000000-0000-0000-0000-000000000000') $$,
  '42501', null, '(f) a dona não insere em stores');
select throws_ok(
  $$ update public.stores set name = 'Mudado' where id = 'b0000000-0000-0000-0000-000000000001' $$,
  '42501', null, '(f) a dona não altera stores');
select throws_ok(
  $$ delete from public.stores where id = 'b0000000-0000-0000-0000-000000000001' $$,
  '42501', null, '(f) a dona não apaga stores');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Novo', 100, 1) $$,
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

update public.products set moderation_status = 'visible', store_id = 'b0000000-0000-0000-0000-000000000001'
 where id = 'c0000000-0000-0000-0000-000000000006';
select is(
  pg_temp.store_count('b0000000-0000-0000-0000-000000000004') || '|' || pg_temp.store_count('b0000000-0000-0000-0000-000000000001'),
  '0|2', '(g) mudar o produto de loja recalcula a antiga e a nova');

update public.products set is_published = false where id = 'c0000000-0000-0000-0000-000000000006';
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000001'), 1, '(g) despublicar desce a contagem');

-- O service_role (servidor) escreve e o contador acompanha.
set local role service_role;
insert into public.products (store_id, category_id, name, price_kz, stock, is_published)
values ('b0000000-0000-0000-0000-000000000004', pg_temp.cat('outros'), 'Do servidor', 100, 1, true);
reset role;
select is(pg_temp.store_count('b0000000-0000-0000-0000-000000000004'), 1, '(g) uma escrita do service_role atualiza o contador');

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
  $$ insert into public.categories (name, slug) values ('Má', 'Ma') $$,
  '23514', null, '(h) um slug de categoria com maiúsculas é recusado');
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

select throws_ok(
  $$ update public.stores set status = 'approved' where id = 'b0000000-0000-0000-0000-000000000002' $$,
  '23514', null, '(i) status = approved sem decided_at é recusado');
select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id, status, decided_at)
     values ('10000000-0000-0000-0000-000000000005', 'Rejeitada', 'rejeitada', pg_temp.cat('doces'), 'rejected', now()) $$,
  '23514', null, '(i) status = rejected sem decided_by é recusado');
select throws_ok(
  $$ insert into public.stores (owner_id, name, slug, category_id)
     values ('10000000-0000-0000-0000-000000000001', 'Segunda', 'segunda-loja', pg_temp.cat('doces')) $$,
  '23505', null, 'cada dono tem no máximo uma loja');

-- ON DELETE: imagens vão com o produto; uma loja com produtos não se apaga.
delete from public.products where id = 'c0000000-0000-0000-0000-000000000003';
select is(
  (select count(*)::int from public.product_images where id = 'd0000000-0000-0000-0000-000000000002'),
  0, 'apagar o produto apaga as suas imagens (cascade)');
select throws_ok(
  $$ delete from public.stores where id = 'b0000000-0000-0000-0000-000000000001' $$,
  '23503', null, 'uma loja com produtos não se apaga (restrict)');

-- ===========================================================================
-- (j) Funções e privilégios
-- ===========================================================================
select ok(not has_function_privilege('anon', 'private.recalc_store_counters(uuid)', 'execute'),
  '(j) anon não executa private.recalc_store_counters');
select ok(not has_function_privilege('authenticated', 'private.recalc_store_counters(uuid)', 'execute'),
  '(j) authenticated não executa private.recalc_store_counters');
select ok(has_function_privilege('anon', 'private.is_store_public(uuid)', 'execute'),
  'anon executa private.is_store_public');
select ok(has_function_privilege('anon', 'private.is_product_public(uuid)', 'execute'),
  'anon executa private.is_product_public');
select ok(not has_function_privilege('anon', 'private.is_admin()', 'execute'),
  'a USAGE em private não abre private.is_admin a anon');
select ok(not has_function_privilege('anon', 'private.normalize_text(text)', 'execute'),
  'a USAGE em private não abre private.normalize_text a anon');
select is(private.is_product_public('c0000000-0000-0000-0000-000000000002'), false,
  'is_product_public dá falso para um produto não publicado');
select is(private.is_store_public('b0000000-0000-0000-0000-000000000003'), false,
  'is_store_public dá falso para uma loja suspensa');

select ok(
  (select bool_and(has_table_privilege('service_role', t, p))
     from unnest(array['public.categories', 'public.stores', 'public.products', 'public.product_images']) t,
          unnest(array['select', 'insert', 'update', 'delete']) p),
  'service_role tem select, insert, update e delete nas quatro tabelas');
select ok(
  not (select bool_or(has_table_privilege(r, t, p))
         from unnest(array['anon', 'authenticated']) r,
              unnest(array['public.categories', 'public.stores', 'public.products', 'public.product_images']) t,
              unnest(array['insert', 'update', 'delete', 'truncate']) p),
  'anon e authenticated não têm nenhum privilégio de escrita nas quatro tabelas');

select * from finish();
rollback;
