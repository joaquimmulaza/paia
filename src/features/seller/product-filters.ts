// Os separadores do V05 e o estado de cada produto (p-tag), partilhados com o painel V04b.
import type { MyProduct, ProductFilter } from './types';

/** O valor de `?filtro=` no endereço. */
export const FILTER_PARAM: Record<ProductFilter, string> = {
  all: 'todos',
  published: 'publicados',
  sold_out: 'esgotados',
  hidden: 'ocultos',
};

export const FILTERS: readonly ProductFilter[] = ['all', 'published', 'sold_out', 'hidden'];

export function filterFromParam(value: string | null): ProductFilter {
  return FILTERS.find((f) => FILTER_PARAM[f] === value) ?? 'all';
}

export const FILTER_LABEL: Record<ProductFilter, string> = {
  all: 'Todos',
  published: 'Publicados',
  sold_out: 'Esgotados',
  hidden: 'Ocultos',
};

/** O separador escolhido, sem resultados. */
export const FILTER_EMPTY: Record<Exclude<ProductFilter, 'all'>, string> = {
  published: 'Não tens produtos publicados.',
  sold_out: 'Não tens produtos esgotados.',
  hidden: 'Não tens produtos ocultos.',
};

export type ProductState = 'moderated' | 'hidden' | 'sold_out' | 'published';

/** A ocultação pela administração sobrepõe-se a tudo; depois, oculto pelo dono; depois, stock 0. */
export function productState(
  p: Pick<MyProduct, 'isPublished' | 'stock' | 'moderationStatus'>,
): ProductState {
  if (p.moderationStatus === 'hidden') return 'moderated';
  if (!p.isPublished) return 'hidden';
  if (p.stock === 0) return 'sold_out';
  return 'published';
}
