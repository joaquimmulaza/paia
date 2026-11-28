-- Testes pgTAP de F2 · Vender, tarefa 1: a loja do vendedor no servidor
-- (endereço gerado a partir do nome, rascunho, envio e leitura da própria
-- loja) e o fecho de store_decisions ao cliente.
-- Corre com `npm run db:test` (supabase test db), só contra a base local.
-- Tudo corre numa transação que termina em rollback: nada fica gravado.
-- O estado é preparado como postgres; cada bloco troca de papel com
-- `set local role` e volta com `reset role`.
begin;

create extension if not exists pgtap with schema extensions;

select plan(60);

-- Os testes não dependem do seed: dentro desta transação apagam-se as
-- decisões, os destaques, as lojas, os produtos e as imagens que o seed
-- criou (o rollback final repõe-nos). As FKs para stores são restrict.
delete from public.store_decisions;
delete from public.store_features;
delete from public.product_images;
delete from public.products;
delete from public.stores;

-- Utilitários de teste. signup recebe o vínculo; os dados académicos vão
-- sempre e são ignorados para quem não é estudante.
create function pg_temp.signup(p_id uuid, p_email text, p_affiliation text)
returns void
language sql
as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, '',
          jsonb_build_object(
            'full_name', 'Pessoa Teste', 'phone', '912345678', 'affiliation', p_affiliation, 'terms_accepted', true,
            'academic', jsonb_build_object(
              'course', 'Curso de exemplo', 'curricular_year', '2.º ano', 'shift', 'Manhã', 'class_group', 'A')),
          now(), now());
$$;

create function pg_temp.as_user(p_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated, anon;

create function pg_temp.cat(p_slug text)
returns uuid
language sql
as $$
  select id from public.categories where slug = p_slug;
$$;
grant execute on function pg_temp.cat(text) to authenticated;

create function pg_temp.store_of(p_owner uuid)
returns public.stores
language sql
as $$
  select s from public.stores s where s.owner_id = p_owner;
$$;

-- Ids das lojas guardados como postgres, para os blocos como authenticated
-- (que não leem lojas fora de approved) montarem caminhos.
create temp table t_store (owner uuid primary key, id uuid not null);
grant select on t_store to authenticated;
create temp table t_ret (id uuid);
grant insert on t_ret to authenticated;

-- ===========================================================================
-- Preparação (como postgres)
-- ===========================================================================
select pg_temp.signup('20000000-0000-0000-0000-000000000001', 'ana1@exemplo.test', 'student');
select pg_temp.signup('20000000-0000-0000-0000-000000000002', 'ana2@exemplo.test', 'student');
select pg_temp.signup('20000000-0000-0000-0000-000000000003', 'ana3@exemplo.test', 'student');
select pg_temp.signup('20000000-0000-0000-0000-000000000004', 'estrelas@exemplo.test', 'student');
select pg_temp.signup('20000000-0000-0000-0000-000000000005', 'aprovada@exemplo.test', 'student');
select pg_temp.signup('20000000-0000-0000-0000-000000000006', 'sem.loja@exemplo.test', 'student');
select pg_temp.signup('20000000-0000-0000-0000-000000000007', 'docente@exemplo.test', 'teacher');
select pg_temp.signup('20000000-0000-0000-0000-000000000008', 'oito@exemplo.test', 'student');

-- ===========================================================================
-- (a) Endereço-base a partir do nome
-- ===========================================================================
select is(private.store_slug_base('Pão & Café'), 'pao-cafe', '(a) «Pão & Café» dá pao-cafe');
select is(private.store_slug_base('  Doces da Ana  '), 'doces-da-ana', '(a) os espaços das pontas saem');
select is(private.store_slug_base('☆☆'), '', '(a) um nome só de símbolos dá vazio');
select is(char_length(private.store_slug_base(repeat('a', 60))), 40, '(a) um nome de 60 caracteres sem espaços dá 40');
select is(private.store_slug_base('Loja -- Ü'), 'loja-u', '(a) sequências de símbolos dão um só hífen e os acentos saem');
select is(
  private.store_slug_base(repeat('a', 39) || ' b'), repeat('a', 39),
  '(a) o corte aos 40 não deixa hífen no fim');

-- ===========================================================================
-- (b) Rascunho e colisões de endereço
-- ===========================================================================
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
insert into t_ret select public.save_my_store('Doces da Ana', '  Bolos  ', pg_temp.cat('doces'), null, null);
reset role;

-- O trinco de transação do endereço fica tomado (chave de 64 bits:
-- classid = 32 bits altos, objid = 32 bits baixos, objsubid = 1).
select ok(
  exists (
    select 1 from pg_locks
     where locktype = 'advisory' and pid = pg_backend_pid() and objsubid = 1 and granted
       and classid::bigint = ((hashtext('public.stores:slug')::bigint >> 32) & 4294967295)
       and objid::bigint = (hashtext('public.stores:slug')::bigint & 4294967295)),
  '(b) save_my_store toma pg_advisory_xact_lock(hashtext(''public.stores:slug''))');

insert into t_store select owner_id, id from public.stores where owner_id = '20000000-0000-0000-0000-000000000001';
select is((select id from t_ret), (select id from t_store where owner = '20000000-0000-0000-0000-000000000001'),
  '(b) save_my_store devolve o id da loja');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000001')).slug, 'doces-da-ana', '(b) a primeira «Doces da Ana» fica doces-da-ana');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000001')).status, 'draft'::public.store_status, '(b) a loja nova fica em draft');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000001')).description, 'Bolos', '(b) a descrição fica normalizada');

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select public.save_my_store('Doces da Ana', '', pg_temp.cat('doces'), null, null);
select pg_temp.as_user('20000000-0000-0000-0000-000000000003');
select public.save_my_store('Doces da Ana', '', pg_temp.cat('doces'), null, null);
select pg_temp.as_user('20000000-0000-0000-0000-000000000004');
select public.save_my_store('☆☆', '', pg_temp.cat('outros'), null, null);
reset role;

insert into t_store select owner_id, id from public.stores where owner_id = '20000000-0000-0000-0000-000000000002';
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000002')).slug, 'doces-da-ana-2', '(b) a segunda «Doces da Ana» fica doces-da-ana-2');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000003')).slug, 'doces-da-ana-3', '(b) a terceira «Doces da Ana» fica doces-da-ana-3');
select matches((pg_temp.store_of('20000000-0000-0000-0000-000000000004')).slug, '^loja-[a-z]{4}$', '(b) «☆☆» fica loja- mais 4 letras');

-- Guardar sem mudar o endereço-base mantém o endereço atual.
create temp table t_slug as select (pg_temp.store_of('20000000-0000-0000-0000-000000000004')).slug;
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000004');
select public.save_my_store('☆☆', 'Agora com descrição', pg_temp.cat('outros'), null, null);
select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select public.save_my_store('Doces da Ana', 'Outra descrição', pg_temp.cat('doces'), null, null);
reset role;

select is((pg_temp.store_of('20000000-0000-0000-0000-000000000004')).slug, (select slug from t_slug),
  '(b) guardar outra vez «☆☆» mantém o mesmo loja-xxxx');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000002')).slug, 'doces-da-ana-2',
  '(b) a segunda «Doces da Ana» guardada só com outra descrição mantém doces-da-ana-2');

-- Guardar outra vez altera a mesma loja; em draft o endereço segue o nome.
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
select public.save_my_store('Doces da Ana', 'Bolos e doces', pg_temp.cat('doces'), null, null);
select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select public.save_my_store('Salgados do Bruno', '', pg_temp.cat('salgados'), null, null);
reset role;

select is((select count(*)::int from public.stores where owner_id = '20000000-0000-0000-0000-000000000001'), 1,
  '(b) guardar outra vez não cria uma segunda loja');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000001')).description, 'Bolos e doces', '(b) guardar outra vez altera a loja');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000002')).slug, 'salgados-do-bruno', '(b) em draft o endereço muda com o nome');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000002')).category_id, pg_temp.cat('salgados'), '(b) a categoria muda');

-- doces-da-ana-2 ficou livre; a terceira, guardada sem mudar o nome, não salta para lá.
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000003');
select public.save_my_store('Doces da Ana', 'Nova descrição', pg_temp.cat('doces'), null, null);
reset role;
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000003')).slug, 'doces-da-ana-3',
  '(b) com o mesmo endereço-base, o endereço não muda mesmo havendo um mais curto livre');

-- ===========================================================================
-- (c) Endereço fixo depois de aprovada
-- ===========================================================================
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000005');
select public.save_my_store('Gelados Frescos', 'Gelados', pg_temp.cat('gelados'), null, null);
reset role;

update public.stores
   set status = 'approved', submitted_at = now(), decided_at = now(), decided_by = '20000000-0000-0000-0000-000000000007'
 where owner_id = '20000000-0000-0000-0000-000000000005';

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000005');
select public.save_my_store('Outro Nome', 'Gelados', pg_temp.cat('gelados'), null, null);
reset role;

select is((pg_temp.store_of('20000000-0000-0000-0000-000000000005')).slug, 'gelados-frescos', '(c) aprovada, o endereço não muda com o nome');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000005')).name, 'Outro Nome', '(c) aprovada, o nome muda');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000005')).status, 'approved'::public.store_status, '(c) editar uma loja aprovada não volta a análise');

-- ===========================================================================
-- (d) Erros de save_my_store
-- ===========================================================================
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000007');
select throws_ok($$ select public.save_my_store('Loja da Docente', '', pg_temp.cat('doces'), null, null) $$,
  'P0001', 'NOT_STUDENT', '(d) uma conta teacher não cria loja');

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok($$ select public.save_my_store('Sem conta', '', pg_temp.cat('doces'), null, null) $$,
  'P0001', 'NOT_AUTHENTICATED', '(d) sem sub no JWT dá NOT_AUTHENTICATED');

select pg_temp.as_user('20000000-0000-0000-0000-000000000006');
select throws_ok($$ select public.save_my_store(E' \t ', '', pg_temp.cat('doces'), null, null) $$,
  'P0001', 'INVALID_TEXT', '(d) um nome só com espaços dá INVALID_TEXT');
select throws_ok($$ select public.save_my_store(repeat('a', 61), '', pg_temp.cat('doces'), null, null) $$,
  'P0001', 'INVALID_TEXT', '(d) um nome com 61 caracteres dá INVALID_TEXT');
select throws_ok($$ select public.save_my_store('Loja', repeat('a', 281), pg_temp.cat('doces'), null, null) $$,
  'P0001', 'INVALID_TEXT', '(d) uma descrição com 281 caracteres dá INVALID_TEXT');
select throws_ok($$ select public.save_my_store('Loja', '', gen_random_uuid(), null, null) $$,
  'P0001', 'CATEGORY_NOT_FOUND', '(d) uma categoria que não existe dá CATEGORY_NOT_FOUND');

-- Caminhos: o de outra loja, um com «../» e um válido.
select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select throws_ok(
  format($$ select public.save_my_store('Salgados do Bruno', '', pg_temp.cat('salgados'), %L, null) $$,
         'stores/' || (select id from t_store where owner = '20000000-0000-0000-0000-000000000001') || '/logo-' || gen_random_uuid() || '.webp'),
  'P0001', 'INVALID_PATH', '(d) o logótipo no caminho de outra loja dá INVALID_PATH');
select throws_ok(
  format($$ select public.save_my_store('Salgados do Bruno', '', pg_temp.cat('salgados'), null, %L) $$,
         'stores/' || (select id from t_store where owner = '20000000-0000-0000-0000-000000000002') || '/../'
           || (select id from t_store where owner = '20000000-0000-0000-0000-000000000001') || '/cover-' || gen_random_uuid() || '.webp'),
  'P0001', 'INVALID_PATH', '(d) a capa com «../» dá INVALID_PATH');
select throws_ok(
  format($$ select public.save_my_store('Salgados do Bruno', '', pg_temp.cat('salgados'), %L, null) $$,
         'stores/' || (select id from t_store where owner = '20000000-0000-0000-0000-000000000002') || '/cover-' || gen_random_uuid() || '.webp'),
  'P0001', 'INVALID_PATH', '(d) uma capa no lugar do logótipo dá INVALID_PATH');
select lives_ok(
  format($$ select public.save_my_store('Salgados do Bruno', '', pg_temp.cat('salgados'), %L, %L) $$,
         'stores/' || (select id from t_store where owner = '20000000-0000-0000-0000-000000000002') || '/logo-' || gen_random_uuid() || '.webp',
         'stores/' || (select id from t_store where owner = '20000000-0000-0000-0000-000000000002') || '/cover-' || gen_random_uuid() || '.webp'),
  '(d) o logótipo e a capa da própria loja são aceites');
reset role;

select matches((pg_temp.store_of('20000000-0000-0000-0000-000000000002')).logo_path, '^stores/[0-9a-f-]{36}/logo-[0-9a-f-]{36}\.webp$',
  '(d) o logótipo fica guardado');
select is((select count(*)::int from public.stores where owner_id = '20000000-0000-0000-0000-000000000006'), 0,
  '(d) uma gravação recusada não cria loja');

-- ===========================================================================
-- (e) Envio para análise
-- ===========================================================================
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000006');
select throws_ok($$ select public.submit_my_store() $$, 'P0001', 'NO_STORE', '(e) sem loja dá NO_STORE');

select pg_temp.as_user('20000000-0000-0000-0000-000000000008');
select public.save_my_store('Loja Oito', 'Vendo coisas', pg_temp.cat('outros'), null, null);
select throws_ok($$ select public.submit_my_store() $$, 'P0001', 'STORE_INCOMPLETE', '(e) sem logótipo dá STORE_INCOMPLETE');
reset role;

insert into t_store select owner_id, id from public.stores where owner_id = '20000000-0000-0000-0000-000000000008';

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000008');
select public.save_my_store('Loja Oito', '', pg_temp.cat('outros'),
  'stores/' || (select id from t_store where owner = '20000000-0000-0000-0000-000000000008') || '/logo-' || gen_random_uuid() || '.webp', null);
select throws_ok($$ select public.submit_my_store() $$, 'P0001', 'STORE_INCOMPLETE', '(e) sem descrição dá STORE_INCOMPLETE');
select public.save_my_store('Loja Oito', 'Vendo coisas', pg_temp.cat('outros'),
  'stores/' || (select id from t_store where owner = '20000000-0000-0000-0000-000000000008') || '/logo-' || gen_random_uuid() || '.webp', null);
select is(public.submit_my_store(), 'pending_approval'::public.store_status, '(e) com tudo, passa a pending_approval');
select is(public.submit_my_store(), 'pending_approval'::public.store_status, '(e) repetir devolve pending_approval');
select throws_ok($$ select public.save_my_store('Loja Oito', 'Vendo coisas', pg_temp.cat('outros'), null, null) $$,
  'P0001', 'STORE_LOCKED', '(e) em pending_approval, guardar dá STORE_LOCKED');
select pg_temp.as_user('20000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.submit_my_store() $$, 'P0001', 'INVALID_TRANSITION', '(e) aprovada, enviar dá INVALID_TRANSITION');
reset role;

select ok((pg_temp.store_of('20000000-0000-0000-0000-000000000008')).submitted_at is not null, '(e) o envio grava submitted_at');

-- Recusada: guardar recalcula o endereço e enviar limpa a decisão.
update public.stores
   set status = 'rejected', decided_at = now(), decided_by = '20000000-0000-0000-0000-000000000007'
 where owner_id = '20000000-0000-0000-0000-000000000008';
insert into public.store_decisions (store_id, admin_id, decision, message, created_at)
values ((select id from t_store where owner = '20000000-0000-0000-0000-000000000008'),
        '20000000-0000-0000-0000-000000000007', 'rejected', 'Falta a foto', now() - interval '1 minute');

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000008');
select public.save_my_store('Loja Oito Nova', 'Vendo coisas', pg_temp.cat('outros'),
  'stores/' || (select id from t_store where owner = '20000000-0000-0000-0000-000000000008') || '/logo-' || gen_random_uuid() || '.webp', null);
select is(public.submit_my_store(), 'pending_approval'::public.store_status, '(e) recusada, voltar a enviar dá pending_approval');
reset role;

select is((pg_temp.store_of('20000000-0000-0000-0000-000000000008')).slug, 'loja-oito-nova', '(e) recusada, o endereço muda com o nome');
select ok(
  (pg_temp.store_of('20000000-0000-0000-0000-000000000008')).decided_at is null
  and (pg_temp.store_of('20000000-0000-0000-0000-000000000008')).decided_by is null,
  '(e) voltar a enviar limpa decided_at e decided_by');

-- Suspensa: guardar e enviar estão fechados.
update public.stores set status = 'suspended' where owner_id = '20000000-0000-0000-0000-000000000005';
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.save_my_store('Outro Nome', 'Gelados', pg_temp.cat('gelados'), null, null) $$,
  'P0001', 'STORE_LOCKED', '(e) suspensa, guardar dá STORE_LOCKED');
select throws_ok($$ select public.submit_my_store() $$, 'P0001', 'INVALID_TRANSITION', '(e) suspensa, enviar dá INVALID_TRANSITION');
reset role;

-- ===========================================================================
-- (f) store_decisions fechada ao cliente
-- ===========================================================================
select ok((select relrowsecurity from pg_class where oid = 'public.store_decisions'::regclass), '(f) RLS ligada em store_decisions');
select throws_ok(
  $$ insert into public.store_decisions (store_id, admin_id, decision) values
       ((select id from t_store where owner = '20000000-0000-0000-0000-000000000008'), '20000000-0000-0000-0000-000000000007', 'rejected') $$,
  '23514', null, '(f) uma recusa sem mensagem é recusada');

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000008');
select throws_ok($$ select * from public.store_decisions $$, '42501', null, '(f) authenticated não lê store_decisions');
select throws_ok(
  $$ insert into public.store_decisions (store_id, admin_id, decision, message) values
       ((select id from t_store where owner = '20000000-0000-0000-0000-000000000008'), '20000000-0000-0000-0000-000000000008', 'approved', null) $$,
  '42501', null, '(f) authenticated não escreve em store_decisions');
reset role;

-- ===========================================================================
-- (g) get_my_store e get_my_store_decisions
-- ===========================================================================
insert into public.products (store_id, category_id, name, price_kz, stock, is_published)
select t.id, pg_temp.cat('outros'), p.name, 100, p.stock, p.is_published
  from t_store t,
       (values ('Escondido', 3, false), ('Esgotado', 0, true), ('À venda', 5, true)) as p (name, stock, is_published)
 where t.owner = '20000000-0000-0000-0000-000000000008';

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000006');
select is((select count(*)::int from public.get_my_store()), 0, '(g) get_my_store devolve 0 linhas a quem não tem loja');

select pg_temp.as_user('20000000-0000-0000-0000-000000000008');
select results_eq(
  $$ select name, slug, status, hidden_products_count, sold_out_products_count, published_products_count, last_message
       from public.get_my_store() $$,
  $$ values ('Loja Oito Nova'::text, 'loja-oito-nova'::text, 'pending_approval'::public.store_status, 1, 1, 2, 'Falta a foto'::text) $$,
  '(g) get_my_store devolve a loja, os contadores e a última mensagem');
select results_eq(
  $$ select decision, message from public.get_my_store_decisions() $$,
  $$ values ('rejected'::public.store_decision, 'Falta a foto'::text) $$,
  '(g) get_my_store_decisions devolve as decisões da própria loja');

select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.get_my_store_decisions()), 0, '(g) as decisões de outra loja não aparecem');
reset role;

-- ===========================================================================
-- (h) anon não chama as funções do vendedor
-- ===========================================================================
set local role anon;
select throws_ok($$ select public.save_my_store('Loja', '', null, null, null) $$, '42501', null, '(h) anon não chama save_my_store');
select throws_ok($$ select public.submit_my_store() $$, '42501', null, '(h) anon não chama submit_my_store');
select throws_ok($$ select * from public.get_my_store() $$, '42501', null, '(h) anon não chama get_my_store');
reset role;

select * from finish();
rollback;
