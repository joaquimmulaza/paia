# Passagem de testemunho — F1 (apagar esta pasta antes do merge em main)

Estado em 2026-11-27 17:20 (Luanda). Branch `f1-catalogo`.

## Feito
- Tarefas 1–11 completas e revistas (ver `ledger.md`). `npm run verify` passou 2× em `b0ca825`.
- Revisão final: segurança limpa (`final-security.md`); código: 2 Important + 4 Minor (`final-review.md`).

## Em curso (commit WIP, testes podem falhar)
Ronda única de correções da revisão final. O agente parou a meio:
- I1 começado: `src/features/catalog/api.ts` + `tests/features/catalog/api.test.ts` (uuid inválido → não encontrado; 22P02 → NOT_FOUND).
- I2 começado: só testes pgTAP em `supabase/tests/f1_catalog_test.sql` (RED); falta a mudança na função de guardar destaque da migração `20261126000000*`.

## Falta (pela ordem)
1. Terminar as correções — lista completa e decisões em `ledger.md` (linhas `Ruling:` do fim) e `final-review.md`:
   - I1: /produto/<não-uuid> → «Não encontrámos o que procuras.»; 22P02 → NOT_FOUND.
   - I2: criar destaque para loja cujo destaque ativo já terminou desativa o expirado na mesma transação e insere o novo no fim; vivo ou agendado continua FEATURE_EXISTS. Testes pgTAP.
   - M: estado em A07 atualiza com temporizador (60 s) + teste com fake timers.
   - M: contador da nota usa a mesma normalização da BD.
   - M: última página cheia não mostra «24+» nem «Ver mais» vazio.
   - M: posições sem colisão em ativações concorrentes (lock consistente em criar e set_active).
   - Verificar ProductCard com preço longo a 375 px.
2. `npm run verify` (tem de passar tudo).
3. Re-revisão do diff da ronda (base `b0ca825`).
4. `npm run verify` final, mostrar o resultado.
5. Relatório ao responsável com todas as linhas `Ruling:` do `ledger.md`; perguntar antes de merge em `main`.
6. Apagar `docs/superpowers/handover/` antes do merge.

## Regras
Ver `C:\paia\CLAUDE.md`. Supabase só local (`supabase start`; nunca link/db push/Vercel). Sem segredos. Não fazer commit de `.claude/launch.json`. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push para `f1-catalogo` autorizado pelo responsável; merge em `main` não.

## Para começar no outro computador
Na nova sessão do Claude Code, em `paia` no branch `f1-catalogo` (`git pull`), pede: «Lê docs/superpowers/handover/f1/README.md e continua o F1 a partir daí».
