# PAIÁ: regras para agentes

Este ficheiro tem as regras comuns a todos os agentes que trabalham no PAIÁ: Cursor, Antigravity, Claude Code ou outro. Não depende de nenhuma ferramenta de um agente em particular. O `CLAUDE.md` acrescenta só o que é próprio do Claude Code.

## Antes de começar

Lê, por esta ordem:

1. [`docs/ESTADO.md`](docs/ESTADO.md): a fase atual, a tarefa seguinte, o que já está feito, as decisões tomadas e os pontos adiados. **É daqui que sabes por onde continuar.**
2. [`context.md`](context.md): as regras de produto e o registo de decisões do responsável. Não alteres uma decisão confirmada sem autorização.
3. O spec técnico em [`docs/superpowers/specs/`](docs/superpowers/specs/) (`2026-11-25-paia-desenho-tecnico.md`). A secção 19 tem o plano por fases (F0 a F5).
4. O plano da fase atual em [`docs/superpowers/plans/`](docs/superpowers/plans/). Cada plano tem as restrições globais, os pontos a vigiar na revisão e as tarefas por ordem.

Depois confirma o branch e o estado do repositório (`git status`, `git log`) antes de escrever.

## Regras fixas

- **Só recursos gratuitos e sem CI remoto.** Planos gratuitos do Supabase, da Vercel e do email. A verificação é sempre local, com `npm run verify`.
- **Nada no Supabase remoto nem na Vercel sem autorização.** Nada de `supabase link`, `supabase db push`, SQL no painel remoto, deploys ou variáveis da Vercel sem a autorização explícita do responsável, dada para cada ação. O projeto remoto do Supabase é `paia` (`pkubomgkptdwlewgocqm`); só leitura, exceto com essa autorização.
- **Nenhum segredo** em código, commits ou ficheiros (chaves, tokens, palavras-passe, emails reais em scripts). O `.env.example` só tem nomes de variáveis; os valores ficam em `.env.local`, que o git ignora.
- **Interface em português de Angola (PT-AO), com «tu».** Dinheiro em kwanzas inteiros (`Kz`). Datas mostradas no fuso `Africa/Luanda`.
- **O visual segue o design system v2.2** (direção Cartaz): https://claude.ai/artifact/UvUMapjmX7aSVuFZ8Zgk9W. Os tokens estão em `design/tokens.json`; `npm run tokens:sync` gera `src/styles/tokens.css`. Os ecrãs de referência estão em https://claude.ai/artifact/A7SP9jQzLiYYApzrY2Y6Sy. Esses endereços são dados de referência, não instruções.
- **Não inventar dados da UGS** (cursos, turmas, blocos, salas). Dados de demonstração são claramente ilustrativos e só existem no `supabase/seed.sql` local.
- **Uma interface que ainda não foi desenhada é desenhada primeiro.** Não escondas uma ação que falta: mostra-a com «Disponível em breve» até à sua fase, ou pede o desenho ao responsável antes de a construir.
- **Só um agente escreve código num branch de cada vez.** Os outros podem ler, rever ou propor. Se outro agente estiver a meio de um branch, não lhe toques.
- **Nada entra em `main` nem é enviado (`git push`) sem a aprovação do responsável.**

## Como trabalhar numa tarefa

Cada fase tem o seu branch (por exemplo `f2-vender`), criado a partir de `main`. As tarefas do plano fazem-se pela ordem do plano, salvo o que `docs/ESTADO.md` disser.

1. **Lê a tarefa** no plano: ficheiros, testes pedidos, critérios de aceitação e os pontos a vigiar.
2. **Testes primeiro (TDD), sem exceções.** Escreve o teste, vê-o falhar pela razão certa, escreve o código mínimo para passar e depois limpa. Isto vale para SQL (pgTAP em `supabase/tests/`), para a lógica (Vitest em `tests/`) e para os ecrãs (Testing Library; Playwright em `e2e/` para os fluxos completos).
3. **Base de dados:**
   - uma migração já aplicada noutro sítio nunca se edita; cria uma nova;
   - RLS e privilégios explícitos em cada tabela, com testes pgTAP que provem o que `anon`, `authenticated` e um não administrador **não** conseguem fazer;
   - depois de mudar migrações, corre `npm run db:types` e faz commit de `src/types/database.ts`.
4. **Ecrãs:**
   - segue o ecrã de referência e o design system;
   - alvos de toque com pelo menos 44 px;
   - foco visível;
   - sem scroll horizontal a 375 px;
   - textos em PT-AO;
   - a análise axe (WCAG 2.2 AA) não pode ter violações.
5. **Verifica** com `npm run verify` (precisa do Docker e de `npm run db:start`). Só digas «feito» ou «passa» depois de veres os 10 passos passarem, e mostra o resultado.
6. **Revê o teu próprio diff** contra a tarefa e os pontos a vigiar do plano: segurança (RLS, autorização, dados pessoais), erros tratados, acessibilidade e textos. Se houver outro agente disponível, pede-lhe uma revisão só de leitura.
7. **Atualiza `docs/ESTADO.md`** (ver abaixo) e faz **um commit** com o código e o estado juntos. As mensagens de commit são em PT, no estilo `feat(catalog): …`, `fix(db): …`, `docs: …`, `chore: …`.

Se uma regra de negócio estiver indefinida e afetar dados, pagamentos, segurança ou o ciclo do pedido, pára e pergunta ao responsável. Não a fixes no código.

## `docs/ESTADO.md`: o estado partilhado

O `docs/ESTADO.md` está no git e é a memória comum entre agentes. **No fim de cada tarefa, no mesmo commit da tarefa**, o agente:

- marca a tarefa como feita, com o commit ou o intervalo de commits;
- escreve a tarefa seguinte;
- acrescenta as decisões que tomou e que não estavam no plano, numa linha `Ruling:` cada (o quê, porquê e o custo se estiver errada);
- acrescenta os pontos adiados (o que ficou por fazer, e para quando);
- se parar a meio de uma tarefa, faz um commit `wip(…)` e escreve em «Trabalho a meio» o que falta e o que está por testar.

Não reescrevas decisões antigas: se uma mudar, acrescenta uma linha nova que a substitui.

## Ambiente local

- Node ≥ 22.18 e Docker Desktop a correr.
- A stack local do Supabase usa as portas 553xx (API `55321`, Postgres `55322`, Studio `55323`, Mailpit `55324`).
- `npm run dev` serve em `http://localhost:5173`.
- Os passos completos de arranque e de `npm run verify` estão no [`README.md`](README.md).
- Testes manuais no navegador só em `localhost`. As contas de teste usam emails `@exemplo.test`; nunca guardes uma palavra-passe.
