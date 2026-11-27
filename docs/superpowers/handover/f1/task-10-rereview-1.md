# T10 re-review 1 (fix round aa889bb..ccc0602)

Scope: the findings from task-10-review.md and task-10-security.md, plus the fix diff only. I did not re-run the suite. The report's `npm run verify` evidence shows PASS: 41 files, 464 tests.

## Verdicts

| Finding | Verdict | Evidence |
|---|---|---|
| I1: focus lost when toggling «Ativo» | ADDRESSED | `FeaturesPage.tsx`: one `<tbody>` renders `[...active, ...inactive]` keyed by `f.id`. A row that changes list is now a keyed sibling reorder in the same parent, not a remount. `Switch` registers `controlRef(`${f.id}:switch`)`. After `await invalidateFeatures`, `toggle.onSettled` calls `onToggled()`, which runs `requestFocus` (a one-shot `focusOnce` ref plus `focusTick`). The layout effect then focuses the switch and clears the ref. `focusOnce` takes priority over `focusAfterMove`. Two new jsdom tests cover off→end and on→back into order. |
| I2: wrong default to «Loja não aprovada» / stale `isLive` | ADDRESSED | `status.ts` no longer reads `isLive`. The order is: off → scheduled (`startsAt > now`) → expired (`endsAt <= now`) → `storeStatus !== 'approved'` → live. This is the same conjunction as `private.feature_is_shown` (migration line 690–693, period [start, end)). `storeStatus` exists on `AdminFeature` (`types.ts:39`, mapped in `api.ts:41`). Tests cover a stale `isLive` in both directions, the start boundary, and the «store» case. |
| Review M1: inert arrows on inactive rows | ADDRESSED | The arrows render only when `order !== null`. The «— / Sem ordem» marker stays. |
| Review M3: duplicate aria-label inside fieldset/legend | ADDRESSED | `aria-label` is removed from both `RadioGroup`s («Origem» and the store results). The legends stay. |
| Review M4: an unparseable date is ignored silently | ADDRESSED | `validateFeature` now takes the raw `start`/`end` strings. A non-empty value that `toLuandaIso` returns null for sets «Indica uma data e hora válidas.» on that field. `start` has its own error `<p>`, `aria-invalid` and `aria-describedby`, and focus order is store → start → end → note. The period check runs only when both dates parse. |
| Security M1: admin key without userId | ADDRESSED | `adminKeys.features(userId)` returns `['me','admin','features',userId]`, using `useAuth().session?.user.id`. `invalidateFeatures` uses the prefix `featuresAll`. The reorder `cancelQueries`/`setQueryData` calls use the same `featuresKey`. Nothing else calls `adminKeys.features` (grep). The key is still under `['me']`, so `removeQueries(['me'])` on a user change still clears it. |
| Security M2: toast to the next user | ADDRESSED | Both mutations capture `currentUserId()` in `onMutate` and toast only if it still matches in `onSuccess`. **`currentUserId()` check (`AuthProvider.tsx`):** <br>- `liveUserId` is set inside `track()`, on every `onAuthStateChange` event and on the initial `getSession`, before `setState` and right after `onUserChange`. So it is never older than the React state. <br>- It goes to null on unmount, and on sign-out through `track(null)`. <br>- Under StrictMode, the effect cleans up and runs again (null, then the next event or `getSession` sets it), which is fine. <br>- The existing `track`/`onUserChange` logic is unchanged and the value is read-only to callers, so I see no auth regression. <br>- A unit test covers u1 → u2 → null → u3 → unmount null. |

## New Critical/Important breakage in the fix diff

None.

## Minor / out of scope

- m1. `onToggled` focuses the switch after the refetch, even when the toggle failed or the user has moved focus elsewhere in the meantime. This is the same "focus pulled back" trade-off as for the arrows. It is low impact, and on error the switch is the sensible place for focus anyway.
- m2. `now` is `new Date()` on each render, with no timer. The status is now correct on any re-render (refetch, focus), but a page left idle across a boundary keeps the old label until something re-renders. This is acceptable for an admin screen.
- m3. `liveUserId` is module-global. Two `AuthProvider` instances at once (only in tests) would share it. Not a concern for the app.
- m4. Cosmetic: there are stray blank lines between import groups in `AddFeatureForm.tsx` and `FeaturesPage.tsx`, and `currentUserId` is imported out of alphabetical order. Prettier and lint pass.
- m5. Review M2 (reorder NOT_FOUND focus) was not in the list to fix and is unchanged. Still minor.
- m6. The focus behaviour was not checked again in a browser in this round. Only the jsdom tests cover it (the report says so).
