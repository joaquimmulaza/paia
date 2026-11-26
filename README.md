# PAIÁ

Mercado da comunidade da UGS: compra e venda entre estudantes, professores e funcionários. Esta é a fase F0 (fundação): contas, sessão e perfil.

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

Corre estes passos por ordem e pára no primeiro erro:

1. `lint`: ESLint, incluindo as regras de acessibilidade (`jsx-a11y`).
2. `format:check`: Prettier.
3. `typecheck`: TypeScript em modo estrito.
4. `test`: testes unitários e de componentes (Vitest).
5. `db:reset`: recria a base de dados local a partir das migrações e do `seed.sql`.
6. `db:test`: testes da base de dados (pgTAP): RLS, permissões e restrições.
7. `build`: build de produção.
8. `e2e`: registo, sessão e perfil no navegador, com análise de acessibilidade (axe, WCAG 2.2 AA) em `/entrar`, `/criar-conta` e `/perfil`.

O `verify` **não** arranca o Supabase. Se a stack local estiver parada, o passo `db:reset` falha com a mensagem da CLI: corre `npm run db:start` primeiro.

O passo `e2e` arranca o `npm run dev` sozinho, ou reaproveita um que já esteja a correr. Cria uma conta nova em cada execução, com um email fictício (`@exemplo.test`).

## Primeiro administrador

O papel de administrador vem só da tabela `public.admin_users`. Para promover o primeiro:

1. O responsável regista-se normalmente na aplicação.
2. Abre `supabase/scripts/bootstrap_admin.sql` no editor SQL do painel do Supabase (ou no Studio local).
3. Substitui `<EMAIL_DO_RESPONSAVEL>` pelo email da conta, **à mão, no editor**, e corre.

**Nunca** grava o email real no ficheiro nem faz commit dele. Correr o script no projeto remoto também precisa da autorização do responsável (ver abaixo).

## Dados de exemplo

O `supabase/seed.sql` tem só dados ilustrativos e corre só localmente (no `db:reset`). Nunca o apliques ao projeto remoto.

## Projeto remoto e deploy

> **Atenção:** nada é aplicado ao projeto remoto do Supabase (`supabase link`, `supabase db push`, SQL no painel) nem à Vercel (deploys, variáveis) sem a autorização explícita do responsável, dada para cada ação.

Nenhum segredo (chaves, tokens, palavras-passe) entra no código, nos commits ou neste README.
