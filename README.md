# PAIÁ

Mercado da comunidade da UGS: compra e venda entre estudantes, professores e funcionários. A fase atual e o que já está feito estão em [`docs/ESTADO.md`](docs/ESTADO.md).

As regras de produto e o registo de decisões estão em [`context.md`](context.md). A arquitetura está em [`docs/superpowers/specs/`](docs/superpowers/specs/).

## Requisitos

- **Node ≥ 22.18** (recomendamos o Node 24).
- **Docker Desktop**, a correr. A stack local do Supabase usa-o.

Tudo corre localmente e só com recursos gratuitos. Não há CI remoto: a verificação é `npm run verify`, no teu computador.

## Arrancar pela primeira vez

```sh
npm install
npx playwright install chromium   # navegador dos testes ponta a ponta
npm run db:start                  # arranca a stack local do Supabase (Docker)
cp .env.example .env.local
```

Depois, preenche o `.env.local` com os valores de `npx supabase status`:

| Variável                 | Valor em `npx supabase status`          |
| ------------------------ | --------------------------------------- |
| `VITE_SUPABASE_URL`      | o URL da API (`http://127.0.0.1:55321`) |
| `VITE_SUPABASE_ANON_KEY` | a chave anon (publishable)              |

O `.env.local` está no `.gitignore` e nunca entra num commit. O `.env.example` só tem os nomes das variáveis.

Por fim:

```sh
npm run dev      # aplicação em http://localhost:5173
```

## Portas locais

As portas foram mudadas das predefinidas do Supabase (543xx) para 553xx, porque outro projeto local já usa as predefinidas. A configuração está em `supabase/config.jsonc`.

| Serviço                   | Endereço               |
| ------------------------- | ---------------------- |
| API                       | http://127.0.0.1:55321 |
| Base de dados (Postgres)  | `127.0.0.1:55322`      |
| Studio                    | http://127.0.0.1:55323 |
| Mailpit (emails de teste) | http://127.0.0.1:55324 |

As confirmações de email estão desligadas localmente; os emails que a stack enviaria aparecem no Mailpit.

## Comandos

| Comando               | O que faz                                                                     |
| --------------------- | ----------------------------------------------------------------------------- |
| `npm run db:start`    | Arranca a stack local do Supabase.                                            |
| `npm run dev`         | Servidor de desenvolvimento do Vite.                                          |
| `npm run verify`      | Verificação completa (ver abaixo).                                            |
| `npm run e2e`         | Só os testes ponta a ponta (Playwright, Chromium, ecrã de telemóvel Pixel 7). |
| `npm run db:types`    | Gera `src/types/database.ts` a partir da base de dados local.                 |
| `npm run tokens:sync` | Gera `src/styles/tokens.css` a partir de `design/tokens.json`.                |

### `npm run verify`

Antes do passo 1, confirma que o `.env.local` existe e tem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (só verifica a presença, nunca mostra os valores). Depois corre estes passos por ordem e pára no primeiro erro:

1. `lint`: ESLint, incluindo as regras de acessibilidade (`jsx-a11y`).
2. `format:check`: Prettier.
3. `tokens:sync` + `git diff`: falha se `src/styles/tokens.css` não coincidir com o que `design/tokens.json` gera.
4. `typecheck`: TypeScript em modo estrito.
5. `test`: testes unitários e de componentes (Vitest).
6. `db:reset`: recria a base de dados local a partir das migrações e do `seed.sql`.
7. `db:types` + `git diff`: falha se `src/types/database.ts` não coincidir com os tipos gerados da base local.
8. `db:test`: testes da base de dados (pgTAP): RLS, permissões e restrições.
9. `build`: build de produção.
10. `e2e`: no navegador, com análise de acessibilidade (axe, WCAG 2.2 AA):
    - registo, sessão e perfil (`/entrar`, `/criar-conta`, `/perfil`);
    - catálogo sem sessão: Início, pesquisa, produto, loja, lojas e produto escondido;
    - destaques: uma conta nova é promovida a administradora, remove e adiciona destaques em `/admin/destaques`, e o Início acompanha.

Os passos 3 e 7 comparam com o último commit: se mudares os tokens ou as migrações, faz commit dos ficheiros gerados.

O `verify` **não** arranca o Supabase. Se a stack local estiver parada, o passo `db:reset` falha com a mensagem da CLI: corre `npm run db:start` primeiro.

O `npm run dev` fixa a porta 5173 (`--strictPort`): se estiver ocupada, falha em vez de usar outra. O passo `e2e` arranca o `npm run dev` sozinho, ou reaproveita um que já esteja a correr. Cria contas novas em cada execução, com emails fictícios (`@exemplo.test`). O teste dos destaques usa o `docker exec supabase_db_paia psql` para promover a conta e, no fim, tira-lhe outra vez o papel de administrador. No fim, repõe também os destaques exatamente como estavam, por isso o `npm run e2e` pode correr várias vezes sem `db:reset`. Os ficheiros do e2e correm um de cada vez (`workers: 1`), para o catálogo nunca ver os destaques a meio da mudança. Se uma execução for interrompida a meio, corre `npm run db:reset` antes da seguinte.

## Contas criadas fora da aplicação

Utilizadores criados no Studio ou no painel do Supabase falham com `TERMS_REQUIRED`, **por desenho**: o trigger exige os metadados do registo (termos, vínculo, etc.). As contas têm de ser criadas pela aplicação.

## Primeiro administrador

O papel de administrador vem só da tabela `public.admin_users`. Para promover o primeiro:

1. O responsável regista-se normalmente na aplicação.
2. Abre `supabase/scripts/bootstrap_admin.sql` no editor SQL do painel do Supabase (ou no Studio local).
3. Substitui `<EMAIL_DO_RESPONSAVEL>` pelo email da conta, **à mão, no editor**, e corre.

**Nunca** grava o email real no ficheiro nem faz commit dele. Correr o script no projeto remoto também precisa da autorização do responsável (ver abaixo).

## Catálogo e dados ilustrativos

**O que o seed cria.** O `supabase/seed.sql` corre no fim de cada `npm run db:reset` e enche o catálogo local com dados inventados:

- 5 lojas aprovadas e 1 à espera de aprovação, com produtos que cobrem os casos do ecrã: esgotado, «Últimas N», «Novo», um por publicar, um ocultado pela moderação, um nome longo e um preço alto;
- 3 destaques em «Lojas da comunidade»: Doces da Ana e Gelados Fresquinhos no ar, e Mimos da Teresa já terminado (só aparece na administração);
- uma estudante sem loja (`sara@exemplo.test`), para ver o ecrã «Vender» de quem ainda não pediu loja; a loja pendente («Lanches da Rita») tem um logótipo cujo ficheiro não existe, e a interface mostra o fundo de imagem;
- contas dos donos e da equipa, todas com emails `@exemplo.test`. Não servem para entrar: a palavra-passe é aleatória e ninguém a conhece.

As categorias vêm da migração de F1, não do seed. Não há dados da UGS.

**Só local.** Estes dados nunca vão para o projeto remoto: não apliques o `seed.sql` lá, nem copies as linhas à mão.

**Sem imagens.** O seed não traz fotografias: os ecrãs mostram o fundo `brand-tint` com o ícone de imagem. As lojas e os produtos criados em «Vender» já levam fotos reais (ver abaixo).

**Entrar como administrador local e gerir os destaques:**

1. Com a stack a correr (`npm run db:start`) e a app aberta (`npm run dev`), cria uma conta em http://localhost:5173/criar-conta. Usa um email `@exemplo.test` e uma palavra-passe só tua: não a escrevas em nenhum ficheiro.
2. Torna-a administradora na base local (troca o email pelo teu):

   ```sh
   docker exec supabase_db_paia psql -U postgres -c "insert into public.admin_users (user_id) select id from auth.users where email = 'tu@exemplo.test'"
   ```

   Também podes usar o `supabase/scripts/bootstrap_admin.sql` no Studio local (http://127.0.0.1:55323).

3. Abre http://localhost:5173/admin/destaques (recarrega a página se já a tinhas aberta). Aí podes:
   - **adicionar** uma loja aprovada com «Adicionar destaque»: entra no fim da lista, com datas de início e fim opcionais;
   - **mudar a ordem** com «Subir» e «Descer»: a ordem da lista é a ordem no Início, que mostra até 10 lojas;
   - **ligar e desligar** cada destaque com o interruptor «Ativo»;
   - **remover** um destaque, depois de confirmares. A loja e os produtos não mudam.
4. Para deixares de ser administrador: `docker exec supabase_db_paia psql -U postgres -c "delete from public.admin_users where user_id = (select id from auth.users where email = 'tu@exemplo.test')"`. Um `npm run db:reset` também apaga a conta e repõe os destaques do seed.

## Vender

Só os estudantes abrem loja, uma por conta. O percurso:

1. **Pedir a loja** (`/vender`, `/vender/pedido`): nome, descrição, categoria e logótipo. Podes guardar um rascunho (só pede nome e categoria) ou enviar para análise (pede também descrição e logótipo). O endereço da loja sai do nome (`/loja/doces-da-ana`, e `-2`, `-3` se o nome já existir).
2. **Esperar** (`/vender/estado`, `/vender/pedido/ver`): enquanto a equipa analisa, a loja não aparece no catálogo. A resposta aparece aqui e em Perfil (não há notificações no F2). Se for recusada, vês a mensagem da equipa e podes corrigir e voltar a enviar, sem limite de tentativas.
3. **A administração decide** (`/admin/candidaturas`): a equipa vê os pedidos por analisar, aprova ou recusa (a recusa leva uma mensagem) e o histórico fica guardado. Se duas pessoas decidirem ao mesmo tempo, a segunda é avisada.
4. **Gerir a loja aprovada** (`/vender/loja`, `/vender/loja/editar`, `/vender/produtos`, `/vender/produtos/novo`, `/vender/produtos/:id`): publicar, ocultar, editar e apagar produtos (nome, descrição, categoria, preço em Kz, stock e 1 a 5 fotos). Um produto publicado precisa de pelo menos 1 foto. «Pedidos recebidos» fica «Disponível em breve» até à fase F3.

**Fotos.** Aceitam-se JPG, PNG e WebP até 15 MB. O navegador comprime-as para WebP (lado maior até 1600 px, o que também remove o EXIF) antes de as enviar, e o Storage recusa mais de 2 MB. Os ficheiros ficam em `stores/{id_da_loja}/…` e `products/{id_da_loja}/{id_do_produto}/…`, e cada vendedor só escreve na sua pasta.

**Experimentar em local.** Com `npm run db:start` e `npm run dev` a correr, cria uma conta de estudante em http://localhost:5173/criar-conta (email `@exemplo.test`) e abre http://localhost:5173/vender. Para aprovares o pedido, torna uma segunda conta administradora, como em «Catálogo e dados ilustrativos», e abre `/admin/candidaturas`. O ponta a ponta `e2e/seller.spec.ts` faz este percurso inteiro, com a verificação de acessibilidade (axe) em V02, V03, V04b, V06 e A01.

## Trabalhar com vários agentes

O PAIÁ é desenvolvido com vários agentes (Claude Code, Cursor, Antigravity), alternados quando um deles fica sem tokens. Para que qualquer um continue no ponto certo:

- [`AGENTS.md`](AGENTS.md) tem as regras comuns a todos. O Cursor e o Antigravity leem-no sozinhos. O Cursor tem também `.cursor/rules/paia.mdc`, que remete para ele. O `CLAUDE.md` importa-o e acrescenta as skills e os subagentes do Claude Code.
- [`docs/ESTADO.md`](docs/ESTADO.md) tem a fase atual, a tarefa seguinte, as tarefas feitas com os commits, as decisões e os pontos adiados. Cada agente atualiza-o no fim de cada tarefa, no mesmo commit.
- Os planos de cada fase estão em [`docs/superpowers/plans/`](docs/superpowers/plans/) e as tarefas fazem-se pela ordem do plano.
- Só um agente escreve num branch de cada vez. Antes de trocares de agente, confirma que o trabalho está num commit (um `wip(…)` serve) e que o `docs/ESTADO.md` diz o que falta.

## Projeto remoto e deploy

> **Atenção:** nada é aplicado ao projeto remoto do Supabase (`supabase link`, `supabase db push`, SQL no painel) nem à Vercel (deploys, variáveis) sem a autorização explícita do responsável, dada para cada ação.

Nenhum segredo (chaves, tokens, palavras-passe) entra no código, nos commits ou neste README.
