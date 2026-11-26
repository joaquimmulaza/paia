-- F0: perfis, dados académicos em texto livre, administradores e RLS.
-- O cliente usa só a chave anon e é tratado como hostil: todas as regras de
-- acesso vivem aqui (RLS, grants por coluna e triggers), nunca no frontend.

-- ---------------------------------------------------------------------------
-- 1. Esquema privado: funções internas que o cliente nunca chama diretamente.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Fechar tudo em public. Cada tabela recebe depois só os grants de que
--    precisa. As migrações do Supabase correm como postgres, por isso os
--    default privileges são alterados para esse papel (e na forma simples,
--    que se aplica ao papel atual).
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tipos e tabelas.
-- ---------------------------------------------------------------------------
create type public.affiliation as enum ('student', 'teacher', 'staff');
create type public.academic_option_kind as enum ('course', 'curricular_year', 'shift', 'class_group');

-- Os comprimentos são medidos depois de btrim, para que um texto só com
-- espaços seja recusado; o máximo também se aplica ao valor bruto.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    check (char_length(btrim(full_name)) between 2 and 120 and char_length(full_name) <= 120),
  phone text not null check (phone ~ '^9[0-9]{8}$'),
  affiliation public.affiliation not null,
  terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vazia no MVP: a futura lista configurável pela administração.
create table public.academic_options (
  id uuid primary key default gen_random_uuid(),
  kind public.academic_option_kind not null,
  label text not null check (char_length(btrim(label)) between 1 and 80 and char_length(label) <= 80),
  is_active boolean not null default true,
  position integer not null default 0,
  unique (kind, label)
);

-- Só para estudantes. Os campos são texto livre; os *_option_id ficam nulos
-- até existirem listas oficiais.
create table public.academic_info (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  course text not null
    check (char_length(btrim(course)) between 1 and 80 and char_length(course) <= 80),
  curricular_year text not null
    check (char_length(btrim(curricular_year)) between 1 and 20 and char_length(curricular_year) <= 20),
  shift text not null
    check (char_length(btrim(shift)) between 1 and 20 and char_length(shift) <= 20),
  class_group text not null
    check (char_length(btrim(class_group)) between 1 and 20 and char_length(class_group) <= 20),
  course_option_id uuid null references public.academic_options (id) on delete restrict,
  curricular_year_option_id uuid null references public.academic_options (id) on delete restrict,
  shift_option_id uuid null references public.academic_options (id) on delete restrict,
  class_option_id uuid null references public.academic_options (id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index academic_info_course_option_id_idx on public.academic_info (course_option_id);
create index academic_info_curricular_year_option_id_idx on public.academic_info (curricular_year_option_id);
create index academic_info_shift_option_id_idx on public.academic_info (shift_option_id);
create index academic_info_class_option_id_idx on public.academic_info (class_option_id);

-- A única fonte de «é administrador». Sem escrita pelo cliente.
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null
);

create index admin_users_created_by_idx on public.admin_users (created_by);

-- updated_at mantido por trigger.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.set_updated_at() from public, anon, authenticated;

create trigger set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger set_updated_at
  before update on public.academic_info
  for each row execute function private.set_updated_at();

-- Segunda barreira (§9): as colunas privilegiadas já estão fora do GRANT
-- UPDATE; se um grant escapar por engano, este trigger recusa a alteração.
-- Deixa passar:
--   * current_user postgres ou supabase_admin (migrações, painel e funções
--     SECURITY DEFINER do dono das tabelas);
--   * sessões cujo papel não é um papel de cliente (current_setting('role')
--     diferente de authenticated/anon, por exemplo service_role ou 'none').
-- Recusa tudo o resto, isto é, um cliente authenticated/anon a escrever
-- diretamente ou através de uma função SECURITY INVOKER.
create function private.prevent_privileged_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin')
     or coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.affiliation is distinct from old.affiliation
     or new.terms_accepted_at is distinct from old.terms_accepted_at
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;

  return new;
end;
$$;
revoke execute on function private.prevent_privileged_columns() from public, anon, authenticated;

create trigger prevent_privileged_columns
  before update on public.profiles
  for each row execute function private.prevent_privileged_columns();

-- ---------------------------------------------------------------------------
-- 4. Registo: cria o perfil (e, para estudantes, os dados académicos) a partir
--    dos metadados do registo. Os metadados só servem para estes campos de
--    perfil, nunca para papéis. Os erros nunca repetem os valores recebidos.
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_affiliation public.affiliation;
  v_academic jsonb;
begin
  -- Comparação de jsonb: só o booleano true passa, e um valor inválido não
  -- gera um erro de conversão com o valor recebido.
  if (meta -> 'terms_accepted') is distinct from 'true'::jsonb then
    raise exception using errcode = 'P0001', message = 'TERMS_REQUIRED';
  end if;

  -- Um valor fora do enum falha na conversão; um valor em falta dá nulo e
  -- falha no NOT NULL.
  v_affiliation := (meta ->> 'affiliation')::public.affiliation;

  insert into public.profiles (id, full_name, phone, affiliation, terms_accepted_at)
  values (new.id, btrim(meta ->> 'full_name'), meta ->> 'phone', v_affiliation, now());

  -- Professores e funcionários: os dados académicos recebidos são ignorados.
  if v_affiliation = 'student' then
    v_academic := meta -> 'academic';
    insert into public.academic_info (user_id, course, curricular_year, shift, class_group)
    values (
      new.id,
      btrim(v_academic ->> 'course'),
      btrim(v_academic ->> 'curricular_year'),
      btrim(v_academic ->> 'shift'),
      btrim(v_academic ->> 'class_group')
    );
  end if;

  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. Administração: lida em cada pedido a partir de admin_users, nunca do JWT.
-- ---------------------------------------------------------------------------
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;
revoke execute on function private.is_admin() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS em todas as tabelas, com políticas por operação e por papel.
--    Sem force row level security: as funções SECURITY DEFINER do dono das
--    tabelas precisam de passar as RLS e verificam auth.uid() por dentro.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.academic_info enable row level security;
alter table public.academic_options enable row level security;
alter table public.admin_users enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy academic_info_select_own on public.academic_info
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy academic_info_update_own on public.academic_info
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy academic_options_select_active on public.academic_options
  for select to anon, authenticated
  using (is_active);

-- admin_users: sem políticas para anon nem authenticated (nem grants).

-- ---------------------------------------------------------------------------
-- 7. Permissões. O affiliation e as datas ficam fora do GRANT UPDATE.
-- ---------------------------------------------------------------------------
grant select, update (full_name, phone) on public.profiles to authenticated;
grant select, update (course, curricular_year, shift, class_group) on public.academic_info to authenticated;
grant select on public.academic_options to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Perfil do próprio, com os dados académicos e o estado de administrador.
--    Quem não tem perfil recebe 0 linhas.
-- ---------------------------------------------------------------------------
create function public.get_my_profile()
returns table (
  full_name text,
  phone text,
  affiliation public.affiliation,
  course text,
  curricular_year text,
  shift text,
  class_group text,
  is_admin boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.full_name,
    p.phone,
    p.affiliation,
    a.course,
    a.curricular_year,
    a.shift,
    a.class_group,
    private.is_admin()
  from public.profiles p
  left join public.academic_info a on a.user_id = p.id
  where p.id = (select auth.uid());
$$;
revoke execute on function public.get_my_profile() from public, anon, authenticated;
grant execute on function public.get_my_profile() to authenticated;
