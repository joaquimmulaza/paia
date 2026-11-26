-- Testes pgTAP da fundação F0: perfis, dados académicos, administradores e RLS.
-- Corre com `npm run db:test` (supabase test db), só contra a base local.
-- Tudo corre numa transação que termina em rollback: nada fica gravado.
begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

-- ---------------------------------------------------------------------------
-- Dados de teste. Os utilizadores são criados como postgres em auth.users,
-- para que o trigger on_auth_user_created corra como num registo real.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'ana@example.test', '',
  jsonb_build_object(
    'full_name', '  Ana Silva  ',
    'phone', '912345678',
    'affiliation', 'student',
    'terms_accepted', true,
    'academic', jsonb_build_object(
      'course', ' Engenharia Informática ',
      'curricular_year', '2.º ano',
      'shift', 'Manhã',
      'class_group', 'A1'
    )
  ),
  now(), now()
);

-- (a) Estudante: cria profiles e academic_info, com os textos depois de btrim.
select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  1,
  '(a) registar um estudante cria uma linha em profiles'
);
select is(
  (select count(*)::int from public.academic_info where user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  '(a) registar um estudante cria uma linha em academic_info'
);
select is(
  (select full_name || '|' || a.course
     from public.profiles p join public.academic_info a on a.user_id = p.id
    where p.id = '11111111-1111-1111-1111-111111111111'),
  'Ana Silva|Engenharia Informática',
  '(a) o nome e o curso ficam guardados depois de btrim'
);

-- (b) Professor com dados académicos preenchidos: só profiles (revisão, ponto 2).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated', 'bruno@example.test', '',
  jsonb_build_object(
    'full_name', 'Bruno Costa',
    'phone', '923456789',
    'affiliation', 'teacher',
    'terms_accepted', true,
    'academic', jsonb_build_object(
      'course', 'Direito', 'curricular_year', '1.º ano', 'shift', 'Tarde', 'class_group', 'B2'
    )
  ),
  now(), now()
);
select is(
  (select count(*)::int from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  1,
  '(b) registar um professor cria uma linha em profiles'
);
select is(
  (select count(*)::int from public.academic_info where user_id = '22222222-2222-2222-2222-222222222222'),
  0,
  '(b) o professor não fica com academic_info, mesmo que os campos venham preenchidos'
);

-- (c) Telefone inválido (revisão, ponto 1).
select throws_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
       'authenticated', 'authenticated', 'c1@example.test', '',
       '{"full_name":"Carla Dias","phone":"812345678","affiliation":"staff","terms_accepted":true}'::jsonb,
       now(), now()) $$,
  '23514',
  null,
  '(c) telefone 812345678 (não começa por 9) faz o registo falhar'
);
select throws_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333334',
       'authenticated', 'authenticated', 'c2@example.test', '',
       '{"full_name":"Carla Dias","phone":"91234567","affiliation":"staff","terms_accepted":true}'::jsonb,
       now(), now()) $$,
  '23514',
  null,
  '(c) telefone 91234567 (8 dígitos) faz o registo falhar'
);

-- (d) Nome de 500 caracteres (revisão, ponto 5) e nome só com espaços.
select throws_ok(
  format(
    $$ insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
         'authenticated', 'authenticated', 'd1@example.test', '',
         jsonb_build_object('full_name', %L, 'phone', '934567890', 'affiliation', 'staff', 'terms_accepted', true),
         now(), now()) $$,
    repeat('x', 500)
  ),
  '23514',
  null,
  '(d) full_name com 500 caracteres faz o registo falhar'
);
select throws_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444445',
       'authenticated', 'authenticated', 'd2@example.test', '',
       '{"full_name":"     ","phone":"934567890","affiliation":"staff","terms_accepted":true}'::jsonb,
       now(), now()) $$,
  '23514',
  null,
  '(d) full_name só com espaços faz o registo falhar'
);
select throws_ok(
  format(
    $$ insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444446',
         'authenticated', 'authenticated', 'd3@example.test', '',
         jsonb_build_object('full_name', 'Dora Lima', 'phone', '934567890', 'affiliation', 'student', 'terms_accepted', true,
           'academic', jsonb_build_object('course', %L, 'curricular_year', '1', 'shift', 'Noite', 'class_group', 'C')),
         now(), now()) $$,
    repeat('y', 81)
  ),
  '23514',
  null,
  '(d) curso com 81 caracteres faz o registo falhar'
);

-- Termos e estudante sem dados académicos.
select throws_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555',
       'authenticated', 'authenticated', 'e1@example.test', '',
       '{"full_name":"Eva Neto","phone":"945678901","affiliation":"staff","terms_accepted":false}'::jsonb,
       now(), now()) $$,
  'P0001',
  'TERMS_REQUIRED',
  'sem terms_accepted = true o registo falha com TERMS_REQUIRED'
);
select throws_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555556',
       'authenticated', 'authenticated', 'e2@example.test', '',
       '{"full_name":"Eva Neto","phone":"945678901","affiliation":"student","terms_accepted":true}'::jsonb,
       now(), now()) $$,
  '23502',
  null,
  'um estudante sem dados académicos faz o registo falhar'
);

-- Opções académicas: uma ativa e uma inativa.
insert into public.academic_options (kind, label, is_active, position)
values ('course', 'Opção ativa', true, 0), ('course', 'Opção inativa', false, 1);

-- ---------------------------------------------------------------------------
-- A partir daqui, como a utilizadora A (autenticada).
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- (e) Só vê o próprio perfil (revisão, ponto 3).
select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  '(e) como A, select em profiles devolve só a própria linha'
);
select is(
  (select count(*)::int from public.academic_info),
  1,
  '(e) como A, select em academic_info devolve só a própria linha'
);

-- (f) Não pode mudar o próprio vínculo (revisão, ponto 3).
select throws_ok(
  $$ update public.profiles set affiliation = 'staff' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  '(f) como A, update de affiliation falha com permission denied'
);

-- (g) Pode mudar o próprio nome.
select lives_ok(
  $$ update public.profiles set full_name = 'Ana B' where id = '11111111-1111-1111-1111-111111111111' $$,
  '(g) como A, update de full_name no próprio perfil funciona'
);
select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ana B',
  '(g) o novo nome fica gravado'
);

-- Não consegue alterar o perfil de B: a RLS esconde a linha, 0 linhas alteradas.
update public.profiles set full_name = 'Pirata' where id = '22222222-2222-2222-2222-222222222222';
reset role;
select is(
  (select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'Bruno Costa',
  'como A, update no perfil de B não altera nada'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- (h) Não se pode inserir em admin_users (revisão, ponto 3).
select throws_ok(
  $$ insert into public.admin_users (user_id) values ('11111111-1111-1111-1111-111111111111') $$,
  '42501',
  null,
  '(h) como A, insert em admin_users falha com permission denied'
);

-- (j) private.is_admin() não é executável por authenticated.
select throws_ok(
  $$ select private.is_admin() $$,
  '42501',
  null,
  '(j) authenticated não pode executar private.is_admin()'
);

-- (l) Só as opções académicas ativas.
select results_eq(
  $$ select label from public.academic_options order by position $$,
  $$ values ('Opção ativa'::text) $$,
  '(l) como A, select em academic_options devolve só as ativas'
);

-- ---------------------------------------------------------------------------
-- (k) Depois de ser promovida por postgres, get_my_profile() diz is_admin = true.
-- ---------------------------------------------------------------------------
reset role;
insert into public.admin_users (user_id) values ('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select results_eq(
  $$ select full_name, affiliation::text, course, is_admin from public.get_my_profile() $$,
  $$ values ('Ana B'::text, 'student'::text, 'Engenharia Informática'::text, true) $$,
  '(k) depois do insert como postgres, get_my_profile() devolve is_admin = true'
);

-- ---------------------------------------------------------------------------
-- (i) Como anon. O comportamento real é «falha»: anon não tem nenhum grant em
-- profiles, academic_info nem admin_users, por isso o select dá 42501.
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select 1 from public.profiles $$,
  '42501',
  null,
  '(i) como anon, select em profiles falha com permission denied'
);
select throws_ok(
  $$ select 1 from public.academic_info $$,
  '42501',
  null,
  '(i) como anon, select em academic_info falha com permission denied'
);
select throws_ok(
  $$ select 1 from public.admin_users $$,
  '42501',
  null,
  '(i) como anon, select em admin_users falha com permission denied'
);
reset role;

-- ---------------------------------------------------------------------------
-- Segunda barreira (§9): mesmo que alguém conceda por engano update(affiliation)
-- a authenticated, o trigger prevent_privileged_columns recusa a alteração.
-- ---------------------------------------------------------------------------
grant update (affiliation) on public.profiles to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$ update public.profiles set affiliation = 'staff' where id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001',
  'NOT_ALLOWED',
  'com update(affiliation) concedido por engano, o trigger recusa com NOT_ALLOWED'
);
reset role;

select * from finish();
rollback;
