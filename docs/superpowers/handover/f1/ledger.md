# SDD ledger — plan: docs/superpowers/plans/2026-11-26-f1-catalogo.md

Spec: docs/superpowers/specs/2026-11-25-paia-desenho-tecnico.md (binding) + owner decisions of 2026-11-26 recorded in the plan (featured stores admin-managed, later-phase actions visible with «Disponível em breve», limits approved, photos before public launch).
Branch: f1-catalogo from main c1de97a (in place at C:\paia). Pushed to origin: main, f0-fundacao. Global constraints for subagents: global.md (plan lines 1–134).
Local Supabase: api 55321, db 55322 (container supabase_db_paia). F0 migration may not be edited; F1 migration 20261126000000 is new and unapplied anywhere.

## Pre-flight scan
| Tasks | Shared | Finding |
|---|---|---|
| T1→T2→T3 | same migration file | sequential edits of one unapplied migration — OK |
| T1 | policies on ungranted columns (stores.status, categories.is_visible) | plan already says: use private definer helper if needed |
| T2/T3 ↔ T4 | list_stores / list_featured_stores columns ↔ StoreSummary/FeaturedStore | consistent (source → isPromoted) |
| T4 | providers onUserChange removeQueries(['me']) ↔ F0 ProfilePage key ['my-profile'] | T4 changes key to ['me','profile',userId] — OK |
| T5 → T7, T10 | design approval gate | T7/T10 blocked until owner approves designs; T6, T8, T9 can proceed meanwhile (T6 PromotedTag depends on T5 badge design → implement placeholder per DS rules, adjust after approval) |
| T6 ↔ T9 | ProductCard add button vs C03 bar | consistent: both use comingSoon() |
| T10 | alert-dialog/switch shadcn | restyle like F0 T4 |
| T11 | admin e2e promotes via docker psql | local only, no stored password — OK |

## Rulings
- Ruling: execution order 1,2,3,4,5(design, controller),6,8,9, then 7,10 after design approval, then 11 — avoids idling on the approval gate — cost: T6 PromotedTag may need a small restyle after approval.

## Progress
- T1 dispatched: base c1de97a, impl opus
- T1 impl DONE: abe19bf (142 pgTAP, 208 vitest). Policies on ungranted columns work (no helper needed).
- Ruling: descriptions (stores/products) must keep line breaks — normalise per line, not collapse \n — product copy needs paragraphs; cost: small function change. Goes into T1 fix round.
- T1 reviews dispatched: task reviewer (opus) + backend-design:schema-reviewer (opus) + backend-design:security-reviewer (opus).
- T1 schema-reviewer: 0 Critical, 7 Important (FK KEY SHARE vs FOR UPDATE deadlock → for no key update; counter trigger on every update → narrow + no-op guard; rating checks; moderation reason check+normalise; inline products policy + cursor indexes; store_id immutable), minors listed in agent report.
- T1 security review: 0 Critical; I: counter on every update; USAGE on private widened → inline policies, drop helpers. Task review: Needs fixes (same counter issue); minors: service_role default ACL (accepted, matches F0), test gaps.
- Ruling: inline RLS policies chaining through granted columns instead of definer helpers; private schema stays closed — removes defence-in-depth regression and per-row SubPlan — cost: T3 featured function checks status itself.
- T1 fix round 1 dispatched (resume implementer) with consolidated list (counter narrowing + no key update, immutable store_id, inline policies, cursor indexes, invariants, multiline descriptions, slug/path checks, tests).
- T5 design: published 3 artboards to canvas (version 1795700600-82e5): A07-Destaques (lote4), C01b-Inicio-destaques and X01-Selos-e-avisos (lote1). Awaiting owner approval (gate for T7, T10).
- T1 fix round 1 impl DONE: 96ed807 (188 pgTAP). Scoped re-review dispatched (opus).
- T1 fix round 1/5 (8 addressed, 0 open; commits abe19bf..96ed807). Re-review clean (live checks: no hidden-store leak, private closed, no ReDoS).
Task 1: complete (commits c1de97a..96ed807, review clean)
- Deferred to T2 brief: U+2028/U+2029 in normalize_multiline → map to \n; status-filter/order-by-owner tests as authenticated.
- Deferred to F2: any new SELECT policy on stores (owner/admin) widens products visibility via the inlined policy — decide explicitly then.
- T2 dispatched: base 96ed807, impl opus
- T2 impl DONE_WITH_CONCERNS: 36bd7d6 (238 pgTAP; verify 10/10). public.search_key instead of private; dynamic SQL via EXECUTE…USING; INVALID_CURSOR added.
- Ruling: hidden category hides only the category tile/filter; its products stay visible with null category columns — admin hides products via moderation — cost: UI must tolerate null category (T4 types nullable).
- Ruling: INVALID_CURSOR gets a PT-AO message in T4 errors.ts.
- T2 review dispatched (opus, incl. dynamic SQL injection check).
- T2 review: Approved. Minors deferred: tests delete seed rows (T3 must delete store_features first); cursor created_at must stay raw string (T4); nullable types (T4); search_key public RPC (accepted); list_stores double search_key (accepted); IMMUTABLE over unaccent (record if indexed).
Task 2: complete (commits 96ed807..36bd7d6, review clean)
- T3 dispatched: base 36bd7d6, impl opus
- T3 impl DONE: 3a14455 (324 pgTAP, 212 vitest). Reorder = exactly the set of active admin features. list_featured_stores dedups per store.
- Notes for T10: send every active admin feature to reorder; validate note ≤280 and position ≥0 client-side; nullable arg types need own types.
- T3 reviews dispatched: task reviewer (opus) + backend-design:security-reviewer (opus).
- T3 security review: 0 Critical/Important; Minors: raw 23514 echo (validate position/note → INVALID_POSITION/INVALID_TEXT), note normalisation before admin check, add source='admin' to UPDATE WHERE, set_active must re-check store approved, optional advisory lock reorder vs create. All to be folded into T3 fix round.
- T3 task review: Approved (minors: is_live semantics, paid precedence provisional, reorder NOT_FOUND overloaded — A07 must refetch on NOT_FOUND, store status race, re-activated position).
- Ruling: hardening fix round before A07 builds on it (validation before write, admin check first, source filter on UPDATE, set_active re-checks approval + appends position, single shown-rule) — cheap now — cost: one round.
- T3 fix round 1 dispatched.
- T3 fix round 1 impl DONE: 64ac91b (333 pgTAP, 213 vitest). Scoped re-review dispatched (sonnet).
- Ruling: start T4 (frontend data layer, no DB files) in parallel with the T3 re-review — no shared files; if the re-review reopens T3, its fix waits until T4's implementer finishes — cost: possible short wait.
- T4 dispatched: base 64ac91b, impl sonnet
- T3 fix round 1/5 (5 addressed, 0 open; commits 3a14455..64ac91b). Re-review clean (reorder already locks by id order per earlier review).
Task 3: complete (commits 36bd7d6..64ac91b, review clean)
- T5 design APPROVED by owner (2026-11-27): A07-Destaques, C01b-Inicio-destaques, X01-Selos-e-avisos (canvas version 1795700600-82e5). Gate for T7/T10 open.
- T4 impl DONE: 4dea558 (246 vitest). Review dispatched (sonnet).
- T4 review: Approved. Minors deferred: useProducts key/getNextPageParam untested directly; ProfilePage pending without session (guarded route); mutation cache not cleared on user change (add in F2/F3); non-array data → []; Number('') rating; extra empty page fetch.
Task 4: complete (commits 64ac91b..4dea558, review clean)
- T6 dispatched: base 4dea558, impl opus
- T6 impl DONE_WITH_CONCERNS: 2981c9c (275 vitest). Extra helpers tag-styles.ts, store-text.ts, icon-button.ts.
- Ruling: CatalogSkeleton drops aria-busy once the retry state shows — so the button is announced — cost: none.
- Ruling: 2px photo radius offset and 18px initials accepted (no exact token) — cost: 1px visual.
- T6 review dispatched (sonnet).
- T6 review: Approved; I (unverified): ProductCard price may overflow at 375px. Minors: duplicate alt, emoji initials, untested toast duration/rotation, redundant cn, unused variant, skeleton retry reset.
- Ruling: card images alt="" (decorative; adjacent h3 link names it); product page keeps descriptive alt — deviates from global "alt = product name" for cards only — cost: none for a11y (better).
- T6 fix round 1 dispatched.
- T6 fix round 1/5 (6 addressed, 0 open; commits 2981c9c..93dccad). Controller-inspected small diff (7 files, +71) + implementer visual check at 375px — Ruling: no extra review seat.
Task 6: complete (commits 4dea558..93dccad, review clean)
- T7 dispatched: base 93dccad, impl opus (designs approved)
- T7 impl DONE: c408a06 (305 vitest, manual check OK). Review dispatched (sonnet).
- T7 review: Approved. Minors: StoresPage text not resynced from URL q (fold into T8: shared fix); empty no-filter state has no Limpar (accepted); section skeleton shape (cosmetic); categories error silent (accepted).
Task 7: complete (commits 93dccad..c408a06, review clean)
- T8 dispatched: base c408a06, impl opus (includes StoresPage URL→field resync)
- T8 impl DONE: 564fe2c (325 vitest, manual check OK). Shared use-search-text hook. .claude/launch.json left untracked (agent could not delete under auto mode) — not acted on by controller; tell user.
- Ruling: after «Procurar em tudo», move focus to the results count/status text (tabIndex -1) rather than the chip — goes in fix round if review agrees — cost: small.
- T8 review dispatched (sonnet).
- T8 review: Approved. Minors fixed in round 1: stale focusIndex after failed page, focus after «Procurar em tudo» (status or empty title), category-pending status text. Deferred: chip within debounce window (harmless).
- T8 fix round 1 dispatched.
- T8 fix round 1/5 (3 addressed; commits 564fe2c..c08445d). Controller-inspected; implementer verified focus in browser — Ruling: no extra review seat (a11y-only, tested).
Task 8: complete (commits c408a06..c08445d, review clean)
- T9 dispatched: base c08445d, impl opus
- T9 impl DONE: 894e336 (370 vitest; manual check OK). New shared props (AppHeader start, PageShell footer, StoreLink meta, EmptyState headingLevel), use-load-more-focus hook.
- Ruling: quantity buttons must be 44px tall (global touch-target rule beats canvas 40px) — goes into the fix round — cost: 4px.
- T9 review dispatched (sonnet).
- T9 review agent stopped by rate limit before reporting (agent a70bb0c36cbb4d03d). Session handed off to a new session at owner's request (2026-11-27). Resume from: re-dispatch T9 review (package review-c08445d..894e336.diff), then T9 fix round (incl. 44px qty buttons ruling), T10, T11, final review.
- [new session] T9 review re-dispatched (sonnet).
- T9 review: Needs fixes — I: stepper 44×40. Minors: qty not clamped to stock, alt index, BottomNav swap jump, logo alt duplicate, unknown categoria, back fallback push, qty live region context, tests fake history idx (accepted + comment). Copy: 3 new texts approved.
- Ruling: C03 never shows BottomNav (any state) — resolves the contradictory "tab explorar" vs "no BottomNav" decisions; header Voltar suffices — cost: none.
- Ruling: unknown ?categoria= on C04 is treated as «Tudo» — cost: none.
- T9 fix round 1 dispatched (fresh implementer, sonnet; original agent was in the previous session).
- T9 fix round 1/5 (8 addressed; commits 894e336..1d60f14, 378 vitest). Controller-inspected — Ruling: no extra review seat (small, tested).
Task 9: complete (commits c08445d..1d60f14, review clean)
- T10 dispatched: base 1d60f14, impl opus
- [2026-11-27] T10 implementer stopped mid-work (partial uncommitted files in tree). Owner asked for a FRESH session; handover note at side-session-notes/local_cc897e3a…/handover-f1-tasks-10-11.md. Remaining: T10 (finish/review), T11, final review, report.
- [session 3, 2026-11-27] Resumed from handover. Skills/MCP for T10: superpowers:test-driven-development, frontend-design:frontend-design, design-skills:interaction-design, design:accessibility-review, backend-design:auth-and-authorization, run + built-in browser (manual check); Artifact read for A07 (saved to ref/screens/project/A07-Destaques.dc.html, version 1795769953-b301). Reviewers: task reviewer (opus) + backend-design:security-reviewer (opus).
- Ruling: keep the stopped implementer's partial T10 tree and have a fresh opus implementer audit, finish or rewrite it — 1.5k lines with tests already exist — cost: implementer may rewrite parts anyway.
- T10 re-dispatched: base 1d60f14, impl opus (fresh)
- T10 implementer agent: a8bb3a604b23d56a1
- T10 impl DONE_WITH_CONCERNS: aa889bb (450 vitest, verify 10/10, manual check OK). ui/button.tsx → forwardRef (focus return).
- Ruling: keep a 5th estado «Loja não aprovada» for an active, in-period feature whose store is no longer approved — showing «No ar» would be false — cost: one undesigned label; owner to confirm.
- Ruling: A07 has no «Ordem» input, so new features go to last position; ordering is done with Subir/Descer; T11 e2e "posição 0" is reached by adding then moving up — cost: e2e a few more clicks.
- Ruling: undesigned microcopy accepted (Escolhe uma loja da lista., A nota pode ter até 280 caracteres., Não encontrámos lojas aprovadas com esse nome., empty state, Destaque removido.) and K03 «Administração» as full-width secondary button — owner to confirm — cost: copy change.
- T10 reviews dispatched: task reviewer (opus) + backend-design:security-reviewer (opus).
- T10 security review: 0 C/I, 2 Minor (admin key without userId; toast after user switch) — fold into fix round.
- T10 task review: Spec ✅, Quality Needs fixes — I1 toggling Ativo remounts row between lists, focus lost to body; I2 featureStatus defaults to «Loja não aprovada» without checking storeStatus (stale after time passes). Minors: M1 inactive rows «— Sem ordem» + inert arrows; M2 NOT_FOUND refocus race; M3 Origem announced twice; M4 unparseable date silently dropped.
- Ruling: inactive rows show «— Sem ordem» instead of a number (deviation from A07) — the reorder RPC only orders active admin features — cost: small visual deviation; hide the inert arrows on inactive rows (M1 folded into fix round).
- Ruling: fold review M1, M3, M4 and security M1 (userId in admin key), M2 (toast after user switch) into fix round 1; M2 (refocus race) deferred as minor.
- Task 10: minor (deferred): NOT_FOUND reorder refocus race (FeaturesPage onSettled batching).
- T10 fix round 1 dispatched (resume implementer).
- T10 fix round 1 impl DONE_WITH_CONCERNS: ccc0602 (464 vitest, verify 10/10). AuthProvider exports currentUserId() (F0 shared file). New copy «Indica uma data e hora válidas.». Scoped re-review dispatched (sonnet).
- T10 fix round 1/5 (7 addressed, 0 open; commits aa889bb..ccc0602). Re-review (opus) clean; 6 minors in task-10-rereview-1.md (e.g. focus after failed toggle, no timer for now) — deferred to final review triage.
- Task 10: minor (deferred): see task-10-rereview-1.md minors (6).
Task 10: complete (commits 1d60f14..ccc0602, review clean)
- T11 skills: superpowers:test-driven-development, 10x-Team:qa-engineer, design:accessibility-review, engineering:documentation, superpowers:verification-before-completion. Impl opus (integration: e2e + docker psql admin promotion).
- T11 dispatched: base ccc0602, impl opus
- T11 impl DONE_WITH_CONCERNS: b1f77f3 (verify x2 green: 464 vitest, 333 pgTAP, 12 e2e; axe 0). Extra e2e/support.ts helper; store link test uses salgados-do-bloco (seed owner of Pastéis); admin spec resets seed features in beforeAll via local psql; e2e auth.users accounts remain until db:reset.
- Ruling: accept e2e/support.ts (shared axe + psql helper) and /loja/salgados-do-bloco as the seed-defined slug (brief allows "ou o slug que o seed definir") — cost: none.
- T11 review dispatched (sonnet).
- T11 review: Spec ✅, Needs fixes — I: racy reorder loop (non-retrying aria-disabled read; r.ok() predicate hides RPC failures as timeouts). Minors: mutated featured state left behind; resetFeatures not exact seed; parallel files without workers:1; Prettier nit.
- Ruling: fold minors (restore exact seed featured state after the admin spec, run that file serially / isolate from parallel catalog spec) into fix round 1 — e2e flakiness costs every later verify — cost: one round.
- T11 fix round 1 dispatched (resume implementer).
- T11 fix round 1 impl DONE: b0ca825 (e2e 12/12 x2, verify x2 green; workers:1; afterAll restores exact store_features). Scoped re-review dispatched (sonnet).
- T11 fix round 1/5 (4 addressed, 0 open; commits b1f77f3..b0ca825). Re-review (sonnet) clean.
- Task 11: minor (deferred): failing reorder RPC surfaces first as a 20 s toPass timeout before the status assertion.
Task 11: complete (commits ccc0602..b0ca825, review clean)
- Final review: base c1de97a, head b0ca825, opus — code-review (high) reviewer + security-review reviewer in parallel (read-only).
- Final security review (opus): 0 findings; live anon/non-admin checks against local confirmed no leak.
- Final code review (opus, code-review high): 0 C, 2 I (I1 non-UUID /produto/:id → generic error with dead retry, 22P02 unmapped; I2 expired-but-active feature blocks re-featuring the store, FEATURE_EXISTS), 4 M (A07 status not ticking while open + misleading comment; note counter vs DB normalisation; full last page «24+» + Ver mais loading nothing; position collision on concurrent activations). Unverified T6 price overflow at 375px to check.
- Ruling: I1 — map 22P02 / invalid uuid in get_product to the not-found state (client validates uuid shape before calling, and translateDbError treats 22P02 as NOT_FOUND) — cost: none.
- Ruling: I2 — admin_save_feature creating a feature for a store whose active admin feature has already ended deactivates the expired row in the same transaction and inserts the new one (keeps history; a still-live or scheduled feature still gives FEATURE_EXISTS) — editing the unapplied F1 migration is allowed — cost: if the owner wanted expired rows reused in place, a small RPC change.
- Ruling: fold all 4 final minors + the 375px price check into the single fix wave — cheap and visible — cost: slightly larger wave.
- Final fix wave dispatched (opus, fresh), base b0ca825.
- [2026-11-27] Final fix wave agent (a36179fa49f534d50) stopped at 5-hour rate limit (resets 17:10 Luanda). Owner asked about moving to cloud.
- [2026-11-27] Owner said «faça ambos» (remote control + send to GitHub/cloud). Done: git push -u origin f1-catalogo (b0ca825); Remote Control on; keep-awake requested; one-shot cron d6c3b3c3 at 17:14 to resume fix-wave agent a36179fa49f534d50.
- Ruling: no parallel cloud session writing f1-catalogo while this session continues — CLAUDE.md allows only one agent writing per branch, and the cloud likely lacks Docker/local Supabase for npm run verify — cost: owner follows via Remote Control instead of a cloud session; can still move to cloud later from the pushed branch.
- Ruling: owner's «faça ambos» authorises pushing f1-catalogo after each new commit in this phase (not merging to main) — cost: if push was meant once only, later pushes are visible on GitHub but reversible.
- [17:14] Fix-wave agent resumed after rate limit.
- [17:20] Owner leaving; fix-wave agent stopped mid-work. WIP committed + handover copied to docs/superpowers/handover/f1/ (ledger, reviews, briefs) and pushed so another computer can continue.
