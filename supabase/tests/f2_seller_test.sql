-- Testes pgTAP de F2 · Vender, tarefas 1 e 2: a loja do vendedor no servidor
-- (endereço gerado a partir do nome, rascunho, envio e leitura da própria
-- loja), o fecho de store_decisions ao cliente e a decisão da administração.
-- Corre com `npm run db:test` (supabase test db), só contra a base local.
-- Tudo corre numa transação que termina em rollback: nada fica gravado.
-- O estado é preparado como postgres; cada bloco troca de papel com
-- `set local role` e volta com `reset role`.
begin;

create extension if not exists pgtap with schema extensions;

select plan(126);

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

select * from finish();
rollback;
