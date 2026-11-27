# F1 final security review (c1de97a..b0ca825)

Skill: `security-review`, applied to the range. Report only; nothing was fixed.

## Result

No findings with confidence of 8/10 or more. Critical: 0. Important (High/Medium): 0. Low: 0.

## What was checked

- **RLS** (`supabase/migrations/20261126000000_f1_catalogo.sql:348-370`): the products and product_images policies use inline `exists` subqueries, and those subqueries are themselves filtered by RLS on stores and products. So a store that is not approved hides its products and images.
- **Column grants** (`:377-384`): anon cannot read owner_id, status, is_published or the moderation columns.
- **Read-only checks on the local database**, as anon:
  - `search_products` returned 14 rows and `products` 14 rows, which equals the eligible count computed as postgres. The seed has 1 store that is not approved and 2 hidden products.
  - `store_features`: permission denied.
  - `admin_list_store_features`: permission denied.
  - `list_featured_stores` returned only the public columns, with no note, created_by or updated_by.
- **Admin RPC as an authenticated user who is not an admin**: raises NOT_ALLOWED.
- **`search_products` (`:431-503`)**: `EXECUTE` builds its SQL text only from constant fragments chosen by the `p_sort` branch. Client values are bound only through `USING $1..$9`, so there is no SQL injection. Cursor validation is consistent.
- **SECURITY DEFINER functions**:
  - `list_featured_stores` and all `admin_*` functions use `search_path = ''` and fully qualified names.
  - Each `admin_*` function checks `private.is_admin()` first, acts only on rows with `source = 'admin'`, and has EXECUTE revoked from public and anon.
  - The private helpers have EXECUTE revoked.
- **Client**:
  - No `dangerouslySetInnerHTML`.
  - Image `src` values come from storage `getPublicUrl`.
  - `?voltar=` goes through the existing `safeRedirect`, which is unchanged in this range.
  - Admin gating on the client is backed by the server-side `is_admin` checks.
- **e2e helper** (`e2e/support.ts:23`): uses `execFileSync('docker', [...])` with an argument array and no shell. It is test-only.
- **Secrets**:
  - None found in the diff.
  - The seed's auth.users rows get random bcrypt passwords (`crypt(gen_random_uuid()…)`).
  - The e2e passwords come from `randomUUID()`.
