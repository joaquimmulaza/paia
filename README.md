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
- contas dos donos e da equipa, todas com emails `@exemplo.test`. Não servem para entrar: a palavra-passe é aleatória e ninguém a conhece.

As categorias vêm da migração de F1, não do seed. Não há dados da UGS.

**Só local.** Estes dados nunca vão para o projeto remoto: não apliques o `seed.sql` lá, nem copies as linhas à mão.

**Sem imagens.** Ainda não há fotografias de lojas nem de produtos. Os ecrãs mostram o fundo `brand-tint` com o ícone de imagem. O envio de fotografias chega com a fase F2 (Vender).

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

## Trabalhar com vários agentes

O PAIÁ é desenvolvido com vários agentes (Claude Code, Cursor, Antigravity), alternados quando um deles fica sem tokens. Para que qualquer um continue no ponto certo:

- [`AGENTS.md`](AGENTS.md) tem as regras comuns a todos. O Cursor e o Antigravity leem-no sozinhos. O Cursor tem também `.cursor/rules/paia.mdc`, que remete para ele. O `CLAUDE.md` importa-o e acrescenta as skills e os subagentes do Claude Code.
- [`docs/ESTADO.md`](docs/ESTADO.md) tem a fase atual, a tarefa seguinte, as tarefas feitas com os commits, as decisões e os pontos adiados. Cada agente atualiza-o no fim de cada tarefa, no mesmo commit.
- Os planos de cada fase estão em [`docs/superpowers/plans/`](docs/superpowers/plans/) e as tarefas fazem-se pela ordem do plano.
- Só um agente escreve num branch de cada vez. Antes de trocares de agente, confirma que o trabalho está num commit (um `wip(…)` serve) e que o `docs/ESTADO.md` diz o que falta.

## Projeto remoto e deploy

> **Atenção:** nada é aplicado ao projeto remoto do Supabase (`supabase link`, `supabase db push`, SQL no painel) nem à Vercel (deploys, variáveis) sem a autorização explícita do responsável, dada para cada ação.

Nenhum segredo (chaves, tokens, palavras-passe) entra no código, nos commits ou neste README.
