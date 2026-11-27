### Task 11: Ponta a ponta, acessibilidade e verificação

**Ficheiros:**
- Criar: `e2e/catalog.spec.ts`
- Modificar: `README.md` (secção «Catálogo e dados ilustrativos»)

**Interfaces:**
- Consome: tudo das tarefas anteriores e o `seed.sql`, aplicado pelo passo `db:reset` do `verify`.
- Produz: `npm run verify` cobre também o catálogo.

- [ ] **Passo 1: teste ponta a ponta** em `e2e/catalog.spec.ts`, sem sessão e com os dados do seed:
  - em `/`, aparece «Novidades na comunidade» com pelo menos um produto;
  - pesquisar «pasteis» em `/explorar` encontra «Pastéis de carne (3)» (ponto 1);
  - abrir o produto mostra o preço e «Loja aprovada pelo PAIÁ»;
  - a ligação da loja abre `/loja/doces-da-ana`, ou o slug que o seed definir;
  - pesquisar «pizza» em Salgados mostra «Nada para «pizza» em Salgados»;
  - abrir pela URL o id do produto não publicado do seed mostra «Não encontrámos o que procuras.» (ponto 2);
  - o axe, com `withTags(['wcag2a','wcag2aa','wcag22aa'])`, dá 0 violações em `/`, `/explorar?q=bolo`, `/explorar?q=pizza&categoria=salgados`, `/lojas`, `/loja/<slug>` e `/produto/<id>`.
- [ ] **Passo 1b: destaques ponta a ponta** em `e2e/admin-features.spec.ts`:
  - **Preparar o administrador:** registar uma conta pela interface, com email único `@exemplo.test`. Depois torná-la administradora num `globalSetup` ou passo do teste, com `docker exec supabase_db_paia psql -U postgres -c "insert into public.admin_users …"`. Não se guarda nenhuma palavra-passe de administrador em ficheiros.
  - **Remover:** em `/admin/destaques`, remover o destaque de Gelados Fresquinhos, depois de confirmar. Em `/`, essa loja deixa de estar em «Lojas da comunidade».
  - **Adicionar:** adicionar Salgados do Bloco na posição 0. Em `/`, aparece primeiro.
  - **Acessibilidade:** o axe dá 0 violações em `/admin/destaques`, com o formulário aberto e fechado.
- [ ] **Passo 2:** `npm run e2e`. Esperado: PASS. Se o axe apontar problemas, corrigir o componente e não o teste.
- [ ] **Passo 3:** no README, explicar:
  - que o seed cria lojas e produtos ilustrativos com contas `@exemplo.test`;
  - que esses dados nunca vão para o remoto;
  - que as imagens ainda não existem e só chegam com F2;
  - como entrar como administrador local e gerir os destaques.
- [ ] **Passo 4:** `npm run verify`, duas vezes seguidas. Esperado: todos os passos sem erros nas duas.
- [ ] **Passo 5:** fazer commit: `chore: ponta a ponta e axe do catálogo`.

---

## Fora desta fase

- **Comprar (F3):**
  - o carrinho a funcionar, o contador do carrinho e a folha C06 «Entra para fazer o pedido»;
  - nesta fase, os botões já existem e dizem «Disponível em breve».
- **Vender (F2):**
  - escrever lojas e produtos, `submit_store`, `admin_decide_store`, `store_decisions` e `get_my_store`;
  - enviar imagens: políticas de escrita do Storage e `browser-image-compression`.
  - **O carregamento de fotografias tem de estar pronto antes do lançamento público e da campanha de aquisição de utilizadores.** É uma decisão do responsável, de 2026-11-26; até lá ficam os placeholders.
- **Destaques pagos (Freemium, futuro):**
  - pagamentos, assinaturas e planos;
  - as funções do caminho `source = 'paid'`;
  - a ativação do selo «Promovida».
  - O modelo de dados e o selo já ficam preparados em F1.
- **Confiança (F4):** criar avaliações, mostrar as linhas de avaliação em C04, o funcionamento de «Denunciar produto» e «Denunciar loja» (os botões já existem) e a moderação por RPC.
- **Notificações (F3):** o funcionamento do sino de C01. O botão já existe.
- **Desempenho:** carregamento por rota e um índice de trigramas para a pesquisa, quando o catálogo crescer.
- **Decisões do responsável que continuam abertas:**
  - o separador de milhares do Kz (U+00A0 ou U+202F);
  - o ano com 2 dígitos nas datas.
