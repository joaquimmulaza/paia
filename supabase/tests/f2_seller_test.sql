-- Testes pgTAP de F2 · Vender, tarefas 1 a 3: a loja do vendedor no servidor
-- (endereço gerado a partir do nome, rascunho, envio e leitura da própria
-- loja), o fecho de store_decisions ao cliente, a decisão da administração e
-- os produtos, as fotos e o Storage do vendedor.
-- Corre com `npm run db:test` (supabase test db), só contra a base local.
-- Tudo corre numa transação que termina em rollback: nada fica gravado.
-- O estado é preparado como postgres; cada bloco troca de papel com
-- `set local role` e volta com `reset role`.
begin;

create extension if not exists pgtap with schema extensions;

select plan(204);

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
select pg_temp.signup('20000000-0000-0000-0000-000000000009', 'admin@exemplo.test', 'staff');
select pg_temp.signup('20000000-0000-0000-0000-000000000011', 'onze@exemplo.test', 'student');
select pg_temp.signup('20000000-0000-0000-0000-000000000012', 'doze@exemplo.test', 'student');
select pg_temp.signup('20000000-0000-0000-0000-000000000013', 'treze@exemplo.test', 'student');
select pg_temp.signup('20000000-0000-0000-0000-000000000014', 'catorze@exemplo.test', 'student');
select pg_temp.signup('20000000-0000-0000-0000-000000000015', 'quinze@exemplo.test', 'student');
update public.profiles set full_name = 'Admin Teste' where id = '20000000-0000-0000-0000-000000000009';
update public.profiles set full_name = 'Ana Um' where id = '20000000-0000-0000-0000-000000000001';
insert into public.admin_users (user_id) values ('20000000-0000-0000-0000-000000000009');

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

-- Endereço-base com 40 caracteres: o sufixo corta a base para caber nos 40,
-- sem deixar hífen antes do sufixo.
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000011');
select public.save_my_store(repeat('b', 40), '', pg_temp.cat('snacks'), null, null);
select pg_temp.as_user('20000000-0000-0000-0000-000000000012');
select public.save_my_store(repeat('b', 40), '', pg_temp.cat('doces'), null, null);
select pg_temp.as_user('20000000-0000-0000-0000-000000000013');
select public.save_my_store(repeat('c', 37) || ' dd', '', pg_temp.cat('doces'), null, null);
select pg_temp.as_user('20000000-0000-0000-0000-000000000014');
select public.save_my_store(repeat('c', 37) || ' dd', '', pg_temp.cat('doces'), null, null);
reset role;
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000011')).slug, repeat('b', 40),
  '(b) a primeira loja com base de 40 caracteres fica com a base inteira');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000012')).slug, repeat('b', 38) || '-2',
  '(b) a segunda fica com 38 caracteres da base mais -2 (40 no total)');
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000014')).slug, repeat('c', 37) || '-2',
  '(b) o corte para o sufixo não deixa hífen antes de -2');

-- Categoria escondida: recusada numa loja nova, aceite na loja que já a tem.
-- O id vem de uma tabela temporária: como authenticated, as RLS de
-- categories já não deixam ler a escondida.
create temp table t_snacks as select id from public.categories where slug = 'snacks';
grant select on t_snacks to authenticated;
update public.categories set is_visible = false where slug = 'snacks';
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000015');
select throws_ok($$ select public.save_my_store('Loja Quinze', '', (select id from t_snacks), null, null) $$,
  'P0001', 'CATEGORY_NOT_FOUND', '(b) uma categoria escondida dá CATEGORY_NOT_FOUND');
select pg_temp.as_user('20000000-0000-0000-0000-000000000011');
select lives_ok($$ select public.save_my_store(repeat('b', 40), 'Com descrição', (select id from t_snacks), null, null) $$,
  '(b) a loja cuja categoria foi escondida continua a poder guardar com ela');
reset role;

-- ===========================================================================
-- (c) Endereço fixo depois de aprovada
-- ===========================================================================
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000005');
select public.save_my_store('Gelados Frescos', 'Gelados', pg_temp.cat('gelados'), null, null);
reset role;

insert into t_store select owner_id, id from public.stores where owner_id = '20000000-0000-0000-0000-000000000005';
create temp table t_logo5 as
  select 'stores/' || id || '/logo-' || gen_random_uuid() || '.webp' as path
    from t_store where owner = '20000000-0000-0000-0000-000000000005';
grant select on t_logo5 to authenticated;

update public.stores
   set status = 'approved', submitted_at = now(), decided_at = now(), decided_by = '20000000-0000-0000-0000-000000000007',
       logo_path = (select path from t_logo5)
 where owner_id = '20000000-0000-0000-0000-000000000005';

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000005');
select public.save_my_store('Outro Nome', 'Gelados', pg_temp.cat('gelados'), (select path from t_logo5), null);
select throws_ok(
  $$ select public.save_my_store('Outro Nome', '', pg_temp.cat('gelados'), (select path from t_logo5), null) $$,
  'P0001', 'STORE_INCOMPLETE', '(c) aprovada, apagar a descrição dá STORE_INCOMPLETE');
select throws_ok(
  $$ select public.save_my_store('Outro Nome', 'Gelados', pg_temp.cat('gelados'), null, null) $$,
  'P0001', 'STORE_INCOMPLETE', '(c) aprovada, tirar o logótipo dá STORE_INCOMPLETE');
reset role;
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000005')).description, 'Gelados',
  '(c) as gravações recusadas não mudaram a loja aprovada');

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
select ok(not has_table_privilege('service_role', 'public.store_decisions', 'UPDATE'),
  '(f) service_role não altera store_decisions');
select ok(not has_table_privilege('service_role', 'public.store_decisions', 'DELETE'),
  '(f) service_role não apaga store_decisions');

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
-- (h) anon não chama as funções do vendedor nem as da administração
-- ===========================================================================
set local role anon;
select throws_ok($$ select public.save_my_store('Loja', '', null, null, null) $$, '42501', null, '(h) anon não chama save_my_store');
select throws_ok($$ select public.submit_my_store() $$, '42501', null, '(h) anon não chama submit_my_store');
select throws_ok($$ select * from public.get_my_store() $$, '42501', null, '(h) anon não chama get_my_store');
select throws_ok($$ select public.admin_decide_store(gen_random_uuid(), 'approved', null, '{}', now()) $$,
  '42501', null, '(h) anon não chama admin_decide_store');
select throws_ok($$ select * from public.admin_list_store_applications('pending_approval') $$,
  '42501', null, '(h) anon não chama admin_list_store_applications');
select throws_ok($$ select public.admin_count_pending_stores() $$, '42501', null, '(h) anon não chama admin_count_pending_stores');
select throws_ok($$ select * from public.admin_get_store_application(gen_random_uuid()) $$,
  '42501', null, '(h) anon não chama admin_get_store_application');
select throws_ok($$ select * from public.admin_list_store_decisions(gen_random_uuid()) $$,
  '42501', null, '(h) anon não chama admin_list_store_decisions');
reset role;

-- ===========================================================================
-- (i) Decisão da administração
-- ===========================================================================
-- Erro e detail de uma chamada, para ver o detail de ALREADY_DECIDED.
create function pg_temp.err_of(p_sql text)
returns text
language plpgsql
as $$
declare
  v_detail text;
begin
  execute p_sql;
  return 'OK';
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return sqlerrm || ' / ' || coalesce(v_detail, '');
end;
$$;
grant execute on function pg_temp.err_of(text) to authenticated;

create function pg_temp.sid(p_owner uuid)
returns uuid
language sql
as $$
  select id from t_store where owner = p_owner;
$$;
grant execute on function pg_temp.sid(uuid) to authenticated, anon;

-- O submitted_at que o A01 mostra (lido como admin).
create function pg_temp.sub_at(p_store uuid)
returns timestamptz
language sql
as $$
  select submitted_at from public.admin_get_store_application(p_store);
$$;
grant execute on function pg_temp.sub_at(uuid) to authenticated;

-- Quatro candidaturas: 1, 2 e 3 enviadas há 3, 2 e 1 horas; a 8 enviada
-- agora (em (e)).
insert into t_store select owner_id, id from public.stores where owner_id = '20000000-0000-0000-0000-000000000003';
update public.stores s
   set status = 'pending_approval',
       submitted_at = now() - (v.hours || ' hours')::interval,
       logo_path = coalesce(s.logo_path, 'stores/' || s.id || '/logo-' || gen_random_uuid() || '.webp')
  from (values ('20000000-0000-0000-0000-000000000001'::uuid, 3),
               ('20000000-0000-0000-0000-000000000002'::uuid, 2),
               ('20000000-0000-0000-0000-000000000003'::uuid, 1)) as v (owner, hours)
 where s.owner_id = v.owner;

-- Um não-admin recebe NOT_ALLOWED em todas.
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000008');
select throws_ok(
  format($$ select public.admin_decide_store(%L, 'approved', null, '{}', now()) $$, pg_temp.sid('20000000-0000-0000-0000-000000000008')),
  'P0001', 'NOT_ALLOWED', '(i) um não-admin não decide');
select throws_ok($$ select * from public.admin_list_store_applications('pending_approval') $$,
  'P0001', 'NOT_ALLOWED', '(i) um não-admin não lista candidaturas');
select throws_ok(
  format($$ select * from public.admin_get_store_application(%L) $$, pg_temp.sid('20000000-0000-0000-0000-000000000008')),
  'P0001', 'NOT_ALLOWED', '(i) um não-admin não lê uma candidatura');
select throws_ok(
  format($$ select * from public.admin_list_store_decisions(%L) $$, pg_temp.sid('20000000-0000-0000-0000-000000000008')),
  'P0001', 'NOT_ALLOWED', '(i) um não-admin não lê as decisões de uma loja');
select throws_ok($$ select public.admin_count_pending_stores() $$,
  'P0001', 'NOT_ALLOWED', '(i) um não-admin não conta as candidaturas');

-- Lista de candidaturas pendentes: (submitted_at, id) asc, com cursor.
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select is(public.admin_count_pending_stores(), 4, '(i) há 4 candidaturas pendentes');
select results_eq(
  $$ select id from public.admin_list_store_applications('pending_approval') $$,
  $$ select unnest(array[pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.sid('20000000-0000-0000-0000-000000000002'),
                         pg_temp.sid('20000000-0000-0000-0000-000000000003'), pg_temp.sid('20000000-0000-0000-0000-000000000008')]) $$,
  '(i) as pendentes vêm pela ordem de envio');
select results_eq(
  $$ select id from public.admin_list_store_applications('pending_approval', p_limit => 2) $$,
  $$ select unnest(array[pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.sid('20000000-0000-0000-0000-000000000002')]) $$,
  '(i) a primeira página de 2');
select results_eq(
  $$ select l.id from public.admin_list_store_applications(
       'pending_approval',
       (select a.submitted_at from public.admin_list_store_applications('pending_approval') a
         where a.id = pg_temp.sid('20000000-0000-0000-0000-000000000002')),
       pg_temp.sid('20000000-0000-0000-0000-000000000002'),
       2) l $$,
  $$ select unnest(array[pg_temp.sid('20000000-0000-0000-0000-000000000003'), pg_temp.sid('20000000-0000-0000-0000-000000000008')]) $$,
  '(i) a segunda página começa depois do cursor');
select throws_ok($$ select * from public.admin_list_store_applications('pending_approval', now(), null) $$,
  'P0001', 'INVALID_CURSOR', '(i) um cursor só com a data dá INVALID_CURSOR');
select is((select count(*)::int from public.admin_list_store_applications('pending_approval', p_limit => 0)), 1,
  '(i) p_limit abaixo de 1 dá 1 linha');
select results_eq(
  format($$ select name, slug, category_name, owner_name, owner_affiliation::text, logo_path is not null, decided_at is null
              from public.admin_list_store_applications('pending_approval') where id = %L $$,
         pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  $$ values ('Doces da Ana'::text, 'doces-da-ana'::text, 'Doces'::text, 'Ana Um'::text, 'student'::text, true, true) $$,
  '(i) a lista traz a loja, a categoria e o dono');

-- Uma candidatura.
select results_eq(
  format($$ select name, description, status, owner_name, owner_affiliation::text, owner_created_at is not null, submitted_at is not null
              from public.admin_get_store_application(%L) $$,
         pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  $$ values ('Doces da Ana'::text, 'Bolos e doces'::text, 'pending_approval'::public.store_status, 'Ana Um'::text, 'student'::text, true, true) $$,
  '(i) admin_get_store_application traz a loja e o dono');
select is((select count(*)::int from public.admin_get_store_application(gen_random_uuid())), 0,
  '(i) uma loja que não existe dá 0 linhas');

-- Erros de admin_decide_store (validados antes de qualquer escrita).
select throws_ok(
  format($$ select public.admin_decide_store(%L, 'suspended', 'Não', '{}', now()) $$, pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  'P0001', 'INVALID_DECISION', '(i) suspender por aqui dá INVALID_DECISION');
select throws_ok(
  format($$ select public.admin_decide_store(%L, null, null, '{}', now()) $$, pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  'P0001', 'INVALID_DECISION', '(i) uma decisão nula dá INVALID_DECISION');
select throws_ok(
  format($$ select public.admin_decide_store(%L, 'approved', repeat('a', 501), '{}', now()) $$, pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  'P0001', 'INVALID_TEXT', '(i) uma mensagem com 501 caracteres dá INVALID_TEXT');
select throws_ok(
  format($$ select public.admin_decide_store(%L, 'approved', 'a' || chr(7), '{}', now()) $$, pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  'P0001', 'INVALID_TEXT', '(i) uma mensagem com um caracter de controlo dá INVALID_TEXT');
select throws_ok(
  format($$ select public.admin_decide_store(%L, 'rejected', null, '{}', now()) $$, pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  'P0001', 'MESSAGE_REQUIRED', '(i) recusar sem mensagem dá MESSAGE_REQUIRED');
select throws_ok(
  format($$ select public.admin_decide_store(%L, 'rejected', E' \n\t ', '{}', now()) $$, pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  'P0001', 'MESSAGE_REQUIRED', '(i) recusar com uma mensagem só de espaços dá MESSAGE_REQUIRED');
select throws_ok(
  format($$ select public.admin_decide_store(%L, 'approved', null, '{"foo": true}', now()) $$, pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  'P0001', 'INVALID_CHECKLIST', '(i) uma chave estranha no checklist dá INVALID_CHECKLIST');
select throws_ok(
  format($$ select public.admin_decide_store(%L, 'approved', null, '{"allowed": "sim"}', now()) $$, pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  'P0001', 'INVALID_CHECKLIST', '(i) um valor não booleano no checklist dá INVALID_CHECKLIST');
select throws_ok(
  format($$ select public.admin_decide_store(%L, 'approved', null, '[]', now()) $$, pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  'P0001', 'INVALID_CHECKLIST', '(i) um checklist que não é objeto dá INVALID_CHECKLIST');
select throws_ok(
  format($$ select public.admin_decide_store(%L, 'approved', null, 'null'::jsonb, now()) $$, pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  'P0001', 'INVALID_CHECKLIST', '(i) um checklist JSON null dá INVALID_CHECKLIST');
select throws_ok($$ select public.admin_decide_store(gen_random_uuid(), 'approved', null, '{}', now()) $$,
  'P0001', 'NOT_FOUND', '(i) uma loja que não existe dá NOT_FOUND');

-- Aprovar.
select is(
  public.admin_decide_store(pg_temp.sid('20000000-0000-0000-0000-000000000001'), 'approved', null,
                            '{"name_description": true, "allowed": true}', pg_temp.sub_at(pg_temp.sid('20000000-0000-0000-0000-000000000001'))),
  'approved'::public.store_status, '(i) aprovar devolve approved');
reset role;

select results_eq(
  $$ select status, decided_by, decided_at is not null from public.stores where owner_id = '20000000-0000-0000-0000-000000000001' $$,
  $$ values ('approved'::public.store_status, '20000000-0000-0000-0000-000000000009'::uuid, true) $$,
  '(i) a loja fica approved, com decided_by igual ao admin');
select results_eq(
  format($$ select decision, admin_id, message, checklist from public.store_decisions where store_id = %L $$,
         pg_temp.sid('20000000-0000-0000-0000-000000000001')),
  $$ values ('approved'::public.store_decision, '20000000-0000-0000-0000-000000000009'::uuid, null::text,
             '{"name_description": true, "allowed": true}'::jsonb) $$,
  '(i) a aprovação fica numa linha de store_decisions');

-- Uma segunda decisão sobre a mesma loja.
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select is(
  pg_temp.err_of(format($$ select public.admin_decide_store(%L, 'rejected', 'Mudei de ideias', '{}', pg_temp.sub_at(%L)) $$,
                        pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.sid('20000000-0000-0000-0000-000000000001'))),
  'ALREADY_DECIDED / approved', '(i) decidir outra vez dá ALREADY_DECIDED com o estado atual no detail');
reset role;
select is((select count(*)::int from public.store_decisions where store_id = pg_temp.sid('20000000-0000-0000-0000-000000000001')), 1,
  '(i) continua a haver uma só decisão');

set local role anon;
select ok(exists (select 1 from public.list_stores() where slug = 'doces-da-ana'), '(i) a loja aprovada aparece em list_stores');
reset role;

-- Recusar, voltar a enviar, recusar outra vez.
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select is(
  public.admin_decide_store(pg_temp.sid('20000000-0000-0000-0000-000000000008'), 'rejected', E'  Falta a foto   da capa \n\n\n ',
                            '{"images": false}', pg_temp.sub_at(pg_temp.sid('20000000-0000-0000-0000-000000000008'))),
  'rejected'::public.store_status, '(i) recusar com mensagem devolve rejected');
select pg_temp.as_user('20000000-0000-0000-0000-000000000008');
select is((select last_message from public.get_my_store()), 'Falta a foto da capa',
  '(i) o dono vê a mensagem da recusa, normalizada');
select is(public.submit_my_store(), 'pending_approval'::public.store_status, '(i) o dono volta a enviar');
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select ok(
  exists (select 1 from public.admin_list_store_applications('pending_approval')
           where id = pg_temp.sid('20000000-0000-0000-0000-000000000008')),
  '(i) reenviada, volta a aparecer nas pendentes');
reset role;

-- Ecrã desatualizado: o admin abriu o envio anterior e a loja foi reenviada
-- depois. Dentro desta transação now() não muda, por isso o reenvio é
-- empurrado 1 segundo para ter um submitted_at diferente.
create temp table t_old_sub as select submitted_at from public.stores where owner_id = '20000000-0000-0000-0000-000000000008';
grant select on t_old_sub to authenticated;
update public.stores set submitted_at = submitted_at + interval '1 second'
 where owner_id = '20000000-0000-0000-0000-000000000008';
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select is(
  pg_temp.err_of(format($$ select public.admin_decide_store(%L, 'approved', null, '{}', %L) $$,
                        pg_temp.sid('20000000-0000-0000-0000-000000000008'), (select submitted_at from t_old_sub))),
  'ALREADY_DECIDED / pending_approval', '(i) decidir com o submitted_at de um envio anterior dá ALREADY_DECIDED');
reset role;
select is((select count(*)::int from public.store_decisions where store_id = pg_temp.sid('20000000-0000-0000-0000-000000000008')), 2,
  '(i) a decisão desatualizada não escreve nenhuma linha');
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select is(
  public.admin_decide_store(pg_temp.sid('20000000-0000-0000-0000-000000000008'), 'rejected', 'Terceira mensagem', null,
                            pg_temp.sub_at(pg_temp.sid('20000000-0000-0000-0000-000000000008'))),
  'rejected'::public.store_status, '(i) recusar outra vez devolve rejected');
select pg_temp.as_user('20000000-0000-0000-0000-000000000008');
select is((select last_message from public.get_my_store()), 'Terceira mensagem',
  '(i) last_message é a da decisão mais recente');
select results_eq(
  $$ select message from public.get_my_store_decisions() $$,
  $$ values ('Terceira mensagem'::text), ('Falta a foto da capa'::text), ('Falta a foto'::text) $$,
  '(i) get_my_store_decisions vem da mais recente para a mais antiga');
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select results_eq(
  format($$ select decision, message, checklist, admin_name from public.admin_list_store_decisions(%L) $$,
         pg_temp.sid('20000000-0000-0000-0000-000000000008')),
  $$ values ('rejected'::public.store_decision, 'Terceira mensagem'::text, '{}'::jsonb, 'Admin Teste'::text),
            ('rejected'::public.store_decision, 'Falta a foto da capa'::text, '{"images": false}'::jsonb, 'Admin Teste'::text),
            ('rejected'::public.store_decision, 'Falta a foto'::text, '{}'::jsonb, 'Pessoa Teste'::text) $$,
  '(i) admin_list_store_decisions traz as decisões e o nome de quem decidiu, da mais recente para a mais antiga');
reset role;

select ok(
  not exists (
    select 1 from pg_proc p, unnest(p.proargnames) as a (name)
     where p.oid = 'public.get_my_store_decisions'::regproc and a.name in ('admin_id', 'admin_name', 'decided_by')),
  '(i) get_my_store_decisions não tem coluna de admin');
select ok(
  not exists (
    select 1 from pg_proc p, unnest(p.proargnames) as a (name)
     where p.oid in ('public.admin_list_store_applications'::regproc, 'public.admin_get_store_application'::regproc)
       and (a.name like '%email%' or a.name like '%phone%')),
  '(i) as funções da administração não expõem email nem telefone do dono');

-- Lista das decididas: (decided_at, id) desc, com cursor.
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select public.admin_decide_store(pg_temp.sid('20000000-0000-0000-0000-000000000002'), 'approved', 'Bem-vinda', '{}', pg_temp.sub_at(pg_temp.sid('20000000-0000-0000-0000-000000000002')));
select public.admin_decide_store(pg_temp.sid('20000000-0000-0000-0000-000000000003'), 'approved', null, '{}', pg_temp.sub_at(pg_temp.sid('20000000-0000-0000-0000-000000000003')));
reset role;
update public.stores s
   set decided_at = now() - (v.minutes || ' minutes')::interval
  from (values ('20000000-0000-0000-0000-000000000001'::uuid, 3),
               ('20000000-0000-0000-0000-000000000002'::uuid, 2),
               ('20000000-0000-0000-0000-000000000003'::uuid, 1)) as v (owner, minutes)
 where s.owner_id = v.owner;

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select results_eq(
  $$ select id from public.admin_list_store_applications('approved') where id <> pg_temp.sid('20000000-0000-0000-0000-000000000005') $$,
  $$ select unnest(array[pg_temp.sid('20000000-0000-0000-0000-000000000003'), pg_temp.sid('20000000-0000-0000-0000-000000000002'),
                         pg_temp.sid('20000000-0000-0000-0000-000000000001')]) $$,
  '(i) as aprovadas vêm da decisão mais recente para a mais antiga');
select results_eq(
  $$ select l.id from public.admin_list_store_applications(
       'approved',
       (select a.decided_at from public.admin_list_store_applications('approved') a
         where a.id = pg_temp.sid('20000000-0000-0000-0000-000000000002')),
       pg_temp.sid('20000000-0000-0000-0000-000000000002')) l $$,
  $$ select pg_temp.sid('20000000-0000-0000-0000-000000000001') $$,
  '(i) nas decididas, a página seguinte vem depois do cursor');
select results_eq(
  $$ select id from public.admin_list_store_applications('rejected') $$,
  $$ select pg_temp.sid('20000000-0000-0000-0000-000000000008') $$,
  '(i) a recusada aparece nas recusadas');
select is(public.admin_count_pending_stores(), 0, '(i) depois das decisões não há pendentes');
select throws_ok($$ select * from public.admin_list_store_applications('draft') $$,
  'P0001', 'INVALID_STATUS', '(i) listar rascunhos dá INVALID_STATUS');
reset role;

-- Um admin não decide a sua própria loja.
insert into public.stores (owner_id, name, slug, category_id, description, status, submitted_at)
values ('20000000-0000-0000-0000-000000000009', 'Loja do Admin', 'loja-do-admin', pg_temp.cat('outros'), 'Coisas',
        'pending_approval', now() - interval '4 hours');
insert into t_store select owner_id, id from public.stores where owner_id = '20000000-0000-0000-0000-000000000009';
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select throws_ok(
  format($$ select public.admin_decide_store(%L, 'approved', null, '{}', pg_temp.sub_at(%L)) $$, pg_temp.sid('20000000-0000-0000-0000-000000000009'), pg_temp.sid('20000000-0000-0000-0000-000000000009')),
  'P0001', 'NOT_ALLOWED', '(i) um admin não decide a sua própria loja');
reset role;
select is((pg_temp.store_of('20000000-0000-0000-0000-000000000009')).status, 'pending_approval'::public.store_status,
  '(i) a própria loja do admin continua pendente');

-- p_limit acima de 50 fica em 50: 51 candidaturas novas, mais a do admin.
select pg_temp.signup(('30000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'lote' || g || '@exemplo.test', 'student')
  from generate_series(1, 51) as g;
insert into public.stores (owner_id, name, slug, category_id, status, submitted_at)
select ('30000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'Lote ' || g, 'lote-' || g, pg_temp.cat('outros'),
       'pending_approval', now()
  from generate_series(1, 51) as g;
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select is((select count(*)::int from public.admin_list_store_applications('pending_approval', p_limit => 100)), 50,
  '(i) p_limit 100 com 52 pendentes dá 50 linhas');
reset role;

-- ===========================================================================
-- (j) Produtos e fotos do vendedor
-- ===========================================================================
-- Neste ponto: a loja de 1 está approved, a de 4 em draft, a de 5 suspended
-- e a de 9 (o admin) em pending_approval.
insert into t_store select owner_id, id from public.stores where owner_id = '20000000-0000-0000-0000-000000000004';

-- Ids dos produtos criados como authenticated (o cliente não escolhe o id).
create temp table t_prod (k text primary key, id uuid not null);
grant select, insert on t_prod to authenticated, anon;

create function pg_temp.pid(p_k text)
returns uuid
language sql
as $$
  select id from t_prod where k = p_k;
$$;
grant execute on function pg_temp.pid(text) to authenticated, anon;

-- Caminho de uma foto de produto: products/<loja>/<produto>/<uuid>.webp.
create function pg_temp.img_path(p_store uuid, p_product uuid, p_ext text default 'webp')
returns text
language sql
as $$
  select 'products/' || p_store || '/' || p_product || '/' || gen_random_uuid() || '.' || p_ext;
$$;
grant execute on function pg_temp.img_path(uuid, uuid, text) to authenticated;

-- Número de linhas que uma instrução toca, como o papel atual.
create function pg_temp.rows_of(p_sql text)
returns integer
language plpgsql
as $$
declare
  v_rows integer;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
grant execute on function pg_temp.rows_of(text) to authenticated, anon;

-- O dono de uma loja approved cria um produto oculto.
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ with ins as (
       insert into public.products (store_id, category_id, name, description, price_kz, stock)
       values (pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.cat('doces'), 'Bolo de chocolate', 'Fatia', 2500, 3)
       returning id)
     insert into t_prod select 'bolo', id from ins $$,
  '(j) o dono de uma loja approved cria um produto oculto');
select is((select is_published from public.products where id = pg_temp.pid('bolo')), false,
  '(j) o dono vê o seu produto oculto e o is_published');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock, is_published)
     values (pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.cat('doces'), 'Já publicado', 100, 1, true) $$,
  'P0001', 'PHOTO_REQUIRED', '(j) criar um produto já publicado (sem fotos) dá PHOTO_REQUIRED');
select throws_ok(
  $$ update public.products set is_published = true where id = pg_temp.pid('bolo') $$,
  'P0001', 'PHOTO_REQUIRED', '(j) publicar sem foto dá PHOTO_REQUIRED');

-- Caminhos das fotos.
select throws_ok(
  format($$ insert into public.product_images (product_id, path, position) values (%L, %L, 0) $$,
         pg_temp.pid('bolo'), pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000002'), pg_temp.pid('bolo'))),
  'P0001', 'INVALID_PATH', '(j) uma foto no caminho de outra loja dá INVALID_PATH');
select throws_ok(
  format($$ insert into public.product_images (product_id, path, position) values (%L, %L, 0) $$,
         pg_temp.pid('bolo'), pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.pid('bolo'), 'png')),
  'P0001', 'INVALID_PATH', '(j) uma foto .png dá INVALID_PATH');
select throws_ok(
  format($$ insert into public.product_images (product_id, path, position) values (%L, %L, 0) $$,
         pg_temp.pid('bolo'), 'products/' || pg_temp.sid('20000000-0000-0000-0000-000000000001') || '/' || gen_random_uuid() || '/' || gen_random_uuid() || '.webp'),
  'P0001', 'INVALID_PATH', '(j) uma foto na pasta de outro produto dá INVALID_PATH');

-- Foto 0 e publicar.
select lives_ok(
  format($$ insert into public.product_images (product_id, path, position) values (%L, %L, 0) $$,
         pg_temp.pid('bolo'), pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.pid('bolo'))),
  '(j) o dono junta a foto 0 no caminho certo');
select lives_ok($$ update public.products set is_published = true where id = pg_temp.pid('bolo') $$,
  '(j) com uma foto, o dono publica');
select throws_ok(
  format($$ delete from public.product_images where product_id = %L $$, pg_temp.pid('bolo')),
  'P0001', 'PHOTO_REQUIRED', '(j) apagar a única foto de um produto publicado dá PHOTO_REQUIRED');
select throws_ok(
  $$ update public.products set moderation_status = 'hidden', moderation_reason = 'Eu mesmo' where id = pg_temp.pid('bolo') $$,
  '42501', null, '(j) o dono não muda moderation_status');

-- Com duas fotos, apagar uma é aceite.
select lives_ok(
  format($$ insert into public.product_images (product_id, path, position) values (%L, %L, 1) $$,
         pg_temp.pid('bolo'), pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.pid('bolo'))),
  '(j) o dono junta a foto 1');
select is(
  pg_temp.rows_of(format($$ delete from public.product_images where product_id = %L and position = 1 $$, pg_temp.pid('bolo'))),
  1, '(j) com duas fotos, apagar uma é aceite');
reset role;

select is((select is_published from public.products where id = pg_temp.pid('bolo')), true, '(j) o produto ficou publicado');
select is((select count(*)::int from public.product_images where product_id = pg_temp.pid('bolo')), 1,
  '(j) a foto recusada continua lá');

-- Apagar um produto publicado com uma foto apaga a foto.
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
with ins as (
  insert into public.products (store_id, category_id, name, price_kz, stock)
  values (pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.cat('doces'), 'Para apagar', 100, 1)
  returning id)
insert into t_prod select 'apagar', id from ins;
select pg_temp.rows_of(format($$ insert into public.product_images (product_id, path, position) values (%L, %L, 0) $$,
       pg_temp.pid('apagar'), pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.pid('apagar'))));
update public.products set is_published = true where id = pg_temp.pid('apagar');
select is(pg_temp.rows_of(format($$ delete from public.products where id = %L $$, pg_temp.pid('apagar'))), 1,
  '(j) o dono apaga um produto publicado com uma foto');
reset role;
select is((select count(*)::int from public.product_images where product_id = pg_temp.pid('apagar')), 0,
  '(j) apagar o produto apaga as fotos');

-- Um produto oculto, para os testes de outro utilizador.
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
with ins as (
  insert into public.products (store_id, category_id, name, price_kz, stock)
  values (pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.cat('doces'), 'Oculto', 100, 1)
  returning id)
insert into t_prod select 'oculto', id from ins;

-- O dono de uma loja em draft não cria produtos.
select pg_temp.as_user('20000000-0000-0000-0000-000000000004');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values (pg_temp.sid('20000000-0000-0000-0000-000000000004'), pg_temp.cat('outros'), 'Cedo demais', 100, 1) $$,
  '42501', null, '(j) o dono de uma loja em draft não cria produtos');

-- Outro utilizador (com a sua própria loja aprovada).
select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.products where id = pg_temp.pid('oculto')), 0,
  '(j) outro utilizador não vê o produto oculto');
select is((select count(*)::int from public.products where id = pg_temp.pid('bolo')), 1,
  '(j) outro utilizador vê o produto publicado');
select is(pg_temp.rows_of(format($$ update public.products set name = 'Meu' where id = %L $$, pg_temp.pid('bolo'))), 0,
  '(j) outro utilizador não altera o produto');
select is(pg_temp.rows_of(format($$ update public.products set is_published = false where id = %L $$, pg_temp.pid('oculto'))), 0,
  '(j) outro utilizador não altera o produto oculto');
select is(pg_temp.rows_of(format($$ delete from public.products where id = %L $$, pg_temp.pid('bolo'))), 0,
  '(j) outro utilizador não apaga o produto');
select is(pg_temp.rows_of(format($$ delete from public.product_images where product_id = %L $$, pg_temp.pid('bolo'))), 0,
  '(j) outro utilizador não apaga as fotos');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values (pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.cat('doces'), 'Intruso', 100, 1) $$,
  '42501', null, '(j) outro utilizador não cria produtos na loja alheia');
select throws_ok(
  format($$ insert into public.product_images (product_id, path, position) values (%L, %L, 2) $$,
         pg_temp.pid('bolo'), pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.pid('bolo'))),
  '42501', null, '(j) outro utilizador não junta fotos ao produto alheio');
reset role;

select is((select name from public.products where id = pg_temp.pid('bolo')), 'Bolo de chocolate',
  '(j) o produto ficou como estava');

-- O público não vê o produto oculto.
set local role anon;
select is((select count(*)::int from public.products where id = pg_temp.pid('oculto')), 0, '(j) anon não vê o produto oculto');
select is((select count(*)::int from public.products where id = pg_temp.pid('bolo')), 1, '(j) anon vê o produto publicado');
reset role;

-- As funções públicas do catálogo não mostram ao dono os seus produtos
-- ocultos, mesmo que as RLS do dono os deixem ver: um oculto noutra
-- categoria (gelados) e um publicado mas ocultado pela moderação
-- (acessórios, criado como postgres).
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
with ins as (
  insert into public.products (store_id, category_id, name, price_kz, stock)
  values (pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.cat('gelados'), 'Gelado oculto', 100, 1)
  returning id)
insert into t_prod select 'gelado-oculto', id from ins;
reset role;
insert into public.products (store_id, category_id, name, price_kz, stock, is_published, moderation_status, moderation_reason)
values (pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.cat('acessorios'), 'Moderado', 100, 1, true, 'hidden', 'Imprópria');
insert into t_prod select 'moderado', id from public.products where name = 'Moderado';

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
select results_eq(
  $$ select id from public.search_products(p_store_slug => 'doces-da-ana') $$,
  $$ select pg_temp.pid('bolo') $$,
  '(j) search_products da própria loja só traz ao dono o produto publicado');
select is((select count(*)::int from public.get_product(pg_temp.pid('oculto'))), 0,
  '(j) get_product de um produto oculto do próprio dono dá 0 linhas');
select is((select count(*)::int from public.get_product(pg_temp.pid('moderado'))), 0,
  '(j) get_product de um produto do dono ocultado pela moderação dá 0 linhas');
select is((select count(*)::int from public.get_product(pg_temp.pid('bolo'))), 1,
  '(j) get_product do produto publicado do dono dá 1 linha');
select is((select product_categories from public.get_store('doces-da-ana')), '[{"name": "Doces", "slug": "doces"}]'::jsonb,
  '(j) os filtros de get_store não têm as categorias só de produtos ocultos');
reset role;

-- Loja suspensa: o dono vê os seus produtos mas não os altera.
insert into public.products (store_id, category_id, name, price_kz, stock)
values (pg_temp.sid('20000000-0000-0000-0000-000000000005'), pg_temp.cat('gelados'), 'Gelado', 300, 2);
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.products where store_id = pg_temp.sid('20000000-0000-0000-0000-000000000005')), 1,
  '(j) o dono de uma loja suspensa vê os seus produtos');
select is(pg_temp.rows_of(format($$ update public.products set name = 'Outro' where store_id = %L $$,
                                 pg_temp.sid('20000000-0000-0000-0000-000000000005'))), 0,
  '(j) o dono de uma loja suspensa não altera os produtos');
reset role;

-- ===========================================================================
-- (k) Ordem das fotos
-- ===========================================================================
create temp table t_img as
  select position, id from public.product_images where product_id = pg_temp.pid('bolo');
insert into public.product_images (product_id, path, position)
values (pg_temp.pid('bolo'), pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.pid('bolo')), 1);
insert into t_img select position, id from public.product_images where product_id = pg_temp.pid('bolo') and position = 1;
grant select on t_img to authenticated;

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ select public.set_product_image_order(pg_temp.pid('bolo'),
       array[(select id from t_img where position = 1), (select id from t_img where position = 0)]) $$,
  '(k) set_product_image_order troca as fotos 0 e 1');
select results_eq(
  format($$ select id from public.product_images where product_id = %L order by position $$, pg_temp.pid('bolo')),
  $$ select unnest(array[(select id from t_img where position = 1), (select id from t_img where position = 0)]) $$,
  '(k) as posições ficam trocadas');
select throws_ok(
  $$ select public.set_product_image_order(pg_temp.pid('bolo'), array[(select id from t_img where position = 1)]) $$,
  'P0001', 'INVALID_ORDER', '(k) com um id em falta dá INVALID_ORDER');
select throws_ok(
  $$ select public.set_product_image_order(pg_temp.pid('bolo'),
       array[(select id from t_img where position = 1), (select id from t_img where position = 1)]) $$,
  'P0001', 'INVALID_ORDER', '(k) com um id repetido dá INVALID_ORDER');
select throws_ok(
  $$ select public.set_product_image_order(pg_temp.pid('bolo'),
       array[(select id from t_img where position = 1), gen_random_uuid()]) $$,
  'P0001', 'INVALID_ORDER', '(k) com um id que não é do produto dá INVALID_ORDER');
select throws_ok(
  $$ select public.set_product_image_order(pg_temp.pid('bolo'), null) $$,
  'P0001', 'INVALID_ORDER', '(k) sem lista dá INVALID_ORDER');
select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.set_product_image_order(pg_temp.pid('bolo'),
       array[(select id from t_img where position = 0), (select id from t_img where position = 1)]) $$,
  'P0001', 'NOT_ALLOWED', '(k) outro utilizador não ordena as fotos');
reset role;
select ok(
  (select condeferrable and not condeferred from pg_constraint
    where conname = 'product_images_product_id_position_key' and conrelid = 'public.product_images'::regclass),
  '(k) unique (product_id, position) é deferrable initially immediate');

set local role anon;
select throws_ok($$ select public.set_product_image_order(gen_random_uuid(), '{}') $$, '42501', null,
  '(k) anon não chama set_product_image_order');
reset role;

-- ===========================================================================
-- (l) Storage: can_write_media e as políticas de storage.objects
-- ===========================================================================
create function pg_temp.store_media(p_store uuid, p_kind text)
returns text
language sql
as $$
  select 'stores/' || p_store || '/' || p_kind || '-' || gen_random_uuid() || '.webp';
$$;
grant execute on function pg_temp.store_media(uuid, text) to authenticated;

insert into public.products (store_id, category_id, name, price_kz, stock)
values (pg_temp.sid('20000000-0000-0000-0000-000000000002'), pg_temp.cat('salgados'), 'Do vizinho', 300, 2);
insert into t_prod select 'vizinho', id from public.products where name = 'Do vizinho';

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
select ok(public.can_write_media('store-media', pg_temp.store_media(pg_temp.sid('20000000-0000-0000-0000-000000000001'), 'logo')),
  '(l) store-media: o logótipo da própria loja é true');
select ok(public.can_write_media('store-media', pg_temp.store_media(pg_temp.sid('20000000-0000-0000-0000-000000000001'), 'cover')),
  '(l) store-media: a capa da própria loja é true');
select ok(not public.can_write_media('store-media', pg_temp.store_media(pg_temp.sid('20000000-0000-0000-0000-000000000002'), 'logo')),
  '(l) store-media: o caminho de outra loja é false');
select ok(not public.can_write_media('store-media',
    'stores/' || pg_temp.sid('20000000-0000-0000-0000-000000000001') || '/../' || pg_temp.sid('20000000-0000-0000-0000-000000000002')
      || '/logo-' || gen_random_uuid() || '.webp'),
  '(l) store-media: um caminho com «../» é false');
select ok(not public.can_write_media('store-media',
    'stores/' || pg_temp.sid('20000000-0000-0000-0000-000000000001') || '/logo-' || gen_random_uuid() || '.png'),
  '(l) store-media: a extensão .png é false');
select ok(not public.can_write_media('store-media',
    'stores/' || pg_temp.sid('20000000-0000-0000-0000-000000000001') || '/banner-' || gen_random_uuid() || '.webp'),
  '(l) store-media: um nome que não é logo nem cover é false');
select ok(not public.can_write_media('product-media', pg_temp.store_media(pg_temp.sid('20000000-0000-0000-0000-000000000001'), 'logo')),
  '(l) um caminho de loja no bucket product-media é false');

select ok(public.can_write_media('product-media', pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.pid('bolo'))),
  '(l) product-media: a foto do próprio produto é true');
select ok(not public.can_write_media('product-media', pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.pid('bolo'), 'png')),
  '(l) product-media: a extensão .png é false');
select ok(not public.can_write_media('product-media', pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000002'), pg_temp.pid('vizinho'))),
  '(l) product-media: o produto de outra loja é false');
select ok(not public.can_write_media('product-media', pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.pid('vizinho'))),
  '(l) product-media: o produto de outra loja debaixo da própria loja é false');
select ok(not public.can_write_media('product-media',
    'products/' || pg_temp.sid('20000000-0000-0000-0000-000000000001') || '/' || pg_temp.pid('bolo') || '/../../'
      || pg_temp.sid('20000000-0000-0000-0000-000000000002') || '/' || gen_random_uuid() || '.webp'),
  '(l) product-media: um caminho com «../» é false');
select ok(not public.can_write_media('store-media', 'stores/nao-e-uuid/logo-x.webp'),
  '(l) um segmento que não é uuid é false, sem erro');
select ok(not public.can_write_media('product-media', 'products/zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz/a/b.webp'),
  '(l) um uuid malformado é false, sem erro');
select ok(not public.can_write_media('outro-bucket', pg_temp.store_media(pg_temp.sid('20000000-0000-0000-0000-000000000001'), 'logo')),
  '(l) outro bucket é false');
select ok(not coalesce(public.can_write_media(null, null), false), '(l) nulos dão false');

-- store-media com a loja em pending_approval (a do admin) e em suspended (a de 5).
select pg_temp.as_user('20000000-0000-0000-0000-000000000009');
select ok(not public.can_write_media('store-media', pg_temp.store_media(pg_temp.sid('20000000-0000-0000-0000-000000000009'), 'logo')),
  '(l) store-media com a loja em pending_approval é false');
select pg_temp.as_user('20000000-0000-0000-0000-000000000005');
select ok(not public.can_write_media('store-media', pg_temp.store_media(pg_temp.sid('20000000-0000-0000-0000-000000000005'), 'logo')),
  '(l) store-media com a loja suspended é false');
-- Em draft pode (o logótipo vem antes do envio); produtos ainda não.
select pg_temp.as_user('20000000-0000-0000-0000-000000000004');
select ok(public.can_write_media('store-media', pg_temp.store_media(pg_temp.sid('20000000-0000-0000-0000-000000000004'), 'logo')),
  '(l) store-media com a loja em draft é true');
select ok(not public.can_write_media('product-media', pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000004'), gen_random_uuid())),
  '(l) product-media com a loja em draft é false');
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select ok(not public.can_write_media('store-media', pg_temp.store_media(pg_temp.sid('20000000-0000-0000-0000-000000000001'), 'logo')),
  '(l) sem sub no JWT é false');

-- As políticas em storage.objects: o dono escreve e apaga, outro não.
create temp table t_obj (k text primary key, name text not null);
grant select, insert on t_obj to authenticated;
insert into t_obj values ('logo1', pg_temp.store_media(pg_temp.sid('20000000-0000-0000-0000-000000000001'), 'logo'));
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('store-media', (select name from t_obj where k = 'logo1')) $$,
  '(l) o dono escreve o logótipo da sua loja em storage.objects');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('product-media', %L) $$,
         pg_temp.img_path(pg_temp.sid('20000000-0000-0000-0000-000000000001'), pg_temp.pid('bolo'))),
  '(l) o dono escreve a foto do seu produto em storage.objects');
select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('store-media', %L) $$,
         pg_temp.store_media(pg_temp.sid('20000000-0000-0000-0000-000000000001'), 'cover')),
  '42501', null, '(l) outro utilizador não escreve no caminho da loja alheia');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('product-media', %L) $$,
         'products/' || pg_temp.sid('20000000-0000-0000-0000-000000000002') || '/' || pg_temp.pid('vizinho') || '/../../'
           || pg_temp.sid('20000000-0000-0000-0000-000000000001') || '/' || gen_random_uuid() || '.webp'),
  '42501', null, '(l) um nome de objeto com «../» é recusado');
select set_config('storage.allow_delete_query', 'true', true);
select is(pg_temp.rows_of($$ delete from storage.objects where bucket_id = 'store-media' and name = (select name from t_obj where k = 'logo1') $$),
  0, '(l) outro utilizador não apaga o logótipo alheio');
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
select is(pg_temp.rows_of($$ delete from storage.objects where bucket_id = 'store-media' and name = (select name from t_obj where k = 'logo1') $$),
  1, '(l) o dono apaga o logótipo da sua loja');
reset role;

select results_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", roles::text collate "default" from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname like 'media\_%' order by policyname $$,
  $$ values ('media_delete_owner', 'DELETE', '{authenticated}'), ('media_insert_owner', 'INSERT', '{authenticated}'),
            ('media_select_owner', 'SELECT', '{authenticated}') $$,
  '(l) storage.objects tem as políticas do dono, só para authenticated, sem UPDATE');

set local role anon;
select throws_ok($$ select public.can_write_media('store-media', 'x') $$, '42501', null, '(l) anon não chama can_write_media');
reset role;

-- ===========================================================================
-- (m) Categoria dos produtos do dono
-- ===========================================================================
-- snacks está escondida desde (b) (o id vem de t_snacks). Um produto da loja
-- de 1 em roupas-e-moda, que a administração esconde depois.
create temp table t_roupas as select id from public.categories where slug = 'roupas-e-moda';
grant select on t_roupas to authenticated;
insert into public.products (store_id, category_id, name, price_kz, stock)
values (pg_temp.sid('20000000-0000-0000-0000-000000000001'), (select id from t_roupas), 'Camisola', 4000, 1);
insert into t_prod select 'camisola', id from public.products where name = 'Camisola';
update public.categories set is_visible = false where slug = 'roupas-e-moda';

set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ insert into public.products (store_id, category_id, name, price_kz, stock)
     values (pg_temp.sid('20000000-0000-0000-0000-000000000001'), (select id from t_snacks), 'Pipocas', 100, 1) $$,
  'P0001', 'CATEGORY_NOT_FOUND', '(m) criar um produto numa categoria escondida dá CATEGORY_NOT_FOUND');
select throws_ok(
  format($$ update public.products set category_id = (select id from t_snacks) where id = %L $$, pg_temp.pid('bolo')),
  'P0001', 'CATEGORY_NOT_FOUND', '(m) mudar para uma categoria escondida dá CATEGORY_NOT_FOUND');
select is(pg_temp.rows_of(format($$ update public.products set price_kz = 4500 where id = %L $$, pg_temp.pid('camisola'))), 1,
  '(m) alterar outro campo de um produto cuja categoria foi escondida depois é aceite');
select is(
  pg_temp.rows_of(format($$ update public.products set category_id = (select id from t_roupas), stock = 2 where id = %L $$,
                         pg_temp.pid('camisola'))),
  1, '(m) repetir a mesma categoria escondida no UPDATE é aceite');
reset role;

select * from finish();
rollback;
