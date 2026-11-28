// Gestão de destaques (A07). As funções da base verificam `is_admin` primeiro:
// a segurança está lá, não aqui. Qualquer falha vira `Error` com texto PT-AO.
import { MESSAGES, translateDbError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { AdminFeature, AdminFeatureRow, SaveFeatureArgs, SaveFeatureInput } from './types';

/** Outro administrador mudou os destaques entre a leitura e a ordenação. */
export const FEATURES_CHANGED = 'A lista mudou. Atualizámos a ordem; tenta outra vez.';

interface Reply {
  data: unknown;
  error: { message: string } | null;
}

// Os nomes das funções e os argumentos são tipados aqui (types.ts), não pelos tipos gerados.
type Rpc = (fn: string, ...args: [object?]) => PromiseLike<Reply>;
// Chamado como método, para o `rpc` do cliente manter o `this`.
const rpc: Rpc = (fn, ...args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, ...args);

/** Chama uma função da base. A falha de rede dá MESSAGES.generic; um código, `translate(código)`. */
export async function call(
  fn: string,
  args?: object,
  translate: (code: string) => string = translateDbError,
): Promise<unknown> {
  let result: Reply;
  try {
    result = await (args === undefined ? rpc(fn) : rpc(fn, args));
  } catch {
    throw new Error(MESSAGES.generic);
  }
  if (result.error) throw new Error(translate(result.error.message));
  return result.data;
}

function toFeature(r: AdminFeatureRow): AdminFeature {
  return {
    id: r.id,
    storeId: r.store_id,
    storeName: r.store_name,
    storeSlug: r.store_slug,
    storeStatus: r.store_status,
    source: r.source,
    position: r.position,
    startsAt: r.starts_at ?? null,
    endsAt: r.ends_at ?? null,
    isActive: r.is_active,
    note: r.note ?? null,
    isLive: r.is_live,
  };
}

export async function listFeatures(): Promise<AdminFeature[]> {
  const data = await call('admin_list_store_features');
  return Array.isArray(data) ? (data as AdminFeatureRow[]).map(toFeature) : [];
}

/** Cria (sem `id`) ou altera um destaque. Devolve o id. */
export async function saveFeature(v: SaveFeatureInput): Promise<string> {
  const args: SaveFeatureArgs = {
    p_id: v.id ?? null,
    p_store_id: v.storeId,
    p_position: v.position,
    p_starts_at: v.startsAt,
    p_ends_at: v.endsAt,
    p_note: v.note,
  };
  return String(await call('admin_save_store_feature', args));
}

export async function setFeatureActive(id: string, active: boolean): Promise<void> {
  await call('admin_set_store_feature_active', { p_id: id, p_active: active });
}

export async function removeFeature(id: string): Promise<void> {
  await call('admin_remove_store_feature', { p_id: id });
}

/**
 * `ids` tem de ser exatamente o conjunto dos destaques ativos (em qualquer período).
 * Se não for, a base recusa com NOT_FOUND e nada muda: a lista estava desatualizada.
 */
export async function reorderFeatures(ids: string[]): Promise<void> {
  await call('admin_reorder_store_features', { p_ids: ids }, (code) =>
    code === 'NOT_FOUND' ? FEATURES_CHANGED : translateDbError(code),
  );
}
