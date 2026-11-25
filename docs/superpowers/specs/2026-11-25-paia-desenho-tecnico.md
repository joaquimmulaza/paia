# PAIÁ — Desenho técnico do MVP

- **Data:** 2026-11-25
- **Estado:** em revisão pelo responsável do produto
- **Fontes:** `context.md` (regras de produto e registo de decisões), design system v2.2 (https://claude.ai/artifact/UvUMapjmX7aSVuFZ8Zgk9W), ecrãs (https://claude.ai/artifact/A7SP9jQzLiYYApzrY2Y6Sy, IDs C01–C13, K01–K07, V01–V09, A01–A06, S01–S04).

Este documento diz **como** construir o que o `context.md` e os ecrãs já definem. Quando contradiz o `context.md`, o `context.md` ganha e este documento é corrigido. Propostas novas estão marcadas com **(proposta)**.

---

## 1. Objetivo e limites

**Objetivo:** uma PWA mobile-first onde a comunidade da UGS compra a lojas de estudantes aprovadas, com entregas dentro da universidade e pagamento combinado diretamente.

**Fora do âmbito do MVP** (do `context.md`): pagamentos integrados, verificação institucional, chat, GPS, notificações push, estafetas, IA, cupões.

**Restrições que moldam o desenho:**

1. **Só planos gratuitos:** Supabase Free, Vercel Hobby e Gmail SMTP.
2. **Sem CI remoto:** toda a verificação corre localmente com um único comando (secção 16).
3. **Segurança na base de dados.** O cliente é hostil. Todas as regras de acesso vivem em RLS. As escritas sensíveis passam por funções `SECURITY DEFINER`.
4. **Dados reais da UGS não existem ainda.** Os dados académicos são texto livre e as categorias são configuráveis.
5. **Interface em PT-AO.** Valores em `Kz` sem cêntimos; datas mostradas em `Africa/Luanda`.

---

## 2. Stack

| Camada | Escolha | Porquê |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript (strict) | Rápido, estático, serve bem na Vercel e em qualquer alojamento estático |
| Estilos | Tailwind CSS v4, com os tokens do design system como tema (`@theme`) | Uma só fonte de valores. Não há números soltos no código e as variantes vivem junto do componente |
| Componentes | **shadcn/ui** (sobre Radix), copiado para o repositório e restilizado com o visual Cartaz | Comportamento e acessibilidade já testados (foco preso, teclado, ARIA, leitores de ecrã) sem os escrever de raiz. O código fica nosso e pode ser alterado |
| Variantes | class-variance-authority + tailwind-merge + clsx | As dependências do shadcn/ui; cada variante do design system (primário, destaque, secundário, perigo…) é uma `variant` |
| Folha inferior | vaul (o `Drawer` do shadcn/ui) | Gesto de arrastar no telemóvel, com foco preso |
| Avisos curtos | sonner (o `Toast` do shadcn/ui) | «Produto adicionado», «Pedido enviado» |
| Ícones | lucide-react | Ícones de traço de 24 px, com espessura ajustável: é exatamente a iconografia do brand book |
| Imagens | browser-image-compression | Redimensiona e converte para WebP no telemóvel e remove o EXIF (secção 11) |
| Dados no cliente | TanStack Query | Cache, estados de carregamento e invalidação depois de cada ação |
| Formulários | react-hook-form + Zod | Os mesmos schemas validam no cliente e documentam os argumentos das funções |
| Rotas | React Router 6 (data routers) | Guardas por papel e carregamento por rota |
| Backend | Supabase: Postgres 15, Auth, Storage, Realtime, pg_cron | Tudo no plano gratuito, região `sa-east-1` (projeto `paia`) |
| PWA | vite-plugin-pwa (Workbox) | Manifesto, service worker e página offline |
| Testes | pgTAP (RLS e funções), Vitest + Testing Library (unidades e componentes), Playwright + axe (ponta a ponta e acessibilidade) | Correm todos localmente |
| Qualidade | ESLint (com `jsx-a11y`) + Prettier + TypeScript strict | Apanha erros de acessibilidade antes dos testes |

**Não usamos:** Edge Functions (nenhum fluxo precisa delas no MVP), a chave `service_role` no frontend, nem ORM (o acesso é feito com `supabase-js` e RPC).

---

## 3. Estrutura do repositório

```
paia/
├─ context.md
├─ docs/superpowers/specs/          desenho técnico e planos
├─ .env.example                     só nomes de variáveis, sem valores reais
├─ index.html
├─ public/icons/                    ícones PWA (só o elemento gráfico)
├─ src/
│  ├─ app/                          router, providers, guardas de rota, layout
│  ├─ styles/
│  │  ├─ tokens.css                 gerado a partir do tokens.json do design system (não editar à mão)
│  │  └─ app.css                    @import tailwind, @theme a partir dos tokens, base e movimento reduzido
│  ├─ components/
│  │  ├─ ui/                        shadcn/ui restilizado (gerado pela CLI do shadcn, depois ajustado)
│  │  └─ paia/                      componentes do domínio, compostos a partir de ui/
│  ├─ features/
│  │  ├─ auth/  catalog/  cart/  checkout/  orders/
│  │  ├─ seller/  admin/  notifications/  reviews/  reports/
│  │  └─ (cada uma: api.ts, queries.ts, schemas.ts, páginas e componentes)
│  ├─ lib/                          supabase client, format (Kz, datas), errors, ids
│  └─ types/database.ts             gerado por `supabase gen types`
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                   uma migração por fase, nunca editada depois de aplicada
│  ├─ seed.sql                      dados ILUSTRATIVOS, só para desenvolvimento local
│  ├─ scripts/bootstrap_admin.sql   corrido à mão pelo responsável
│  └─ tests/                        pgTAP
└─ e2e/                             Playwright
```

---

## 4. Design system no código

O design system tem duas camadas, e cada uma tem a sua fonte no código:

- A camada **visual** é a dos tokens e do aspeto do Cartaz. Vem do design system.
- A camada **funcional** é a do comportamento, do teclado e do ARIA. Vem do shadcn/ui (Radix), que já está testado.

Não reescrevemos o que o Radix já resolve, e não aceitamos o aspeto padrão do shadcn.

- **Tokens:**
  - O script `npm run tokens:sync` gera `src/styles/tokens.css` a partir do `tokens.json` do design system, com as variáveis `--paper`, `--ink`, `--radius-md`, `--shadow-hard`, …
  - Em `app.css`, o `@theme` do Tailwind v4 aponta para essas variáveis: `--color-ink: var(--ink)`, `--radius-md: var(--radius-md)`, `--shadow-hard: var(--shadow-hard)`, …
  - As variáveis semânticas do shadcn (`--background`, `--foreground`, `--primary`, `--ring`, `--border`, `--destructive`, …) são mapeadas para os tokens do Cartaz no mesmo ficheiro: `--ring` é `--focus-ring` e `--destructive` é `--danger`.
  - Nenhum componente usa hex nem píxeis fora dos tokens.
- **shadcn/ui, com o que muda no aspeto:**
  - `Button`, com as variantes `primary`, `accent`, `secondary`, `danger`, `icon` e `link`: contorno de 2 px, sombra sólida, deslocamento ao premir e estado de carregamento.
  - `Input`, `Textarea` e `Label`: 52 px de altura e texto de 16 px.
  - `Form`, integrado com react-hook-form: mensagens de erro com ícone e `aria-describedby` automático.
  - `RadioGroup`: base de Escolha e de Modalidade de entrega, em cartões com ponto, fundo e negrito.
  - `Checkbox` e `Switch`.
  - `ToggleGroup`: chips de categoria e filtros.
  - `Drawer` (vaul): Folha inferior. `Dialog`: modal em ecrã largo. `AlertDialog`: confirmação de ações destrutivas.
  - `Badge`: Etiqueta de estado. `Card`, `Skeleton` e `Separator`.
  - `Table`: administração. `DropdownMenu`: ações nas tabelas. `Sonner`: avisos curtos.
  - O `Select` do shadcn **não** é usado no telemóvel. Aí fica o `<select>` nativo com o estilo de Campo, que no Android e no iOS é mais fácil de usar e mais leve.
- **Componentes do domínio** (`components/paia/`), compostos a partir de `ui/` e sem regras de aspeto próprias:
  - **Comércio:** `ProductCard`, `StoreCard`, `Qty`, `CartLine`, `CartGroup`;
  - **Pedido:** `DeliveryMode`, `Ticket`, `Notice`, `OrderStatus`, `Steps`, `LocationOffer`;
  - **Estrutura:** `BottomNav`, `AppHeader`, `AdminShell`, `EmptyState`;
  - **Gestão:** `DenseList`, `Stat`, `Upload`.
- **Relação com o design system:**
  - O `components/bundle.css` do design system passa a ser a **referência visual**: os cartões de pré-visualização e a especificação de estados. Não é copiado para a aplicação.
  - Cada componente do código indica no topo o componente do design system a que corresponde.
  - Quando um componente muda, muda primeiro no design system e depois no código.
- **Estados:**
  - **Hover:** só com `@media (hover: hover)`, pela variante `hover:` do Tailwind v4.
  - **Foco:** `focus-visible:` com o anel `--focus-ring`. Sobre fundos escuros ou laranja, os componentes recebem `data-surface="ink"` ou `data-surface="brand"`, que trocam o anel pelas variantes do design system.
  - **Premido, desativado e a carregar:** `active:`, `disabled:` e `aria-busy` ou `data-loading`.
- **Movimento.** `prefers-reduced-motion` é tratado no CSS e nenhum componente anima por JavaScript.
- **Formatação.** `formatKz(1500)` devolve «1 500 Kz», com espaço fino inseparável como separador de milhares; um teste fixa este formato. `formatDate` usa `Intl.DateTimeFormat('pt-AO', { timeZone: 'Africa/Luanda' })`.

---

## 5. Rotas

| Rota | Ecrã | Acesso |
|---|---|---|
| `/` | C01 Início | público |
| `/explorar?q=&categoria=` | C02, K07 | público |
| `/produto/:id` | C03 (C06 se visitante tentar adicionar) | público |
| `/lojas` | C05 | público |
| `/loja/:slug` | C04 | público |
| `/entrar`, `/criar-conta` | K01, K02 | só sem sessão |
| `/carrinho` | C07 | sessão |
| `/checkout/entrega` | C08 | sessão |
| `/pedidos/enviados/:grupo` | C09 | sessão (dono do grupo) |
| `/pedidos` | C10, K06 | sessão |
| `/pedidos/:codigo` | C11, C12, C13 | sessão (comprador do pedido) |
| `/pedidos/:codigo/avaliar` | K05 | sessão (comprador, pedido concluído) |
| `/notificacoes` | K04 | sessão |
| `/perfil` | K03 | sessão |
| `/vender`, `/vender/loja`, `/vender/estado` | V01, V02, V03 | sessão, estudante |
| `/minha-loja` | V04 | dono de loja aprovada |
| `/minha-loja/produtos`, `/minha-loja/produtos/novo`, `/minha-loja/produtos/:id` | V05, V06 | dono de loja aprovada |
| `/minha-loja/pedidos`, `/minha-loja/pedidos/:codigo` | V07, V08, V09 | dono de loja aprovada |
| `/admin/candidaturas`, `/admin/lojas`, `/admin/produtos`, `/admin/denuncias`, `/admin/categorias`, `/admin/suporte` | A01–A06 | administrador |

As guardas de rota servem só a experiência. A segurança real está nas RLS e nas funções (secções 8 e 9). Os ecrãs S01–S04 não são rotas:
- S01 é a página offline do service worker;
- S02 é o tratamento de erros de ação;
- S03 é o convite de instalação;
- S04 são os esqueletos de carregamento.

---

## 6. Modelo de dados

### Convenções

- **Identificadores:**
  - As entidades (perfis, lojas, produtos, pedidos…) usam `uuid` com `gen_random_uuid()`. O UUIDv4 fragmenta índices em tabelas grandes, mas na escala do MVP (dezenas de milhares de linhas) isso não pesa, e o Postgres do Supabase não tem UUIDv7 nativo. É um desvio consciente, a rever se alguma tabela passar de 1 milhão de linhas.
  - As tabelas só de acrescentar (`order_events`, `delivery_proposals`, `notifications`, `store_decisions`, `moderation_actions`, `admin_access_log`) usam `bigint generated always as identity`. São internas e nunca expostas por URL.
- **Datas:** em `timestamptz`; `created_at` e `updated_at`, este mantido por trigger.
- **Valores:** dinheiro em `integer` de Kz, com `check (> 0)`; stock em `integer`, com `check (>= 0)`. Os textos são `text` com `check (char_length(...) <= N)`; não se usa `varchar(n)`.
- **Enumerações:** em `enum` do Postgres, com os nomes do `context.md`. Os nomes das tabelas e colunas são todos em minúsculas, no formato `snake_case`.
- **`NOT NULL` por omissão.** Uma coluna só aceita nulo quando a ausência tem um significado claro, por exemplo `accepted_at` antes de o pedido ser aceite. A coerência entre estado e colunas é garantida por `CHECK` (ver «Invariantes»).
- **Chaves estrangeiras:** todas têm índice no lado filho, criado na mesma migração. O `on delete` é sempre explícito:
  - `cascade` só onde a linha não tem vida própria: `cart_items` com o produto e o utilizador, e `product_images` com o produto;
  - `restrict` em tudo o resto. O histórico nunca é apagado em cascata.
- **Sem «soft delete».** Um produto que já foi pedido não se apaga, deixa de estar publicado. Um produto nunca pedido pode ser apagado de facto.
- **Sem associações polimórficas.** Onde uma linha pode apontar para tipos diferentes (denúncias, moderação), usam-se chaves estrangeiras separadas e anuláveis, com `check (num_nonnulls(product_id, store_id, user_id) = 1)`.

### Tabelas

**Pessoas**

| Tabela | Colunas principais | Notas |
|---|---|---|
| `profiles` | `id` (= `auth.users.id`), `full_name`, `phone`, `affiliation` (`student`, `teacher`, `staff`) | Criado por trigger ao registar. O telefone nunca é legível por outros utilizadores (secção 9) |
| `academic_info` | `user_id` (pk), `course`, `curricular_year`, `shift`, `class_group` (texto livre, até 80/20/20/20 caracteres), `course_option_id`, `shift_option_id`, `class_option_id` (nulos) | Só para estudantes. Os `*_option_id` ficam nulos até existirem listas oficiais |
| `academic_options` | `id`, `kind` (`course`, `shift`, `class_group`, `curricular_year`), `label`, `is_active`, `position` | Vazia no MVP; a futura lista configurável pela administração |
| `admin_users` | `user_id` (pk), `created_at`, `created_by` | A única fonte de «é administrador». Sem escrita pelo cliente |

**Lojas e catálogo**

| Tabela | Colunas principais | Notas |
|---|---|---|
| `categories` | `id`, `name` (único), `slug` (único), `position`, `is_visible` | Semente com as 8 categorias iniciais |
| `stores` | `id`, `owner_id` (único: uma loja por conta), `name`, `slug` (único, `^[a-z0-9-]{3,40}$`), `description`, `category_id`, `logo_path`, `cover_path`, `status` (`draft`, `pending_approval`, `approved`, `rejected`, `suspended`), `submitted_at`, `decided_at`, `decided_by`, `rating_avg` (`numeric(2,1)`), `rating_count`, `published_products_count` | Editar uma loja aprovada não volta a exigir aprovação. Os contadores são recalculados a partir das linhas (`count`, `avg`) dentro das funções que os alteram, nunca incrementados, para serem idempotentes |
| `store_decisions` | `id`, `store_id`, `admin_id`, `decision` (`approved`, `rejected`, `suspended`, `reactivated`), `message`, `checklist` (jsonb), `created_at` | Só acrescenta; é o histórico de decisões |
| `products` | `id`, `store_id`, `category_id`, `name`, `description`, `price_kz`, `stock`, `is_published` (decisão do vendedor), `moderation_status` (`visible`, `hidden`; decisão da administração), `moderation_reason` | Sem tempo de preparação. Sem aprovação individual. São dois eixos independentes, por isso ficam em duas colunas, e o da administração é um estado e não um booleano |
| `product_images` | `id`, `product_id`, `path`, `position` (0–4) | Até 5 por produto; a posição 0 é a principal |

**Carrinho e pedidos**

| Tabela | Colunas principais | Notas |
|---|---|---|
| `cart_items` | `user_id`, `product_id`, `quantity` (> 0), `added_at`; pk (`user_id`, `product_id`) | Carrinho no servidor, para funcionar em vários aparelhos |
| `checkout_groups` | `id`, `buyer_id`, `request_id` (uuid gerado pelo cliente), `created_at`; único (`buyer_id`, `request_id`) | Junta os pedidos criados num checkout. O `request_id` torna o checkout idempotente (secção 8) |
| `orders` | ver abaixo | |
| `order_items` | `order_id`, `product_id`, `product_name`, `unit_price_kz`, `quantity` | O nome e o preço são uma cópia do momento da compra |
| `order_delivery_details` | `order_id` (pk), `mode` (`classroom`, `meeting_point`, `arrange`), `building`, `room`, `meeting_point`, `preferred_time` (texto curto: «O mais cedo possível» ou uma hora), `notes`, `agreement_status` (`buyer_proposed`, `seller_counter`, `agreed`), `agreed_at` | O estado atual do acordo de local |
| `delivery_proposals` | `id`, `order_id`, `by_role` (`buyer`, `seller`), `mode`, `building`, `room`, `meeting_point`, `time_text`, `message`, `created_at` | O histórico das propostas e contrapropostas |
| `order_events` | `id`, `order_id`, `actor_id` (nulo quando é o sistema), `actor_role` (`buyer`, `seller`, `admin`, `system`), `type`, `from_status`, `to_status`, `data` (jsonb), `created_at` | Só acrescenta; guarda autor e data de todas as alterações |

**Confiança e moderação**

| Tabela | Colunas principais | Notas |
|---|---|---|
| `notifications` | `id`, `user_id`, `type`, `title`, `body`, `order_id`, `store_id`, `read_at`, `created_at` | Notificações na aplicação (in-app); o cliente recebe-as por Realtime |
| `reviews` | `id`, `order_id` (único), `store_id`, `buyer_id`, `rating` (1–5), `comment` (até 500), `moderation_status` (`visible`, `hidden`), `created_at` | Uma por pedido, só com o pedido concluído |
| `reports` | `id`, `reporter_id`, `product_id`, `store_id`, `reported_user_id` (só um preenchido, por `CHECK`), `reason`, `description`, `order_id`, `status` (`open`, `resolved`), `resolution`, `resolved_by`, `resolved_at` | Uma denúncia nunca suspende nada automaticamente. Um índice único parcial impede o mesmo utilizador de ter duas denúncias abertas sobre o mesmo alvo |
| `moderation_actions` | `id`, `admin_id`, `product_id`, `store_id`, `review_id` (só um preenchido), `action`, `reason`, `created_at` | Só acrescenta |
| `admin_access_log` | `id`, `admin_id`, `user_id`, `reason`, `created_at` | Só acrescenta. Regista cada vez que um administrador abre dados pessoais de alguém (telefone, dados académicos) em suporte |

**Colunas de `orders`:**
- **Identificação:** `id`, `code` (6 caracteres sem ambiguidade, por exemplo `A3F2K9`, único), `checkout_group_id`, `buyer_id`, `store_id`, `buyer_display_name` (primeiro nome e inicial, copiado na criação; é o único dado do comprador que o vendedor vê antes de aceitar).
- **Estado e valor:** `status` (`pending_seller`, `accepted`, `ready_for_handover`, `delivered`, `completed`, `rejected`, `cancelled`) e `total_kz`.
- **Datas:** `accepted_at`, `ready_at`, `delivered_at`, `completed_at`, `cancelled_at`.
- **Conclusão:** `completed_by` (`buyer`, `auto`).
- **Cancelamento e rejeição:**
  - `cancelled_by` (`buyer`, `seller`);
  - `cancel_reason_code` (`buyer_no_show`, `buyer_gave_up`; obrigatório quando é o vendedor);
  - `cancel_reason_text` e `rejected_reason`.
- **Índices:** (`buyer_id`, `created_at desc`), (`store_id`, `status`, `created_at desc`) e um índice parcial (`delivered_at`) `where status = 'delivered'` para a conclusão automática.

### Invariantes garantidas pela base de dados

- `orders`:
  - `status = 'accepted'` ou posterior implica `accepted_at is not null`;
  - `status = 'delivered'` implica `delivered_at is not null`;
  - `status = 'completed'` implica `completed_at` e `completed_by` preenchidos;
  - `status = 'cancelled'` implica `cancelled_at` e `cancelled_by` preenchidos;
  - `cancelled_by = 'seller'` implica `cancel_reason_code is not null`;
  - `total_kz > 0`.
- `order_delivery_details`, por modalidade:
  - `classroom` exige `building` e `room`;
  - `meeting_point` exige `meeting_point`;
  - `arrange` não exige local;
  - `agreement_status = 'agreed'` implica `agreed_at is not null`.
- `stores`: `status in ('approved', 'rejected', 'suspended')` implica `decided_at` e `decided_by` preenchidos.
- `order_items`: `quantity > 0` e `unit_price_kz > 0`.
- `product_images`: no máximo 5 por produto, por índice único (`product_id`, `position`) e `check (position between 0 and 4)`.

### Leitura pública (visitantes)

As vistas com `security_invoker` respeitam as RLS da tabela base, por isso sozinhas não dariam nada aos visitantes. As vistas sem essa opção ignoram as RLS, e o Supabase avisa contra elas. Por isso a leitura pública faz-se **nas próprias tabelas**, com duas barreiras:

1. **Políticas de leitura para `anon` e `authenticated`:**
   - `stores` com `status = 'approved'`;
   - `products` com `is_published and moderation_status = 'visible'` e loja aprovada;
   - `product_images` dos produtos visíveis;
   - `reviews` com `moderation_status = 'visible'`;
   - `categories` com `is_visible`.
2. **Permissões por coluna:** o `grant select` só inclui as colunas públicas.
   - **Em `stores`, ficam de fora:** `owner_id`, `decided_by` e as datas de decisão.
   - **Em `reviews`, fica de fora:** `buyer_id`.

O dono da loja e o administrador leem as colunas restantes através de funções de leitura dedicadas, `get_my_store()` e as funções de administração. A média e o número de avaliações ficam em `stores` (`rating_avg`, `rating_count`), por isso não é preciso nenhuma vista de agregação.

**Listas longas** (pedidos, notificações, produtos e tabelas da administração) usam paginação por cursor, `where (created_at, id) < ($1, $2) order by created_at desc, id desc limit 20`, e não por `offset`.

---

## 7. Ciclo do pedido

### Estados e transições

| De | Para | Quem | Função | Condições | Efeitos |
|---|---|---|---|---|---|
| (nada) | `pending_seller` | comprador | `create_checkout` | produto publicado, loja aprovada, stock suficiente | desconta o stock, cria o acordo `buyer_proposed`, evento e notificação ao vendedor |
| `pending_seller` | `accepted` | vendedor | `accept_order` | é o dono da loja | o acordo passa a `agreed` (confirma) ou `seller_counter` (contrapropõe); os contactos ficam disponíveis; notifica o comprador |
| `pending_seller` | `rejected` | vendedor | `reject_order` | motivo opcional | repõe o stock e notifica |
| `pending_seller`, `accepted`, `ready_for_handover` | `cancelled` | comprador | `cancel_order_as_buyer` | antes de `delivered` | repõe o stock e notifica o vendedor |
| `accepted`, `ready_for_handover` | `cancelled` | vendedor | `cancel_order_as_seller` | motivo obrigatório (`buyer_no_show`, `buyer_gave_up`) | repõe o stock e notifica o comprador |
| `accepted` | `ready_for_handover` | vendedor | `mark_ready` | acordo `agreed` | notifica |
| `ready_for_handover` | `delivered` | vendedor | `mark_delivered` | — | guarda `delivered_at` e notifica o comprador |
| `delivered` | `completed` | comprador | `confirm_received` | — | `completed_by = buyer`; convida a avaliar |
| `delivered` | `completed` | sistema | `auto_complete_delivered_orders` | `delivered_at < now() - interval '2 days'` | `completed_by = auto` e notifica os dois |

Qualquer outra transição é recusada com o erro `INVALID_TRANSITION`. A função central `transition_order(order_id, to_status, ...)` valida a tabela acima, bloqueia a linha com `select … for update`, escreve o evento e as notificações e devolve a linha atualizada. As funções públicas da tabela são invólucros finos à volta dela.

### Acordo de local (separado do estado)

- `buyer_proposed`: o comprador indicou um local. O vendedor confirma (`agreed`) ou contrapropõe (`seller_counter`), ao aceitar ou depois.
- `seller_counter`: o comprador aceita (`agree_location`, que dá `agreed`) ou propõe outro (`propose_location`, que volta a `buyer_proposed`).
- `agreed`: só a partir daqui é possível `mark_ready`. Mudar o local depois de acordado volta a abrir a negociação. **(proposta)** Isto só é permitido enquanto o pedido está em `accepted`.
- **Modalidade «Combinar com o vendedor»:** o comprador não indica local. O acordo começa em `buyer_proposed` sem campos de local e o vendedor propõe-no ao aceitar.
- Todas as propostas ficam em `delivery_proposals` e cada mudança gera um evento.

**Pedido sem resposta do vendedor (proposta):** não expira automaticamente no MVP. O comprador pode cancelar a qualquer momento antes da entrega. O painel do vendedor (V04) destaca os pedidos com mais de 2 horas.

---

## 8. Funções do servidor (RPC)

Regras comuns a todas as funções:

- **Esquemas:**
  - As funções chamadas pelo cliente vivem em `public`, porque só assim a API as expõe.
  - As auxiliares (`is_admin`, `transition_order`, recálculo de contadores) vivem num esquema `private`, que não é exposto pela API, com `revoke execute … from public, anon, authenticated`.
- **Segurança:**
  - Usam `SECURITY DEFINER` com `set search_path = ''` e nomes totalmente qualificados (`public.orders`, `auth.uid()`).
  - Começam por verificar `(select auth.uid())`, validam os argumentos e o papel, e voltam a confirmar o estado atual da loja. Uma loja suspensa recusa ações de venda, mesmo que o ecrã ainda as mostre.
- **Erros:**
  - Lançam erros com código estável (`raise exception using errcode = 'P0001', message = 'OUT_OF_STOCK'`), sem repetir os valores recebidos.
  - Um pedido, loja ou produto que não pertence a quem chama dá `NOT_FOUND`, e não `NOT_ALLOWED`, para não revelar que existe.
  - O cliente traduz cada código para uma mensagem em PT-AO (secção 13).
- **Idempotência:**
  - Repetir uma ação com os mesmos dados dá o mesmo resultado que a fazer uma vez.
  - `create_checkout` recebe um `request_id` gerado pelo cliente. Se o mesmo comprador repetir esse `request_id`, a função devolve o grupo já criado, sem criar pedidos nem descontar stock outra vez. A verificação e a criação são feitas na mesma transação, protegidas pelo índice único.
  - As transições são guardadas por estado (`update … where id = $1 and status = $esperado`). Pedir a transição para o estado em que o pedido já está devolve o pedido atual, sem novo evento nem nova notificação. Uma transição a partir de outro estado dá `INVALID_TRANSITION`.
  - `propose_location` não cria uma proposta nova se ela for igual à última.
  - Os contadores (`rating_*`, `published_products_count`) são recalculados com `count` e `avg`, nunca incrementados.
- **Efeitos externos:** nenhuma função envia email, faz chamadas HTTP ou contacta serviços externos. As notificações são linhas na mesma transação e o Realtime entrega-as depois do commit. Os únicos emails são os da autenticação, enviados pelo próprio Supabase.
- **Transações curtas:** sem esperas e sem chamadas externas.

| Função | Quem | Faz |
|---|---|---|
| `submit_store(store_id)` | dono | `draft` ou `rejected` passam a `pending_approval`. Exige um perfil `student` e os campos obrigatórios preenchidos |
| `admin_decide_store(store_id, decision, message, checklist)` | admin | aprova ou recusa (a recusa exige mensagem), escreve em `store_decisions` e notifica |
| `admin_set_store_suspension(store_id, suspended, reason, note)` | admin | suspende ou reativa; os pedidos em curso continuam |
| `create_checkout(deliveries jsonb)` | comprador | lê o carrinho do próprio, bloqueia os produtos (`for update`), valida o stock, desconta e cria o grupo, um pedido por loja, os itens, a entrega, a primeira proposta, os eventos e as notificações, e esvazia o carrinho. Tudo numa transação |
| `accept_order(order_id, confirm bool, proposal jsonb)` | vendedor | ver secção 7 |
| `reject_order(order_id, reason)` | vendedor | ver secção 7 |
| `cancel_order_as_buyer(order_id, reason)` | comprador | ver secção 7 |
| `cancel_order_as_seller(order_id, reason_code, reason_text)` | vendedor | ver secção 7 |
| `propose_location(order_id, proposal jsonb)` | comprador ou vendedor | nova proposta |
| `agree_location(order_id)` | comprador | o acordo passa a `agreed` |
| `mark_ready(order_id)`, `mark_delivered(order_id)`, `confirm_received(order_id)` | vendedor, vendedor, comprador | ver secção 7 |
| `get_order_contacts(order_id)` | comprador ou vendedor do pedido | devolve o nome e o telefone da outra parte só nos estados `accepted`, `ready_for_handover` e `delivered` |
| `create_review(order_id, rating, comment)` | comprador | só com o pedido `completed`, uma vez por pedido |
| `admin_moderate_product(product_id, status, reason)`, `admin_moderate_review(review_id, status, reason)` | admin | muda o `moderation_status`, escreve em `moderation_actions`, recalcula os contadores e notifica o dono |
| `admin_get_user_support(user_id, reason)` | admin | devolve o perfil, o telefone e os dados académicos de um utilizador para resolver um caso de suporte. O motivo é obrigatório e cada acesso fica em `admin_access_log` |
| `get_my_store()` | dono | devolve a própria loja com todas as colunas, incluindo as que não são públicas |
| `admin_resolve_report(report_id, resolution, note)` | admin | fecha a denúncia; pode chamar `admin_moderate` ou `admin_set_store_suspension` |
| `mark_notifications_read(ids uuid[])` | dono | preenche `read_at` |
| `auto_complete_delivered_orders()` | pg_cron | sem `auth.uid()`; só pode ser executada pelo papel `postgres` |
| `is_admin()` | interno | `stable`, lê `admin_users` |

**Stock.** Antes de descontar, `create_checkout` bloqueia os produtos **por ordem de `id`** (`select … where id = any($1) order by id for update`), para que dois checkouts simultâneos nunca se bloqueiem mutuamente. O desconto é feito com `update products set stock = stock - q where id = $1 and stock >= q`. Se não afetar nenhuma linha, a função falha com `OUT_OF_STOCK` e o código do produto, e a transação inteira é revertida; o cliente mostra o ecrã S02. A reposição acontece dentro da mesma transição de `rejected` ou `cancelled`.

---

## 9. Regras de acesso (RLS)

RLS ligada em **todas** as tabelas, sem exceções. Legenda:
- **L** leitura; **E** escrita direta (inserir, alterar ou apagar, com `with check`);
- **RPC** só através das funções da secção 8;
- **—** sem acesso.

| Tabela | Visitante | Comprador (próprio) | Vendedor (própria loja) | Admin |
|---|---|---|---|---|
| `profiles` | — | L/E (nome, telefone; o vínculo não muda depois do registo) | — (o nome do comprador chega pelos pedidos; o telefone só por `get_order_contacts`) | só por `admin_get_user_support`, com registo |
| `academic_info` | — | L/E | — | só por `admin_get_user_support`, com registo |
| `academic_options` | L (ativas) | L | L | L/E |
| `admin_users` | — | — | — | L |
| `categories` | L (visíveis) | L | L | L/E |
| `stores` | L (aprovadas, só colunas públicas) | E (criar `draft`; editar o próprio: nome, descrição, categoria e imagens, nunca `status`) | L/E (o mesmo) | L, estado por RPC |
| `store_decisions` | — | L (da própria loja) | L | L, escrita por RPC |
| `products` | L (publicados e visíveis, de lojas aprovadas) | — | L/E na própria loja se `approved` (sem as colunas `moderation_*`) | L, moderação por RPC |
| `product_images` | L (de produtos visíveis) | — | L/E na própria loja | L |
| `cart_items` | — | L/E | — | — |
| `checkout_groups`, `orders`, `order_items`, `order_delivery_details`, `delivery_proposals`, `order_events` | — | L (os próprios pedidos); escrita só por RPC | L (pedidos da loja); escrita só por RPC | L |
| `notifications` | — | L (as próprias); `read_at` por RPC | igual | L (as próprias) |
| `reviews` | L (visíveis, sem `buyer_id`) | L (as próprias); escrita por RPC | L (da loja) | L, moderação por RPC |
| `reports` | — | E (inserir com `reporter_id = auth.uid()`), L (as próprias) | igual | L, resolução por RPC |
| `moderation_actions` | — | — | — | L, escrita por RPC |

**Permissões de base.** O Supabase dá, por omissão, todas as permissões sobre as tabelas de `public` aos papéis `anon` e `authenticated`. A primeira migração faz `revoke all on all tables in schema public from anon, authenticated` e `alter default privileges … revoke`. Cada tabela recebe depois só os `grant` de que precisa, por coluna quando é caso disso. Uma tabela nova fica fechada até alguém a abrir explicitamente.

**Forma das políticas.**
- Usam `(select auth.uid())` e `(select private.is_admin())`. O `select` faz com que a função corra uma vez por consulta, e não uma vez por linha.
- Cada coluna usada numa política tem índice: `owner_id`, `store_id`, `buyer_id`, `user_id`.
- As políticas são por operação (`for select`, `for insert` …) e por papel (`to anon`, `to authenticated`), nunca `for all` sem papel.
- Não se usa `force row level security`. As funções `SECURITY DEFINER` pertencem ao dono das tabelas e precisam de passar as RLS. Isso é seguro porque cada uma verifica `auth.uid()` e o papel por dentro.

**Regras das colunas.** As colunas que o cliente não pode mudar ficam fora do `GRANT UPDATE`:
- em `stores`, o `status` e as colunas de decisão;
- em `products`, as colunas `moderation_*`;
- em `profiles`, o `affiliation`.

Um trigger `prevent_privileged_columns` recusa qualquer tentativa que escape, como segunda barreira.

**Proteção do telefone e dos dados académicos:**
- não existe nenhuma política que dê a outro utilizador leitura direta de `profiles` ou de `academic_info`;
- as vistas públicas não juntam estas tabelas;
- o nome mostrado ao vendedor vem de uma coluna `buyer_display_name` (primeiro nome e inicial), copiada para `orders` na criação do pedido.

---

## 10. Autenticação, perfis e administradores

- **Registo:**
  - email e palavra-passe pelo Supabase Auth, com o mínimo de 8 caracteres configurado no painel;
  - o formulário K02 envia `full_name`, `phone`, `affiliation` e os dados académicos em `options.data`;
  - o trigger `handle_new_user` cria `profiles` e, para estudantes, `academic_info`, validando comprimentos e o enum;
  - os metadados do utilizador só servem para estes campos de perfil, **nunca** para papéis.
- **Confirmação de email:**
  - **em desenvolvimento**, está desligada;
  - **no piloto**, liga-se, com SMTP do Gmail na conta do responsável;
  - o responsável cria a palavra-passe de aplicação, com verificação em 2 passos, e introdu-la em Supabase → Authentication → SMTP;
  - nada disto fica no repositório. O limite do Gmail (cerca de 500 envios por dia) chega para o piloto.
- **Recuperar palavra-passe:** usa o fluxo do Supabase, com o mesmo SMTP.
- **Sessão:**
  - O `supabase-js` guarda a sessão no `localStorage` do browser. Numa aplicação estática, sem servidor próprio, não há alternativa simples em cookie `httpOnly`. O risco é o de XSS, e as mitigações são estas:
    - CSP estrita (secção 15);
    - nenhum script de terceiros;
    - React sem `dangerouslySetInnerHTML`;
    - JWT com validade de 1 hora;
    - rotação dos tokens de atualização, com deteção de reutilização (ligada no painel).
  - «Terminar sessão» revoga o token neste aparelho. Em Perfil há também «Terminar sessão em todos os aparelhos» (`signOut({ scope: 'global' })`).
  - O papel de administrador nunca vem do JWT: `private.is_admin()` lê `admin_users` em cada pedido, por isso retirar um administrador tem efeito imediato.
- **Proteção contra robôs (antes do piloto):** ativar o CAPTCHA do Supabase Auth com Cloudflare Turnstile, que é gratuito, no registo, na entrada e na recuperação de palavra-passe. Os limites do Supabase são por IP; o CAPTCHA protege também contra ataques espalhados por muitos IPs. A resposta da recuperação de palavra-passe é sempre a mesma, exista ou não a conta.
- **Primeiro administrador:**
  - o responsável corre `supabase/scripts/bootstrap_admin.sql` no editor SQL do painel, com o seu email;
  - o script faz `insert into admin_users select id from auth.users where email = :email`;
  - nenhum formulário dá permissões de administração;
  - os administradores seguintes são acrescentados da mesma forma.

---

## 11. Armazenamento de imagens

- **Buckets:**
  - **`store-media`**, com leitura pública, para imagens de lojas, no caminho `stores/{store_id}/{logo|cover}-{uuid}.webp`;
  - **`product-media`**, com leitura pública, para fotos de produtos, no caminho `products/{store_id}/{product_id}/{uuid}.webp`.
  - São públicos porque o catálogo é público e nunca contêm dados pessoais. A moderação oculta o produto, não o ficheiro.
- **Escrita:** as políticas de `storage.objects` só deixam escrever no caminho cujo `store_id` pertence a `auth.uid()`. O admin pode apagar.
- **Limites:**
  - aceita JPG, PNG e WebP até 2 MB, validados no bucket;
  - antes de enviar, o cliente redimensiona para no máximo 1600 px no lado maior e converte para WebP com qualidade 0,8, o que dá cerca de 150–300 KB;
  - com 1 GB, isto chega para cerca de 4 000 fotos.
- **Limpeza:** apagar uma imagem na interface apaga o ficheiro e a linha. Os ficheiros órfãos são revistos à mão no piloto.
- **Privacidade e conteúdo:**
  - A conversão para WebP no cliente remove os metadados EXIF, incluindo a localização GPS das fotos tiradas com o telemóvel.
  - SVG não é aceite, porque pode conter scripts.
  - O bucket valida o tipo MIME e o tamanho, independentemente do que o cliente envie.

---

## 12. Notificações

- As notificações são criadas **dentro** das funções da secção 8, na mesma transação, para nunca haver um estado sem aviso.
- O cliente subscreve `notifications` por Realtime, com filtro `user_id = eq.{uid}` (as RLS aplicam-se). O contador na navegação e no sino vem de uma contagem de não lidas.
- Tipos: `order_new`, `order_accepted`, `location_proposed`, `location_agreed`, `order_ready`, `order_delivered`, `order_completed`, `order_cancelled`, `order_rejected`, `store_approved`, `store_rejected`, `store_suspended`, `product_hidden`, `review_request`.
- Não há notificações push no MVP (decisão do `context.md`).

---

## 13. Erros, carregamento e offline

- **Erros:**
  - Cada código de erro do servidor (`OUT_OF_STOCK`, `INVALID_TRANSITION`, `STORE_NOT_APPROVED`, `NOT_ALLOWED`, `LOCATION_NOT_AGREED`, `REVIEW_EXISTS`, …) tem uma mensagem em PT-AO num único ficheiro, `src/lib/errors.ts`.
  - Os erros de formulário aparecem junto ao campo, com cor, ícone e texto.
  - Os erros de ação usam o padrão S02.
  - Nunca se mostra a mensagem técnica.
- **Carregamento:** esqueletos estáticos (S04). Ao fim de 10 s aparece «Está a demorar. Tentar outra vez».
- **Offline:** ver a secção 14. Uma ação feita sem ligação falha logo com a mensagem de S01; não há fila de ações.

---

## 14. PWA

- **Manifesto:**
  - `name` e `short_name` «PAIÁ», `lang` `pt-AO`, `display` `standalone`;
  - `background_color` `#F7F4EE` e `theme_color` `#022147`.
- **Ícones:**
  - usam só o elemento gráfico do logótipo, sem a palavra (decisão de 2026-11-25), sobre fundo `paper`;
  - 192 e 512 px, uma versão `maskable` com 20 % de margem e um `apple-touch-icon` de 180 px;
  - são gerados a partir do PNG aprovado sem alterar a arte, e o responsável aprova-os antes do piloto.
- **Service worker:**
  - `precache` da aplicação (HTML, JS, CSS, fontes);
  - `CacheFirst` só para as imagens públicas do Storage, com 200 entradas e 7 dias;
  - **nenhuma** resposta da API é guardada em cache, porque pode conter dados pessoais;
  - a navegação sem ligação recebe a página S01.
- **Instalação:**
  - o convite S03 aparece depois da segunda visita, usando `beforeinstallprompt` no Android;
  - no iOS aparecem as instruções do Safari;
  - pode ser dispensado e não volta a aparecer durante 30 dias.

---

## 15. Segurança

- **Chaves e segredos:**
  - o frontend só tem `VITE_SUPABASE_URL` e a chave pública (anon ou publishable);
  - a `service_role` nunca sai do painel nem dos scripts locais, e nunca entra no repositório;
  - o ficheiro `.env.example` tem apenas os nomes das variáveis.
- **Funções do servidor:**
  - todas as `SECURITY DEFINER` têm `search_path` fixo e fazem `revoke execute … from public`;
  - depois disso dá-se `grant` explícito a `authenticated`.
- **Validação:**
  - feita em duas camadas: Zod no cliente, e `check` mais validação dentro das funções;
  - os tamanhos máximos dos textos estão na base de dados.
- **Abuso:**
  - **(proposta)** no máximo 10 checkouts por hora por utilizador e 20 denúncias por dia, contados em `order_events` e `reports` dentro das funções;
  - o Supabase Auth já limita registos e tentativas de entrada.
- **Dados pessoais:**
  - o telefone e os dados académicos ficam protegidos como descrito na secção 9;
  - os logs e os eventos não guardam telefones;
  - a análise da Lei 22/11 está adiada para antes do lançamento público, como regista o `context.md`.
- **Cabeçalhos HTTP** (`vercel.json`):
  - `Content-Security-Policy`:
    - `default-src 'self'`; `script-src 'self'`, sem inline;
    - `style-src 'self' https://fonts.googleapis.com`; `font-src https://fonts.gstatic.com`;
    - `img-src 'self' data: https://<projeto>.supabase.co`;
    - `connect-src 'self' https://<projeto>.supabase.co wss://<projeto>.supabase.co`;
    - `frame-ancestors 'none'`.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff` e `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy` sem câmara, microfone nem geolocalização. A câmara é aberta pelo seletor de ficheiros nativo, que não precisa desta permissão.
- **Texto dos utilizadores:** nomes, descrições, comentários e mensagens são sempre mostrados como texto pelo React. Nunca se interpretam como HTML.
- **Migrações remotas:**
  - nunca são aplicadas sem autorização explícita do responsável, para cada `supabase db push`;
  - o `seed.sql` com dados ilustrativos nunca é aplicado ao projeto remoto.

---

## 16. Testes e verificação local

`npm run verify` corre por esta ordem e falha ao primeiro erro:

1. `eslint` e `tsc --noEmit`.
2. `vitest run`: formatadores, schemas Zod, tradução de erros e testes de componentes com Testing Library, que verificam o papel, o nome acessível e o teclado de `Button`, `DeliveryMode`, `Qty` e `Drawer`.
3. `supabase db reset`, que aplica as migrações e o seed local, seguido de `supabase test db`, que corre os testes pgTAP (precisa do Docker):
   - **RLS:** para cada tabela e papel da matriz da secção 9, um teste que confirma o acesso permitido e um que confirma o bloqueio;
   - **funções:** todas as transições válidas da secção 7 e uma amostra das inválidas; stock com concorrência simulada (dois checkouts para a última unidade); reposição de stock; conclusão automática.
4. `vite build`.
5. `playwright test` contra a base local, com uma verificação `axe` (WCAG 2.2 AA) em cada ecrã visitado e três percursos:
   - comprador: explorar, carrinho com 2 lojas, checkout e cancelar um dos pedidos;
   - vendedor: candidatar a loja, o admin aprova, publicar um produto, aceitar com contraproposta, pronto, entregue;
   - comprador: confirmar a receção e avaliar.

Cada fase da secção 19 só fecha com `npm run verify` sem falhas, corrido localmente.

---

## 17. Limites dos planos gratuitos

| Recurso | Limite | Mitigação |
|---|---|---|
| Supabase: base de dados | 500 MB | Texto e números ocupam pouco. Os eventos e as notificações com mais de 6 meses podem ser arquivados **(proposta)** |
| Supabase: Storage | 1 GB | Compressão no cliente (secção 11) e até 5 fotos por produto |
| Supabase: pausa | o projeto pausa ao fim de 7 dias sem atividade | Durante o piloto há uso diário. Com o projeto pausado, a conclusão automática atrasa e é feita quando o projeto volta |
| Supabase: projetos ativos | 2 por organização (já atingido) | Sem projeto de staging: desenvolvimento local com Docker e um único projeto remoto |
| Supabase: Realtime | 200 ligações em simultâneo | Chega para o piloto. Fora da aplicação não há subscrições |
| Gmail SMTP | cerca de 500 emails por dia | Só confirmação de conta e recuperação de palavra-passe. Os pedidos não enviam email |
| Vercel Hobby | os termos limitam o plano a uso **não comercial** | **Risco:** um marketplace pode ser considerado uso comercial. Mantemos a Vercel no desenvolvimento e no piloto fechado. Antes do lançamento público, avaliar a migração para o Cloudflare Pages (gratuito e permite uso comercial); a aplicação é estática, por isso a mudança é simples |

---

## 18. Ambientes e variáveis

- **Local:** `supabase start` (Docker) e `npm run dev`. Usa o seed ilustrativo e email de teste no Inbucket local.
- **Remoto:** projeto `paia` (`pkubomgkptdwlewgocqm`, `sa-east-1`) e projeto Vercel `paia`, ligado ao repositório quando existir.
- **`.env.example`:** `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`. Os valores reais ficam em `.env.local`, que está no `.gitignore`, e nas variáveis do projeto na Vercel.

---

## 19. Plano por fases

Cada fase entrega uma fatia que funciona de ponta a ponta e acaba com `npm run verify` sem falhas e uma demonstração local.

| Fase | Entrega | Ecrãs |
|---|---|---|
| **F0 · Fundação** | `git init`, Vite + TS, tokens e componentes base, Supabase local, migração base (`profiles`, `academic_*`, `admin_users`, `is_admin`), registo, entrada, perfil, script de verificação | K01, K02, K03 |
| **F1 · Catálogo** | `categories`, `stores`, `products`, imagens, vistas públicas, seed ilustrativo | C01–C05, K07, S04 |
| **F2 · Vender** | candidatura, decisão do admin, painel, produtos, envio de imagens | V01–V06, A01, C06 |
| **F3 · Pedidos** | carrinho, `create_checkout`, ciclo completo, acordo de local, contactos, notificações, conclusão automática | C07–C13, V07–V09, K04, K06, S02 |
| **F4 · Confiança** | avaliações, denúncias, moderação, lojas, categorias, suporte | K05, A02–A06 |
| **F5 · PWA e piloto** | manifesto e ícones, offline, convite de instalação, SMTP, testes de ponta a ponta completos, primeiro deploy | S01, S03 |

Antes de cada fase há um plano de implementação detalhado (`docs/superpowers/plans/`), escrito a partir desta secção.

---

## 20. Questões ainda em aberto

Nenhuma bloqueia a fase F0:

1. **Expiração de pedidos sem resposta:** a proposta é não expirarem no MVP (secção 7).
2. **Mudar o local depois de acordado:** a proposta é só em `accepted` (secção 7).
3. **Limites anti-abuso:** a proposta é 10 checkouts por hora e 20 denúncias por dia (secção 15).
4. **Arquivo de eventos antigos:** a proposta é a partir dos 6 meses (secção 17).
5. **Alojamento para o lançamento público:** a proposta é avaliar o Cloudflare Pages por causa dos termos da Vercel Hobby (secção 17).
6. **Textos legais:** os Termos de utilização e a Política de privacidade são precisos antes do piloto aberto.
7. **Eliminar conta (proposta):** no MVP é feito a pedido, pelo suporte. A função apaga o perfil, os dados académicos, o carrinho e as notificações. Nos pedidos e avaliações já feitos, o nome passa a «Utilizador removido»; os pedidos não se apagam, porque são o histórico da outra parte. O desenho final depende da análise da Lei 22/11.

---

## 21. Revisão com skills (2026-11-25)

O documento foi revisto com quatro skills: `supabase-postgres-best-practices`, `backend-design:data-modeling-discipline`, `backend-design:auth-and-authorization` com `backend-design:security-discipline`, e `backend-design:idempotency-and-side-effects`. As alterações:

| # | Encontrado | Corrigido em |
|---|---|---|
| 1 | Vistas com `security_invoker` não dariam leitura aos visitantes, e vistas sem essa opção ignoram as RLS | Secção 6: leitura pública nas tabelas, com políticas para `anon` e permissões por coluna; contadores em `stores` |
| 2 | O Supabase dá todas as permissões a `anon` e `authenticated` por omissão | Secção 9: `revoke` geral na primeira migração e `grant` explícito por tabela e por coluna |
| 3 | `auth.uid()` nas políticas corria por linha | Secção 9: `(select auth.uid())` e índice em cada coluna das políticas |
| 4 | `search_path = public, pg_temp` e auxiliares expostas pela API | Secção 8: `search_path = ''`, nomes qualificados e auxiliares no esquema `private` |
| 5 | O checkout podia bloquear-se com outro em simultâneo | Secção 8: produtos bloqueados por ordem de `id` |
| 6 | Um toque duplo no checkout podia criar pedidos em duplicado | Secções 6 e 8: `request_id` com índice único |
| 7 | Repetir uma transição dava erro ou notificação duplicada | Secção 8: transições guardadas por estado; repetir não faz nada |
| 8 | Os contadores por incremento não eram idempotentes | Secções 6 e 8: recalculados com `count` e `avg` |
| 9 | Associações polimórficas em `reports` e `moderation_actions` | Secção 6: chaves estrangeiras separadas e `num_nonnulls = 1` |
| 10 | Booleanos de moderação que iam crescer | Secção 6: `moderation_status` em produtos e avaliações |
| 11 | Coerência entre o estado e as colunas só no código | Secção 6: invariantes em `CHECK` |
| 12 | O administrador lia dados pessoais sem registo | Secções 6 e 8: `admin_get_user_support` com motivo e `admin_access_log` |
| 13 | Recursos alheios devolviam um erro que revelava a sua existência | Secção 8: `NOT_FOUND` uniforme |
| 14 | Sessão no `localStorage` sem mitigação descrita | Secção 10: CSP, sem scripts de terceiros, JWT de 1 h, rotação e saída global |
| 15 | Ataques a contas distribuídos por muitos IPs | Secção 10: Cloudflare Turnstile no Supabase Auth antes do piloto |
| 16 | Fotos com localização GPS e SVG com scripts | Secção 11: remoção do EXIF e SVG recusado |
| 17 | Faltavam os cabeçalhos de segurança | Secção 15: CSP, HSTS, nosniff, Referrer-Policy e Permissions-Policy |
| 18 | Listas paginadas por `offset` | Secção 6: paginação por cursor |

Desvio consciente: as entidades mantêm UUIDv4, e não UUIDv7, pelas razões da secção 6.

### Revisão do frontend (2026-11-25)

Esta revisão foi pedida pelo responsável, com a preocupação de não escrever de raiz o que já existe. Fiz-a com três skills: `backend-design:boring-by-default`, `design-skills:design-systems` e `design-superpowers:ds-consumer`.

| # | Encontrado | Decisão |
|---|---|---|
| 19 | O desenho técnico portava o CSS do design system e implementava à mão o comportamento de folhas, rádios, interruptores e modais. É o que `boring-by-default` desaconselha: reinventar o que existe maduro | Adotar **shadcn/ui** (Radix) para a camada funcional, restilizado com o Cartaz (secção 4) |
| 20 | Havia duas fontes de estilo (classes `p-*` e Tailwind), que iam divergir | Tailwind v4 com `@theme` a partir dos tokens é a única fonte no código. O `bundle.css` fica como referência visual |
| 21 | Os ícones eram SVG desenhados à mão | lucide-react, que segue a mesma regra de traço do brand book |
| 22 | A compressão de imagens ia ser escrita de raiz | browser-image-compression |
| 23 | Faltavam verificações automáticas de acessibilidade | `eslint-plugin-jsx-a11y`, Testing Library e axe no Playwright (secção 16) |

O que continua a ser nosso: os componentes do domínio (cartão de produto, estado do pedido, proposta de local, carrinho por loja), porque nenhuma biblioteca os traz. Ficam finos, compostos a partir dos componentes do shadcn/ui.
