-- Testes pgTAP da fundação F0: perfis, dados académicos, administradores e RLS.
-- Corre com `npm run db:test` (supabase test db), só contra a base local.
-- Tudo corre numa transação que termina em rollback: nada fica gravado.
begin;

create extension if not exists pgtap with schema extensions;

select plan(57);

-- Utilitário de teste: regista um utilizador como o GoTrue faria (insert em
-- auth.users como postgres), para o trigger on_auth_user_created correr.
create function pg_temp.signup(p_id uuid, p_email text, p_meta jsonb)
returns void
language sql
as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, '', p_meta, now(), now());
$$;

create function pg_temp.as_user(p_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
-- A migração retira o EXECUTE a PUBLIC em todas as funções novas, por isso o
-- utilitário precisa de um grant explícito para correr como authenticated.
grant execute on function pg_temp.as_user(uuid) to authenticated;

-- ===========================================================================
-- Registo
-- ===========================================================================

-- A: estudante, com espaços a mais no nome e no curso.
select pg_temp.signup('11111111-1111-1111-1111-111111111111', 'ana@example.test', jsonb_build_object(
  'full_name', '  Ana   Silva  ', 'phone', '912345678', 'affiliation', 'student', 'terms_accepted', true,
  'academic', jsonb_build_object('course', ' Engenharia   Informática ', 'curricular_year', '2.º ano', 'shift', 'Manhã', 'class_group', 'A1')
));

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  1, '(a) registar um estudante cria uma linha em profiles');
select is(
  (select count(*)::int from public.academic_info where user_id = '11111111-1111-1111-1111-111111111111'),
  1, '(a) registar um estudante cria uma linha em academic_info');
select is(
  (select p.full_name || '|' || a.course
     from public.profiles p join public.academic_info a on a.user_id = p.id
    where p.id = '11111111-1111-1111-1111-111111111111'),
  'Ana Silva|Engenharia Informática',
  '(a) o nome e o curso ficam normalizados (espaços colapsados e btrim)');

-- B: professor com dados académicos preenchidos (revisão, ponto 2).
select pg_temp.signup('22222222-2222-2222-2222-222222222222', 'bruno@example.test', jsonb_build_object(
  'full_name', 'Bruno Costa', 'phone', '923456789', 'affiliation', 'teacher', 'terms_accepted', true,
  'academic', jsonb_build_object('course', 'Direito', 'curricular_year', '1.º ano', 'shift', 'Tarde', 'class_group', 'B2')
));
select is(
  (select count(*)::int from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  1, '(b) registar um professor cria uma linha em profiles');
select is(
  (select count(*)::int from public.academic_info where user_id = '22222222-2222-2222-2222-222222222222'),
  0, '(b) o professor não fica com academic_info, mesmo que os campos venham preenchidos');

-- C: segunda estudante, para os testes de isolamento de academic_info.
select pg_temp.signup('66666666-6666-6666-6666-666666666666', 'catia@example.test', jsonb_build_object(
  'full_name', 'Cátia Mendes', 'phone', '956789012', 'affiliation', 'student', 'terms_accepted', true,
  'academic', jsonb_build_object('course', 'Economia', 'curricular_year', '3.º ano', 'shift', 'Noite', 'class_group', 'C3')
));

-- (c) Telefone (revisão, ponto 1): só 9XXXXXXXX; a normalização é do frontend.
select throws_ok(
  $$ select pg_temp.signup('33333333-3333-3333-3333-333333333331', 'c1@example.test',
       '{"full_name":"Carla Dias","phone":"812345678","affiliation":"staff","terms_accepted":true}') $$,
  'P0001', 'INVALID_PHONE', '(c) telefone 812345678 (não começa por 9) faz o registo falhar');
select throws_ok(
  $$ select pg_temp.signup('33333333-3333-3333-3333-333333333332', 'c2@example.test',
       '{"full_name":"Carla Dias","phone":"91234567","affiliation":"staff","terms_accepted":true}') $$,
  'P0001', 'INVALID_PHONE', '(c) telefone 91234567 (8 dígitos) faz o registo falhar');
select throws_ok(
  $$ select pg_temp.signup('33333333-3333-3333-3333-333333333333', 'c3@example.test',
       '{"full_name":"Carla Dias","phone":"912 345 678","affiliation":"staff","terms_accepted":true}') $$,
  'P0001', 'INVALID_PHONE', '(c) telefone com espaços faz o registo falhar');
select throws_ok(
  $$ select pg_temp.signup('33333333-3333-3333-3333-333333333334', 'c4@example.test',
       '{"full_name":"Carla Dias","phone":"+244912345678","affiliation":"staff","terms_accepted":true}') $$,
  'P0001', 'INVALID_PHONE', '(c) telefone com +244 faz o registo falhar');
select throws_ok(
  $$ select pg_temp.signup('33333333-3333-3333-3333-333333333335', 'c5@example.test',
       '{"full_name":"Carla Dias","phone":"00244912345678","affiliation":"staff","terms_accepted":true}') $$,
  'P0001', 'INVALID_PHONE', '(c) telefone com 00244 faz o registo falhar');

-- (d) Nome e dados académicos (revisão, ponto 5).
select throws_ok(
  format($$ select pg_temp.signup('44444444-4444-4444-4444-444444444441', 'd1@example.test',
       jsonb_build_object('full_name', %L, 'phone', '934567890', 'affiliation', 'staff', 'terms_accepted', true)) $$,
    repeat('x', 500)),
  'P0001', 'INVALID_NAME', '(d) full_name com 500 caracteres faz o registo falhar');
select throws_ok(
  $$ select pg_temp.signup('44444444-4444-4444-4444-444444444442', 'd2@example.test',
       jsonb_build_object('full_name', E' \t  ', 'phone', '934567890', 'affiliation', 'staff', 'terms_accepted', true)) $$,
  'P0001', 'INVALID_NAME', '(d) full_name só com espaços (incluindo tab e NBSP) faz o registo falhar');
select throws_ok(
  format($$ select pg_temp.signup('44444444-4444-4444-4444-444444444443', 'd3@example.test',
       jsonb_build_object('full_name', 'Dora Lima', 'phone', '934567890', 'affiliation', 'student', 'terms_accepted', true,
         'academic', jsonb_build_object('course', %L, 'curricular_year', '1', 'shift', 'Noite', 'class_group', 'C'))) $$,
    repeat('y', 81)),
  'P0001', 'INVALID_ACADEMIC', '(d) curso com 81 caracteres faz o registo falhar');

-- Termos, vínculo e estudante sem dados académicos.
select throws_ok(
  $$ select pg_temp.signup('55555555-5555-5555-5555-555555555551', 'e1@example.test',
       '{"full_name":"Eva Neto","phone":"945678901","affiliation":"staff","terms_accepted":false}') $$,
  'P0001', 'TERMS_REQUIRED', 'sem terms_accepted = true o registo falha com TERMS_REQUIRED');
select throws_ok(
  $$ select pg_temp.signup('55555555-5555-5555-5555-555555555552', 'e2@example.test',
       '{"full_name":"Eva Neto","phone":"945678901","affiliation":"student","terms_accepted":true}') $$,
  'P0001', 'ACADEMIC_REQUIRED', 'um estudante sem dados académicos faz o registo falhar');
select throws_ok(
  $$ select pg_temp.signup('55555555-5555-5555-5555-555555555553', 'e3@example.test',
       '{"full_name":"Eva Neto","phone":"945678901","affiliation":"student","terms_accepted":true,
         "academic":{"course":"Gestão","curricular_year":"   ","shift":"Manhã","class_group":"A"}}') $$,
  'P0001', 'ACADEMIC_REQUIRED', 'um estudante com um campo académico vazio faz o registo falhar');
select throws_ok(
  $$ select pg_temp.signup('55555555-5555-5555-5555-555555555554', 'e4@example.test',
       '{"full_name":"Eva Neto","phone":"945678901","affiliation":"admin","terms_accepted":true}') $$,
  'P0001', 'INVALID_AFFILIATION', 'um vínculo fora do enum faz o registo falhar com INVALID_AFFILIATION');

-- Opções académicas: uma ativa e uma inativa.
insert into public.academic_options (kind, label, is_active, position)
values ('course', 'Opção ativa', true, 0), ('course', 'Opção inativa', false, 1);

-- ===========================================================================
-- Privilégios por omissão (objetos criados depois da migração)
-- ===========================================================================
create function public.zz_probe() returns int language sql as $$ select 1 $$;
create table public.zz_probe_t (id int);
select ok(not has_function_privilege('anon', 'public.zz_probe()', 'EXECUTE'),
  'uma função nova em public não é executável por anon');
select ok(not has_function_privilege('authenticated', 'public.zz_probe()', 'EXECUTE'),
  'uma função nova em public não é executável por authenticated');
select ok(not has_table_privilege('anon', 'public.zz_probe_t', 'SELECT'),
  'uma tabela nova em public não é legível por anon');
select ok(not has_table_privilege('authenticated', 'public.zz_probe_t', 'SELECT'),
  'uma tabela nova em public não é legível por authenticated');

-- (j) is_admin() fechada.
select ok(not has_function_privilege('authenticated', 'private.is_admin()', 'EXECUTE'),
  '(j) authenticated não tem EXECUTE em private.is_admin()');

-- Invariante «academic_info só para estudantes», garantida pelo esquema.
select throws_ok(
  $$ update public.profiles set affiliation = 'teacher' where id = '66666666-6666-6666-6666-666666666666' $$,
  '23503', null,
  'mudar para teacher um estudante com academic_info falha (FK composta)');

-- ===========================================================================
-- Como a utilizadora A (autenticada)
-- ===========================================================================
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

-- (e) Isolamento (revisão, ponto 3).
select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  '(e) como A, select em profiles devolve só a própria linha');
select results_eq(
  $$ select user_id from public.academic_info $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  '(e) como A, select em academic_info devolve só a própria linha (C também existe)');
select throws_ok(
  $$ select phone from public.profiles $$,
  '42501', null,
  'como A, a coluna phone não é legível diretamente (só por get_my_profile)');

-- (f) Não pode mudar o próprio vínculo.
select throws_ok(
  $$ update public.profiles set affiliation = 'staff' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, '(f) como A, update de affiliation falha com permission denied');

-- Telefone e nome inválidos por update direto (revisão, pontos 1 e 5).
select throws_ok(
  $$ update public.profiles set phone = '+244912345678' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'como A, update de phone para +244912345678 falha');
select throws_ok(
  format($$ update public.profiles set full_name = %L where id = '11111111-1111-1111-1111-111111111111' $$, repeat('x', 500)),
  '23514', null, 'como A, update de full_name com 500 caracteres falha');
select throws_ok(
  $$ update public.profiles set full_name = E'\t\t' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'como A, update de full_name só com tabs falha');
select throws_ok(
  $$ update public.profiles set full_name = E'Ana\u0001Bela' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'como A, update de full_name com um carácter de controlo falha');

-- Normalização no update.
update public.profiles set full_name = E'  Ana    Bela​  ' where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ana Bela',
  'como A, o full_name fica normalizado (espaços, NBSP e zero-width)');

-- (g) Pode mudar o próprio nome.
select lives_ok(
  $$ update public.profiles set full_name = 'Ana B' where id = '11111111-1111-1111-1111-111111111111' $$,
  '(g) como A, update de full_name no próprio perfil funciona');
select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ana B', '(g) o novo nome fica gravado');

-- Pode mudar os próprios dados académicos, normalizados.
update public.academic_info set course = '  Gestão   de Empresas ' where user_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select course from public.academic_info where user_id = '11111111-1111-1111-1111-111111111111'),
  'Gestão de Empresas', 'como A, update de course no próprio registo funciona e fica normalizado');

-- Insert, delete e colunas privilegiadas negados.
select throws_ok(
  $$ insert into public.profiles (id, full_name, phone, affiliation, terms_accepted_at)
     values ('77777777-7777-7777-7777-777777777777', 'Intruso', '912345678', 'staff', now()) $$,
  '42501', null, 'como A, insert em profiles falha com permission denied');
select throws_ok(
  $$ delete from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'como A, delete em profiles falha com permission denied');
select throws_ok(
  $$ insert into public.academic_info (user_id, course, curricular_year, shift, class_group)
     values ('22222222-2222-2222-2222-222222222222', 'X', '1', 'M', 'A') $$,
  '42501', null, 'como A, insert em academic_info falha com permission denied');
select throws_ok(
  $$ delete from public.academic_info where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'como A, delete em academic_info falha com permission denied');
select throws_ok(
  $$ update public.academic_info set user_id = '66666666-6666-6666-6666-666666666666'
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'como A, update de academic_info.user_id falha com permission denied');
select throws_ok(
  $$ update public.academic_info set course_option_id = gen_random_uuid()
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'como A, update de academic_info.course_option_id falha com permission denied');

-- Linhas de outras pessoas: a RLS esconde-as, 0 linhas alteradas.
update public.profiles set full_name = 'Pirata' where id = '22222222-2222-2222-2222-222222222222';
update public.academic_info set course = 'Pirataria' where user_id = '66666666-6666-6666-6666-666666666666';
reset role;
select is(
  (select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'Bruno Costa', 'como A, update no perfil de B não altera nada');
select is(
  (select course from public.academic_info where user_id = '66666666-6666-6666-6666-666666666666'),
  'Economia', 'como A, update em academic_info de C não altera nada');
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

-- (h) Não se pode inserir em admin_users.
select throws_ok(
  $$ insert into public.admin_users (user_id) values ('11111111-1111-1111-1111-111111111111') $$,
  '42501', null, '(h) como A, insert em admin_users falha com permission denied');

-- (j) private.is_admin() não é executável por authenticated.
select throws_ok(
  $$ select private.is_admin() $$,
  '42501', null, '(j) authenticated não pode executar private.is_admin()');

-- (l) Só as opções académicas ativas.
select results_eq(
  $$ select label from public.academic_options order by position $$,
  $$ values ('Opção ativa'::text) $$,
  '(l) como A, select em academic_options devolve só as ativas');

-- get_my_profile() sem ser administradora.
select results_eq(
  $$ select full_name, phone, affiliation::text, course, is_admin from public.get_my_profile() $$,
  $$ values ('Ana B'::text, '912345678'::text, 'student'::text, 'Gestão de Empresas'::text, false) $$,
  'get_my_profile() devolve o próprio perfil, com o telefone, e is_admin = false');

-- (k) Depois de ser promovida por postgres, is_admin = true.
reset role;
insert into public.admin_users (user_id) values ('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(
  (select is_admin from public.get_my_profile()),
  true, '(k) depois do insert como postgres, get_my_profile() devolve is_admin = true');

-- Quem não tem perfil recebe 0 linhas.
select pg_temp.as_user('99999999-9999-9999-9999-999999999999');
select is_empty(
  $$ select * from public.get_my_profile() $$,
  'get_my_profile() sem perfil devolve 0 linhas');

-- ===========================================================================
-- (i) Como anon. O comportamento real é «falha com 42501»: anon não tem
-- nenhum grant em profiles, academic_info nem admin_users.
-- ===========================================================================
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select 1 from public.profiles $$, '42501', null,
  '(i) como anon, select em profiles falha com permission denied');
select throws_ok($$ select 1 from public.academic_info $$, '42501', null,
  '(i) como anon, select em academic_info falha com permission denied');
select throws_ok($$ select 1 from public.admin_users $$, '42501', null,
  '(i) como anon, select em admin_users falha com permission denied');
select throws_ok($$ select * from public.get_my_profile() $$, '42501', null,
  'como anon, get_my_profile() falha com permission denied');
select results_eq(
  $$ select label from public.academic_options $$,
  $$ values ('Opção ativa'::text) $$,
  'como anon, select em academic_options devolve só as ativas');
reset role;

-- ===========================================================================
-- Segunda barreira (§9): mesmo com grants concedidos por engano, os triggers
-- recusam as colunas privilegiadas. B é professor (sem academic_info), por
-- isso aqui só o trigger pode recusar.
-- ===========================================================================
grant update (affiliation) on public.profiles to authenticated;
grant update (course_option_id, user_id) on public.academic_info to authenticated;
set local role authenticated;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ update public.profiles set affiliation = 'staff' where id = '22222222-2222-2222-2222-222222222222' $$,
  'P0001', 'NOT_ALLOWED',
  'com update(affiliation) concedido por engano, o trigger recusa com NOT_ALLOWED');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ update public.academic_info set course_option_id = (select id from public.academic_options limit 1)
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001', 'NOT_ALLOWED',
  'com update(course_option_id) concedido por engano, o trigger recusa com NOT_ALLOWED');
select throws_ok(
  $$ update public.academic_info set user_id = '66666666-6666-6666-6666-666666666666'
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001', 'NOT_ALLOWED',
  'com update(user_id) concedido por engano, o trigger recusa com NOT_ALLOWED');
reset role;

select * from finish();
rollback;
