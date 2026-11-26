-- Promove o primeiro administrador do PAIÁ.
--
-- Uso: abrir este ficheiro no editor SQL do painel do Supabase, substituir
-- <EMAIL_DO_RESPONSAVEL> pelo email com que o responsável se registou e correr.
-- A conta tem de existir antes (registo normal na aplicação).
-- Não gravar o email real neste ficheiro nem fazer commit dele.
-- Os administradores seguintes são acrescentados da mesma forma.
--
-- O email é comparado sem distinguir maiúsculas. Se não existir nenhuma conta
-- com esse email, o script falha; se a conta já for administradora, avisa e
-- não altera nada.

do $$
declare
  v_email constant text := '<EMAIL_DO_RESPONSAVEL>';
  v_user_id uuid;
  v_inserted integer;
begin
  select id into strict v_user_id
  from auth.users
  where lower(email) = lower(v_email);

  insert into public.admin_users (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise notice 'A conta já era administradora; nada foi alterado.';
  else
    raise notice 'Administrador acrescentado.';
  end if;
exception
  when no_data_found then
    raise exception 'Não existe nenhuma conta com esse email.';
  when too_many_rows then
    raise exception 'Há mais de uma conta com esse email; resolver à mão.';
end;
$$;
