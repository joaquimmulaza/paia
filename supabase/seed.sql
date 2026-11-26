-- Dados ilustrativos; nunca aplicar ao projeto remoto.
--
-- Corre só no Supabase local, no fim de `npm run db:reset`. Pessoas, lojas e
-- produtos são inventados (emails @exemplo.test); não há dados da UGS. As
-- categorias vêm da migração de F1, não daqui.
--
-- As contas não servem para entrar: a palavra-passe é um hash bcrypt de um
-- UUID aleatório que ninguém conhece, e o email não está confirmado. Os
-- perfis são criados pelo trigger de registo de F0, a partir dos metadados.
-- Não há linhas em product_images: ainda não há ficheiros nos buckets.

-- ---------------------------------------------------------------------------
-- Contas: 6 donos estudantes e 1 conta da equipa (administradora).
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object(
    'full_name', u.full_name,
    'phone', u.phone,
    'affiliation', u.affiliation,
    'terms_accepted', true,
    'academic', case when u.affiliation = 'student' then jsonb_build_object(
      'course', 'Curso de exemplo', 'curricular_year', '2.º ano', 'shift', 'Manhã', 'class_group', 'A'
    ) end
  ),
  '', '', '', '',
  now() - interval '60 days', now() - interval '60 days'
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'ana@exemplo.test', 'Ana Exemplo', '900000001', 'student'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'bloco@exemplo.test', 'Bruno Exemplo', '900000002', 'student'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'kiko@exemplo.test', 'Kiko Exemplo', '900000003', 'student'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'teresa@exemplo.test', 'Teresa Exemplo', '900000004', 'student'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'gelados@exemplo.test', 'Gil Exemplo', '900000005', 'student'),
  ('a0000000-0000-4000-8000-000000000006'::uuid, 'rita@exemplo.test', 'Rita Exemplo', '900000006', 'student'),
  ('a0000000-0000-4000-8000-000000000007'::uuid, 'equipa@exemplo.test', 'Equipa PAIÁ', '900000007', 'staff')
) as u (id, email, full_name, phone, affiliation);

insert into public.admin_users (user_id) values ('a0000000-0000-4000-8000-000000000007');

-- ---------------------------------------------------------------------------
-- Lojas: as 5 aprovadas do canvas e 1 à espera de aprovação.
-- ---------------------------------------------------------------------------
insert into public.stores (
  id, owner_id, name, slug, description, category_id, status,
  submitted_at, decided_at, decided_by, rating_avg, rating_count, created_at
)
select
  s.id, s.owner_id, s.name, s.slug, s.description,
  (select c.id from public.categories c where c.slug = s.category_slug),
  s.status::public.store_status,
  now() - interval '50 days',
  case when s.status = 'approved' then now() - interval '45 days' end,
  case when s.status = 'approved' then 'a0000000-0000-4000-8000-000000000007'::uuid end,
  s.rating_avg, s.rating_count,
  now() - interval '55 days'
from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000001'::uuid,
   'Doces da Ana', 'doces-da-ana', 'Bolos por fatia e encomendas para aniversários. Tudo feito no próprio dia.',
   'doces', 'approved', 4.8, 23),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'a0000000-0000-4000-8000-000000000002'::uuid,
   'Salgados do Bloco', 'salgados-do-bloco', 'Salgados fritos e assados para o intervalo.',
   'salgados', 'approved', 4.6, 11),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'a0000000-0000-4000-8000-000000000003'::uuid,
   'Acessórios do Kiko', 'acessorios-do-kiko', 'Capas, pulseiras e pequenos acessórios.',
   'acessorios', 'approved', null, 0),
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'a0000000-0000-4000-8000-000000000004'::uuid,
   'Mimos da Teresa', 'mimos-da-teresa', 'Bolachas e cupcakes caseiros.',
   'doces', 'approved', 4.9, 8),
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'a0000000-0000-4000-8000-000000000005'::uuid,
   'Gelados Fresquinhos', 'gelados-fresquinhos', 'Gelados e picolés de fruta.',
   'gelados', 'approved', 4.5, 6),
  ('b0000000-0000-4000-8000-000000000006'::uuid, 'a0000000-0000-4000-8000-000000000006'::uuid,
   'Lanches da Rita', 'lanches-da-rita', 'Pipocas e snacks para as aulas da tarde.',
   'snacks', 'pending_approval', null, 0)
) as s (id, owner_id, name, slug, description, category_slug, status, rating_avg, rating_count);

-- ---------------------------------------------------------------------------
-- Produtos. created_at é relativo ao momento do seed: os de menos de 7 dias
-- mostram «Novo». Casos especiais: esgotado (stock 0), «Últimas 2»
-- (stock 2), um por publicar, um ocultado pela moderação, um nome com 80
-- caracteres, «Pastéis de carne (3)» e um preço de 1 234 567 Kz. Os
-- produtos da loja pendente não aparecem enquanto ela não for aprovada.
-- ---------------------------------------------------------------------------
insert into public.products (
  store_id, category_id, name, description, price_kz, stock,
  is_published, moderation_status, moderation_reason, created_at
)
select
  p.store_id,
  (select c.id from public.categories c where c.slug = p.category_slug),
  p.name, p.description, p.price_kz, p.stock,
  p.is_published, p.moderation_status::public.moderation_status, p.moderation_reason,
  now() - p.age
from (values
  -- Doces da Ana
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'doces', 'Fatia de bolo de chocolate',
   E'Fatia generosa de bolo de chocolate.\nFeito no próprio dia.', 1500, 8, true, 'visible', null::text, interval '2 days'),
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'doces', 'Bolo de cenoura inteiro',
   'Bolo de cenoura com cobertura de chocolate, para 10 pessoas.', 8000, 2, true, 'visible', null, interval '20 days'),
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'doces', 'Brigadeiros (6)',
   'Caixa com 6 brigadeiros.', 1200, 0, true, 'visible', null, interval '15 days'),
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'yogurt-e-bebidas', 'Sumo natural',
   'Sumo de fruta da época, 500 ml.', 700, 10, true, 'visible', null, interval '30 days'),
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'doces', 'Bolo de casamento (5 andares)',
   'Por encomenda, com um mês de antecedência.', 1234567, 1, true, 'visible', null, interval '40 days'),
  -- Salgados do Bloco
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'salgados', 'Pastéis de carne (3)',
   'Três pastéis de carne, fritos na hora.', 500, 20, true, 'visible', null, interval '1 day'),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'salgados', 'Rissóis de camarão (2)',
   '', 600, 3, true, 'visible', null, interval '10 days'),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'salgados', 'Coxinhas de frango (4)',
   'Ainda em preparação.', 800, 12, false, 'visible', null, interval '5 days'),
  -- Acessórios do Kiko
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'acessorios', 'Capa de telemóvel',
   'Capa de silicone, várias cores.', 2000, 5, true, 'visible', null, interval '3 days'),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'acessorios',
   'Pulseira artesanal de missangas coloridas feita à mão com fecho ajustável e saco',
   'Cada pulseira é única.', 1500, 4, true, 'visible', null, interval '8 days'),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'acessorios', 'Porta-chaves de madeira',
   '', 500, 12, true, 'visible', null, interval '25 days'),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'acessorios', 'Brincos de prata',
   '', 3500, 2, true, 'hidden', 'A fotografia não corresponde ao produto.', interval '6 days'),
  -- Mimos da Teresa
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'doces', 'Bolachas de manteiga (10)',
   'Saco com 10 bolachas.', 1000, 6, true, 'visible', null, interval '4 days'),
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'doces', 'Cupcakes de baunilha (2)',
   '', 900, 1, true, 'visible', null, interval '12 days'),
  -- Gelados Fresquinhos
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'gelados', 'Gelado de múcua',
   'Copo de 250 ml.', 600, 15, true, 'visible', null, interval '6 days'),
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'gelados', 'Picolé de manga',
   '', 300, 30, true, 'visible', null, interval '9 days'),
  -- Lanches da Rita (loja pendente)
  ('b0000000-0000-4000-8000-000000000006'::uuid, 'snacks', 'Pipocas doces',
   '', 300, 10, true, 'visible', null, interval '2 days')
) as p (store_id, category_slug, name, description, price_kz, stock, is_published, moderation_status, moderation_reason, age);

-- ---------------------------------------------------------------------------
-- Destaques da página inicial (C01), escolhidos pela administração: Doces da
-- Ana e Gelados Fresquinhos, ativos e sem período. O de Mimos da Teresa já
-- terminou (ends_at no passado): fica na lista da administração, mas não
-- aparece em C01.
-- ---------------------------------------------------------------------------
insert into public.store_features (store_id, source, position, starts_at, ends_at, is_active, note, created_by, updated_by)
values
  ('b0000000-0000-4000-8000-000000000001', 'admin', 0, null, null, true, null,
   'a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007'),
  ('b0000000-0000-4000-8000-000000000005', 'admin', 1, null, null, true, null,
   'a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007'),
  ('b0000000-0000-4000-8000-000000000004', 'admin', 2, now() - interval '30 days', now() - interval '1 day', true,
   'Campanha de exemplo já terminada.',
   'a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007');
