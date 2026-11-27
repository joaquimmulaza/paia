import type { ProductSort } from './types';

export interface ExploreParams {
  q: string;
  categoria: string | null;
  ordem: ProductSort;
}

const SORTS: readonly ProductSort[] = ['recentes', 'preco-asc', 'preco-desc'];
export const MAX_QUERY_LENGTH = 80;

export function parseExploreParams(sp: URLSearchParams): ExploreParams {
  const q = (sp.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH);
  const categoria = sp.get('categoria')?.trim() || null;
  const ordem = SORTS.find((s) => s === sp.get('ordem')) ?? 'recentes';
  return { q, categoria, ordem };
}

/** Devolve `''` ou `?…`, sem os valores por omissão. */
export function toExploreSearch(v: ExploreParams): string {
  const sp = new URLSearchParams();
  if (v.q) sp.set('q', v.q);
  if (v.categoria) sp.set('categoria', v.categoria);
  if (v.ordem !== 'recentes') sp.set('ordem', v.ordem);
  const s = sp.toString();
  return s ? `?${s}` : '';
}
