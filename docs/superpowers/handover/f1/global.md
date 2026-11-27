# F1 · Catálogo — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Os títulos das tarefas usam «Task N» porque os scripts do SDD só reconhecem essa forma.

**Objetivo:**
- **Catálogo:** qualquer pessoa, com ou sem conta, vê as categorias, as lojas aprovadas e os seus produtos publicados, pesquisa e filtra, e abre a página de um produto e de uma loja.
- **Destaques:** um administrador escolhe as lojas em destaque na página inicial, liga e desliga cada destaque, define a ordem e, se quiser, um período.
- **Ambiente:** tudo corre contra o Supabase local, com dados ilustrativos.

**Arquitetura:**
- A leitura pública faz-se nas próprias tabelas, com políticas para `anon` e `authenticated` e `grant select` por coluna (spec §6, «Leitura pública»).
- A pesquisa e as páginas de detalhe usam funções `security invoker`, que respeitam as RLS e devolvem só colunas públicas.
- O frontend lê com TanStack Query, a partir de uma única camada `features/catalog/api.ts`.
- **Ações de fases seguintes.** As ações desenhadas que dependem de fases seguintes ficam **visíveis e desenhadas como no canvas**, e ao tocar mostram o aviso «Disponível em breve». Funcionam na sua fase. São elas:
  - o carrinho e «Adicionar» (F3);
  - o sino de notificações (F3);
  - «Denunciar produto» e «Denunciar loja» (F4).
  - É uma decisão do responsável, de 2026-11-26.
- **Avaliações.** A secção continua a regra do produto: só aparece quando há avaliações.
- **Destaques:**
  - vivem numa tabela própria, `store_features`, com `source` (`admin` ou `paid`), ordem e período opcional;
  - nesta fase só existe o caminho `admin`, pelo painel de administração;
  - um destaque pago vai ter um selo próprio («Promovida»), distinto do selo «Loja aprovada»;
  - pagamentos, assinaturas e planos ficam de fora.
- **Ecrãs por desenhar.** O que ainda não está desenhado é desenhado primeiro no Claude Design, no canvas dos ecrãs, com o design system v2.2, e só depois implementado. Isto vale para a estrutura da administração, o ecrã «Destaques» e a secção de destaques de C01.

**Tecnologias:** as de F0. Acrescenta a extensão `unaccent` do Postgres. Não entra nenhuma dependência npm nova.

**Especificação:** `docs/superpowers/specs/2026-11-25-paia-desenho-tecnico.md`, secções 4, 5, 6, 9, 11, 13 e 16. Regras de produto: `context.md`, §5 e §6. Ecrãs de referência: C01–C05, K07 e S04 no canvas https://claude.ai/artifact/A7SP9jQzLiYYApzrY2Y6Sy.

## Restrições globais

- **De F0, sem alterações:**
  - só recursos gratuitos;
  - verificação local com `npm run verify`;
  - nada no Supabase remoto nem na Vercel;
  - nenhum segredo em ficheiros;
  - PT-AO com «tu»;
  - dinheiro em inteiros de Kz, mostrado com `formatKz`;
  - datas em `Africa/Luanda`;
  - nunca texto branco sobre `brand`;
  - contraste de pelo menos 4,5:1;
  - alvos de toque de pelo menos 44 px;
  - anel de foco de 3 px a 2 px;
  - os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Base de dados:**
  - RLS em todas as tabelas;
  - `security definer` só onde for preciso, sempre com `set search_path = ''` e nomes qualificados;
  - depois do `revoke execute … from public, anon, authenticated` global de F0, cada função nova recebe um `grant execute` explícito;
  - `on delete restrict`, exceto `product_images` com o produto (`cascade`);
  - todas as chaves estrangeiras têm índice.
- **Leitura pública:**
  - nunca `select('*')`: as colunas estão concedidas uma a uma;
  - `stores.owner_id`, `decided_by`, `decided_at` e `submitted_at` nunca são legíveis por `anon` nem por `authenticated`;
  - nenhum ecrã mostra dados pessoais do dono da loja.
- **Copy e estados (do canvas e do `context.md`):**
  - **Etiquetas de stock:** «Esgotado» com `stock = 0`, e «Últimas N» com `1 ≤ stock ≤ 3`.
  - **Etiqueta «Novo»:** produto criado há menos de 7 dias.
  - **Avaliações:** só aparecem quando `rating_count > 0`.
  - **Esgotado:** preço em `ink-muted`, **sem risco**. O produto está indisponível e o botão de adicionar fica desativado, porque não permite novos pedidos.
  - **Ações de fases seguintes:** carrinho, «Adicionar», notificações e denúncias mostram o aviso «Disponível em breve» (`toast` do sonner).
- **Limites (aprovados pelo responsável em 2026-11-26):**
  - nome da loja até 60 caracteres;
  - descrição da loja até 280 caracteres;
  - nome do produto até 80 caracteres;
  - descrição do produto até 1000 caracteres;
  - preço de 1 a 10 000 000 Kz;
  - stock de 0 a 9 999;
  - no máximo 5 fotografias por produto.
- **Destaques:**
  - **Visibilidade:** um destaque está ativo quando `is_active` e `now()` está dentro de `[starts_at, ends_at)`, sendo que um limite nulo não limita.
  - **Lojas:** só lojas `approved` aparecem em destaque.
  - **Ordem:** a ordem é `position asc` e, em empate, `created_at asc`.
  - **Gestão:** só um administrador (`private.is_admin()`) gere destaques.
- **Imagens:**
  - **Leitura e caminhos:** buckets públicos de leitura, `store-media` e `product-media`, com os caminhos da spec §11.
  - **Escrita:** fica para F2.
  - **Ecrãs:** um produto sem imagem mostra o fundo `brand-tint` com o ícone de imagem `aria-hidden`, sem texto.
  - **Texto alternativo:** uma imagem real usa como `alt` o nome do produto (ou da loja).
- **Dados de exemplo:** o `seed.sql` só tem dados ilustrativos, com emails `@exemplo.test`. Não se inventam dados da UGS: as categorias são as 8 iniciais do `context.md`, que a administração vai poder alterar.

## Pontos a vigiar na revisão

1. **Pesquisa com acentos, maiúsculas e caracteres especiais:**
   - `pasteis` e `PASTÉIS` encontram «Pastéis de carne»;
   - `%`, `_`, `,`, `(` e `\` são tratados como texto, sem curingas nem erro;
   - uma pesquisa com mais de 80 caracteres é cortada a 80 e não falha.
   Teste pgTAP na tarefa 2 e teste do schema da URL na tarefa 4.
2. **Produto escondido aberto por URL direta.** `/produto/<id>` de um produto não publicado, ocultado pela moderação ou de uma loja não aprovada mostra «Não encontrámos o que procuras.», nunca o produto. Testes pgTAP nas tarefas 1 e 2, e teste do ecrã na tarefa 9.
3. **Visitante que lê colunas privadas pela API.** `select owner_id from stores` como `anon` falha com `42501`. O mesmo para `products.is_published` e `moderation_reason`. Teste pgTAP na tarefa 1.
4. **Stock e preços nos limites.** Os limites que se testam são:
   - `stock` 0, 1, 3 e 4;
   - um preço de `1 234 567` Kz formata sem partir o cartão.
   - E um nome de produto com 80 caracteres quebra linha dentro do cartão.
   Testes nas tarefas 4 e 6.
5. **Rede lenta ou sem ligação:**
   - o esqueleto aparece logo;
   - ao fim de 10 s aparece «Está a demorar.» com «Tentar outra vez»;
   - um erro de rede mostra a mensagem traduzida e o mesmo botão.
   Teste na tarefa 6, com temporizadores falsos.
6. **Destaque fora do período ou de loja suspensa:**
   - um destaque com `ends_at` no passado, `starts_at` no futuro ou `is_active = false` não aparece em C01;
   - um destaque de uma loja que passou a `suspended` também não aparece;
   - um não administrador que chame as funções de gestão recebe `NOT_ALLOWED`.
   Testes pgTAP na tarefa 3.

---

## Estrutura de ficheiros

```
supabase/migrations/20261126000000_f1_catalogo.sql
supabase/tests/f1_catalog_test.sql
supabase/seed.sql                          (dados ilustrativos)
src/features/catalog/
  types.ts        Category, CatalogProduct, ProductDetail, StoreSummary, ProductSort, ProductCursor
  api.ts          listCategories, searchProducts, getProduct, listStores, getStore
  queries.ts      catalogKeys e hooks useCategories, useProducts, useProduct, useStores, useStore
  labels.ts       stockLabel(), isNew(), publicImageUrl()
  search-params.ts parseExploreParams(), toExploreSearch()
  components/     ProductCard, StoreCard, StoreLink, CategoryChips, SearchField,
                  ProductPhoto, EmptyState, CatalogSkeleton
  HomePage.tsx (C01)  ExplorePage.tsx (C02, K07)  ProductPage.tsx (C03)
  StoresPage.tsx (C05)  StorePage.tsx (C04)
src/features/admin/
  api.ts          listFeatures, saveFeature, setFeatureActive, removeFeature, reorderFeatures
  AdminShell.tsx  RequireAdmin.tsx  FeaturesPage.tsx (A07 · Destaques)
src/components/paia/ComingSoon.ts   comingSoon() → toast «Disponível em breve»
src/app/router.tsx, src/app/providers.tsx   (alterados)
tests/features/catalog/*.test.ts(x)  tests/features/admin/*.test.tsx
e2e/catalog.spec.ts  e2e/admin-features.spec.ts
```

---
