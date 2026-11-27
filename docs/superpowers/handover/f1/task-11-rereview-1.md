# Task 11 re-review 1 (b1f77f3..b0ca825)

- I (racy reorder loop): ADDRESSED. Non-retrying aria-disabled read removed; toPass retries click + auto-retrying row assertion. RPC statuses captured via request/response listeners, asserted <300 and balanced with requests. Residual (minor, not blocking): an RPC failure surfaces first as a 20 s toPass timeout, the status assertion only runs after; the failing-RPC path was not exercised.
- M (state mutated / not exact seed): ADDRESSED. beforeAll snapshots store_features (json_agg), asserts seed precondition, afterAll restores exact rows (delete + json_populate_recordset in one begin/commit).
- M (parallel workers): ADDRESSED. workers: 1 in playwright.config.ts; README and catalog.spec comment updated.
- M (Prettier nit): ADDRESSED. catalog.spec.ts chain rewritten; report states format:check passes.

Restore SQL safety: localSql uses execFileSync (no shell) with psql -c, so no shell injection. JSON comes from the local DB's own rows; embedded in a single-quoted literal with ' doubled (standard_conforming_strings on by default, so backslashes are inert). Values are not interpolated as SQL fragments, only as one literal parsed by json_populate_recordset. Not a parameterized query, but no injection path from row data. Transactional, so a failed insert rolls back the delete.

New Critical/Important breakage: none.
