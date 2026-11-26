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
--    que se aplica ao papel atual). A forma global (sem «in schema») retira o
--    EXECUTE que o Postgres dá a PUBLIC em todas as funções novas, em
--    qualquer esquema.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter default privileges for role postgres revoke execute on functions from public;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Normalização de texto livre.
--    * retira caracteres invisíveis de largura zero, de formatação e de
--      controlo bidi (U+200B–U+200F, U+202A–U+202E, U+2066–U+2069, U+FEFF,
--      U+2060, U+00AD, U+061C, U+180E);
--    * colapsa qualquer sequência de espaço em branco (incluindo tab, quebras
--      de linha e U+00A0) num só espaço e faz btrim.
--    Os caracteres de controlo que restarem são recusados pelo trigger e pelos
--    CHECKs. Devolve nulo para nulo.
-- ---------------------------------------------------------------------------
create function private.normalize_text(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        p,
        '[​-‏‪-‮⁦-⁩﻿⁠­؜᠎]',
        '',
        'g'
      ),
      '[[:space:] ]+', ' ', 'g'
    )
  );
$$;
revoke execute on function private.normalize_text(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tipos e tabelas. Os CHECKs são a última barreira: o valor gravado já tem
--    de estar normalizado (sem espaços nas pontas, com pelo menos um carácter
--    visível e sem caracteres de controlo), e os limites aplicam-se a ele.
-- ---------------------------------------------------------------------------
create type public.affiliation as enum ('student', 'teacher', 'staff');
create type public.academic_option_kind as enum ('course', 'curricular_year', 'shift', 'class_group');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    check (
      full_name = btrim(full_name)
      and full_name ~ '[^[:space:]]'
      and full_name !~ '[[:cntrl:]]'
      and char_length(full_name) between 2 and 120
    ),
  phone text not null check (phone ~ '^9[0-9]{8}$'),
  affiliation public.affiliation not null,
  terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Alvo da FK composta de academic_info: garante «só estudantes».
  unique (id, affiliation)
);

-- Vazia no MVP: a futura lista configurável pela administração.
create table public.academic_options (
  id uuid primary key default gen_random_uuid(),
  kind public.academic_option_kind not null,
  label text not null
    check (
      label = btrim(label)
      and label ~ '[^[:space:]]'
      and label !~ '[[:cntrl:]]'
      and char_length(label) between 1 and 80
    ),
  is_active boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index academic_options_kind_label_key on public.academic_options (kind, lower(label));

-- Só para estudantes: a coluna affiliation está fixa em 'student' e a FK
-- composta aponta para (profiles.id, profiles.affiliation). Mudar o vínculo de
-- um estudante que tenha academic_info falha (on update restrict).
-- Os campos são texto livre; os *_option_id ficam nulos até existirem listas.
create table public.academic_info (
  user_id uuid primary key,
  affiliation public.affiliation not null default 'student' check (affiliation = 'student'),
  course text not null
    check (
      course = btrim(course) and course ~ '[^[:space:]]' and course !~ '[[:cntrl:]]'
      and char_length(course) between 1 and 80
    ),
  curricular_year text not null
    check (
      curricular_year = btrim(curricular_year) and curricular_year ~ '[^[:space:]]'
      and curricular_year !~ '[[:cntrl:]]' and char_length(curricular_year) between 1 and 20
    ),
  shift text not null
    check (
      shift = btrim(shift) and shift ~ '[^[:space:]]' and shift !~ '[[:cntrl:]]'
      and char_length(shift) between 1 and 20
    ),
  class_group text not null
    check (
      class_group = btrim(class_group) and class_group ~ '[^[:space:]]'
      and class_group !~ '[[:cntrl:]]' and char_length(class_group) between 1 and 20
    ),
  course_option_id uuid null references public.academic_options (id) on delete restrict,
  curricular_year_option_id uuid null references public.academic_options (id) on delete restrict,
  shift_option_id uuid null references public.academic_options (id) on delete restrict,
  class_option_id uuid null references public.academic_options (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, affiliation)
    references public.profiles (id, affiliation)
    on delete cascade
    on update restrict
);

create index academic_info_user_id_affiliation_idx on public.academic_info (user_id, affiliation);
create index academic_info_course_option_id_idx on public.academic_info (course_option_id);
create index academic_info_curricular_year_option_id_idx on public.academic_info (curricular_year_option_id);
create index academic_info_shift_option_id_idx on public.academic_info (shift_option_id);
create index academic_info_class_option_id_idx on public.academic_info (class_option_id);

-- A única fonte de «é administrador». Sem escrita pelo cliente. Apagar uma
-- conta que é (ou promoveu) administrador exige retirá-la daqui primeiro.
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete restrict
);

create index admin_users_created_by_idx on public.admin_users (created_by);

-- ---------------------------------------------------------------------------
-- 5. Triggers de tabela.
-- ---------------------------------------------------------------------------

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

create trigger set_updated_at
  before update on public.academic_options
  for each row execute function private.set_updated_at();

-- Normaliza os campos de texto livre antes de gravar e recusa caracteres de
-- controlo com 23514 (a mesma família de erro dos CHECKs), sem repetir o
-- valor. É SECURITY DEFINER só para poder chamar private.normalize_text
-- quando o trigger corre como authenticated (sem USAGE em private); não lê
-- nem escreve nenhuma tabela.
create function private.normalize_text_fields()
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
  end if;
  return new;
end;
$$;
revoke execute on function private.normalize_text_fields() from public, anon, authenticated;

create trigger normalize_text_fields
  before insert or update on public.profiles
  for each row execute function private.normalize_text_fields();

create trigger normalize_text_fields
  before insert or update on public.academic_info
  for each row execute function private.normalize_text_fields();

-- Segunda barreira (§9): as colunas privilegiadas já estão fora do GRANT
-- UPDATE; se um grant escapar por engano, este trigger recusa a alteração.
-- Só deixa passar:
--   * current_user postgres ou supabase_admin (migrações, painel e funções
--     SECURITY DEFINER do dono das tabelas);
--   * o service_role, como papel atual ou papel da sessão.
-- Todos os outros papéis são verificados.
create function private.prevent_privileged_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if tg_table_name = 'profiles' then
    if new.id is distinct from old.id
       or new.affiliation is distinct from old.affiliation
       or new.terms_accepted_at is distinct from old.terms_accepted_at
       or new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
    end if;
  elsif tg_table_name = 'academic_info' then
    if new.user_id is distinct from old.user_id
       or new.affiliation is distinct from old.affiliation
       or new.course_option_id is distinct from old.course_option_id
       or new.curricular_year_option_id is distinct from old.curricular_year_option_id
       or new.shift_option_id is distinct from old.shift_option_id
       or new.class_option_id is distinct from old.class_option_id
       or new.created_at is distinct from old.created_at then
      raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
    end if;
  end if;

  return new;
end;
$$;
revoke execute on function private.prevent_privileged_columns() from public, anon, authenticated;

create trigger prevent_privileged_columns
  before update on public.profiles
  for each row execute function private.prevent_privileged_columns();

create trigger prevent_privileged_columns
  before update on public.academic_info
  for each row execute function private.prevent_privileged_columns();

-- ---------------------------------------------------------------------------
-- 6. Registo: cria o perfil (e, para estudantes, os dados académicos) a partir
--    dos metadados do registo. Os metadados só servem para estes campos de
--    perfil, nunca para papéis. Valida tudo antes de converter ou inserir e
--    falha com códigos estáveis (P0001), sem nunca repetir o valor recebido.
--    Os CHECKs das tabelas continuam a ser a última barreira.
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_affiliation_text text := meta ->> 'affiliation';
  v_affiliation public.affiliation;
  v_name text := private.normalize_text(meta ->> 'full_name');
  v_phone text := meta ->> 'phone';
  v_academic jsonb := meta -> 'academic';
  v_course text;
  v_year text;
  v_shift text;
  v_class text;
begin
  -- Comparação de jsonb: só o booleano true passa.
  if (meta -> 'terms_accepted') is distinct from 'true'::jsonb then
    raise exception using errcode = 'P0001', message = 'TERMS_REQUIRED';
  end if;

  if v_affiliation_text is null
     or not (v_affiliation_text = any (enum_range(null::public.affiliation)::text[])) then
    raise exception using errcode = 'P0001', message = 'INVALID_AFFILIATION';
  end if;
  v_affiliation := v_affiliation_text::public.affiliation;

  if v_name is null or v_name !~ '[^[:space:]]' or v_name ~ '[[:cntrl:]]'
     or char_length(v_name) not between 2 and 120 then
    raise exception using errcode = 'P0001', message = 'INVALID_NAME';
  end if;

  -- O frontend normaliza +244, 00244 e espaços; aqui só entra 9XXXXXXXX.
  if v_phone is null or v_phone !~ '^9[0-9]{8}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_PHONE';
  end if;

  if v_affiliation = 'student' then
    if v_academic is null or jsonb_typeof(v_academic) <> 'object' then
      raise exception using errcode = 'P0001', message = 'ACADEMIC_REQUIRED';
    end if;
    v_course := private.normalize_text(v_academic ->> 'course');
    v_year := private.normalize_text(v_academic ->> 'curricular_year');
    v_shift := private.normalize_text(v_academic ->> 'shift');
    v_class := private.normalize_text(v_academic ->> 'class_group');

    if coalesce(v_course, '') = '' or coalesce(v_year, '') = ''
       or coalesce(v_shift, '') = '' or coalesce(v_class, '') = '' then
      raise exception using errcode = 'P0001', message = 'ACADEMIC_REQUIRED';
    end if;

    if char_length(v_course) > 80 or char_length(v_year) > 20
       or char_length(v_shift) > 20 or char_length(v_class) > 20
       or concat(v_course, v_year, v_shift, v_class) ~ '[[:cntrl:]]' then
      raise exception using errcode = 'P0001', message = 'INVALID_ACADEMIC';
    end if;
  end if;

  insert into public.profiles (id, full_name, phone, affiliation, terms_accepted_at)
  values (new.id, v_name, v_phone, v_affiliation, now());

  -- Professores e funcionários: os dados académicos recebidos são ignorados.
  if v_affiliation = 'student' then
    insert into public.academic_info (user_id, course, curricular_year, shift, class_group)
    values (new.id, v_course, v_year, v_shift, v_class);
  end if;

  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- 7. Administração: lida em cada pedido a partir de admin_users, nunca do JWT.
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
-- 8. RLS em todas as tabelas, com políticas por operação e por papel.
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
-- 9. Permissões por coluna. O telefone fica fora do SELECT direto (o próprio
--    lê-o por get_my_profile); o vínculo, as datas e as colunas de ligação
--    ficam fora do UPDATE.
-- ---------------------------------------------------------------------------
grant select (id, full_name, affiliation, terms_accepted_at, created_at, updated_at)
  on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select, update (course, curricular_year, shift, class_group) on public.academic_info to authenticated;
grant select on public.academic_options to anon, authenticated;

-- service_role (só no servidor, nunca no cliente): privilégios explícitos.
-- Com auto_expose_new_tables = false nada lhe é dado por omissão, e assim o
-- ambiente local e o remoto ficam iguais. O service_role passa as RLS.
grant select, insert, update, delete
  on public.profiles, public.academic_info, public.academic_options, public.admin_users
  to service_role;

-- ---------------------------------------------------------------------------
-- 10. Perfil do próprio, com os dados académicos e o estado de administrador.
--     Quem não tem perfil recebe 0 linhas.
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
-- Não se dá ao service_role: sem JWT de utilizador, auth.uid() é nulo e a
-- função devolveria sempre 0 linhas. O servidor lê as tabelas diretamente.
revoke execute on function public.get_my_profile() from public, anon, authenticated;
grant execute on function public.get_my_profile() to authenticated;
