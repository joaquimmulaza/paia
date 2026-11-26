-- Promove o primeiro administrador do PAIÁ.
--
-- Uso: abrir este ficheiro no editor SQL do painel do Supabase, substituir
-- <EMAIL_DO_RESPONSAVEL> pelo email com que o responsável se registou e correr.
-- A conta tem de existir antes (registo normal na aplicação).
-- Não gravar o email real neste ficheiro nem fazer commit dele.
-- Os administradores seguintes são acrescentados da mesma forma.
-- Pode correr-se mais de uma vez: «on conflict do nothing» torna-o idempotente.

insert into public.admin_users (user_id)
select id
from auth.users
where email = '<EMAIL_DO_RESPONSAVEL>'
on conflict do nothing;
