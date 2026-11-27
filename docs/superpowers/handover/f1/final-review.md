# F1 final review — f1-catalogo, c1de97a..b0ca825

Reviewer: final whole-branch review (opus), read-only. Method: `code-review` skill at level `high` over c1de97a..HEAD, plus manual cross-checks of the findings against the migration, seed, data layer and the ledger. The full suite was not re-run (verify passed twice at b0ca825).

**Counts:** Critical 0 · Important 2 · Minor 4

**Verdict:** ready to merge once the two Important findings are fixed. Both are small, local fixes. No CLAUDE.md rule is broken.

## Rule checks (CLAUDE.md / global.md)

- **Secrets:** none in the diff. A grep for service-role keys, JWT prefixes and live keys found nothing.
- **`.claude/`:** not tracked. `.claude/launch.json` is untracked, so it is not committed. It shows as `?? .claude/` only.
- **Remote Supabase / Vercel:** the diff has no remote calls. Everything runs against the local stack.
- **Dates:** shown with `Africa/Luanda` (`src/lib/format.ts:13`). Admin `datetime-local` inputs are read as Luanda time and sent as `+01:00` (`src/features/admin/dates.ts`).
- **Cache clearing on user change:** `AuthProvider onUserChange` removes the `['me']` prefix (`src/app/providers.tsx:17`). The admin keys are `['me','admin','features',userId]`, so they are cleared, and they also carry the user id. The catalogue keys hold public data.

## Findings

### I1 — Important — A product URL that is not a UUID shows the generic error, not "not found"
- **Where:** `src/features/catalog/api.ts:122` (`getProduct`) → `get_product(p_id uuid)` (migration :509).
- **Scenario:** `/produto/123`, or a link that was cut short → PostgREST 22P02 "invalid input syntax for type uuid" → `translateDbError` returns `MESSAGES.generic` → ProductPage shows "Algo correu mal. Tenta outra vez." with a retry button that can never succeed. The user should see the NotFound state.
- **Fix:** in `getProduct`, check the id with a UUID regex and throw `new Error(MESSAGES.notFound)` before calling the RPC. Alternatively, map 22P02 to notFound for this call only. Add a unit test.

### I2 — Important — An expired feature cannot be re-featured: "Esta loja já está em destaque."
- **Where:** `supabase/migrations/20261126000000_f1_catalogo.sql:663` (`store_features_one_active_idx ... where is_active`), :874/:940 (→ `FEATURE_EXISTS`), `src/lib/errors.ts:19`.
- **Scenario:** after `db:reset`, the seed's Mimos da Teresa feature has `is_active = true` and `ends_at` in the past. A07 shows it as "Expirado", and C01 does not show it. The admin opens "Adicionar destaque" for Mimos da Teresa with new dates → unique violation → "Esta loja já está em destaque." This message is false from the admin's point of view. A workaround exists (switch the expired row off first), but nothing tells the admin about it, and the form has no edit path for the old row.
- **Fix:** either (a) in `admin_save_store_feature` create, when the conflicting active row has `ends_at <= now()`, raise a distinct code (`FEATURE_EXPIRED_EXISTS`) with an actionable PT-AO message («Esta loja tem um destaque terminado ainda ativo. Desliga-o antes de criar outro.»), or (b) narrow the index semantics, so that an expired row no longer holds the slot. Option (b) needs a trigger or a scheduled job, because `now()` cannot appear in an index predicate. Option (a) is the smallest fix. Add a pgTAP test, plus a UI test for the message.

### M1 — Minor — The status column does not tick while the page is open (= rereview m2)
- **Where:** `src/features/admin/FeaturesPage.tsx:136`; the comment in `status.ts` claims the opposite.
- **Scenario:** a feature ends at 10:00 while A07 stays open with no interaction. At 10:05 it still shows "No ar".
- **Fix:** add a `now` state that updates every 30–60 s, or a timeout to the next boundary. Alternatively, correct the comment. **Can wait.** At minimum, fix the comment.

### M2 — Minor — The note counter does not measure what the database stores
- **Where:** `src/features/admin/validate.ts:24`.
- **Scenario:** the client counts UTF-16 units after `trim()` only. The database counts code points after `private.normalize_text`, which collapses whitespace and strips zero-width characters. A note with emoji or blank lines can be rejected on the client even though the database would accept it. The reverse cannot happen, because the client is always stricter or equal.
- **Fix:** mirror the normalisation (strip the same invisible characters, `/\s+/g → ' '`, trim) and count with `Array.from(s).length`. **Can wait.**

### M3 — Minor — A full last page shows "24+ produtos" and a "Ver mais" that loads nothing (= T4 deferred "extra empty page fetch")
- **Where:** `src/features/catalog/api.ts:99`.
- **Scenario:** a filter with exactly 24 results → "24+ produtos" → tapping "Ver mais produtos" loads an empty page, and the count drops to "24 produtos".
- **Fix:** fetch `limit + 1` rows and set the cursor only when the extra row exists. **Can wait**, but it is cheap to do now.

### M4 — Minor — Feature positions can collide under concurrent activation
- **Where:** migration :948 (`admin_set_store_feature_active`, `max(position)+1` without the lock that reorder takes). `AddFeatureForm` also sends a `nextPosition` computed on the client.
- **Scenario:** two admins activate different features at the same moment → both get position N → the order falls back to `created_at`.
- **Fix:** take the same ordered `for update` lock that `admin_reorder_store_features` uses before computing max, and compute the end position on the server when `p_position` is null. **Can wait.** There is effectively one admin in F1.

## Declined to judge

- The products policy widening when F2 adds owner/admin SELECT on stores. The ledger has already deferred it to F2 as an explicit decision.
- The "paid" precedence of features. The ledger marks it as provisional.
- The F2/F3 cart and quantity semantics, beyond what F1 displays.

## Deferred-minor triage (from progress.md and task-10-rereview-1.md)

### Must fix before merge
- **None of the deferred minors blocks the merge on its own.** The merge blockers are the new I1 and I2 above.
- **Verify before merge (cheap, not a fix):** T6 "ProductCard price may overflow at 375px" was never verified. Take one screenshot at 375 px of a long price (for example 1 250 000 Kz) on Explorar. If it overflows, it becomes a must-fix, because the price is the main information on the card.

### Can wait (record in the F2 backlog)
- **T4:** the mutation cache is not cleared on user change. F1 has no user-scoped mutations outside admin, and the admin queries are already keyed by user and removed under `['me']`. This becomes needed in F2/F3.
- **T4:** the useProducts key and getNextPageParam are not tested directly. Non-array data → []. `Number('')` rating. The extra empty page (= M3).
- **T4:** ProfilePage pending without a session. The route is guarded.
- **T6:** duplicate alt, emoji initials, untested toast duration and rotation, redundant `cn`, unused variant, skeleton retry reset.
- **T7:** the empty state with no filter has no "Limpar" (accepted), the section skeleton shape, the silent categories error (accepted).
- **T8:** a chip clicked inside the debounce window (harmless).
- **T9:** qty not clamped to stock (no cart in F1, so this must be done in the cart phase), alt index, BottomNav swap jump, duplicate logo alt, unknown `categoria`, back-fallback push, qty live-region context.
- **T10 M2 / rereview m5:** the refocus race after a NOT_FOUND reorder.
- **Rereview m1:** the switch is refocused after a failed toggle.
- **Rereview m2:** no timer for `now` (= M1). Fix the misleading comment when you are next in the file.
- **Rereview m3:** module-global `liveUserId` (only matters in tests).
- **Rereview m4:** import blank lines and order (cosmetic).
- **Rereview m6:** focus was not re-checked in a browser. The admin e2e passes and covers the flow, so this is acceptable.
- **T11:** a failing reorder RPC first surfaces as a 20 s `toPass` timeout. This only affects how fast an e2e failure is diagnosed, not whether it is correct.
- **T2:** search_key is a public RPC, list_stores doubles search_key, IMMUTABLE over unaccent. All accepted. Record the risk if an index is ever built on it.
- **T1:** the service_role default ACL. Accepted, and it matches F0.
