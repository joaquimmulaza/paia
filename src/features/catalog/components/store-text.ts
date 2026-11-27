import type { StoreSummary } from '../types';

const CONNECTORS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/** Iniciais da loja, sem os conectores: «Doces da Ana» → «DA». */
export function storeInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w && !CONNECTORS.has(w.toLowerCase()));
  const first = words.at(0) ?? '';
  const last = words.length > 1 ? (words.at(-1) ?? '') : '';
  // Array.from separa por pontos de código: não parte pares substitutos nem emoji.
  const initial = (word: string) => Array.from(word)[0] ?? '';
  return (initial(first) + initial(last)).toLocaleUpperCase('pt-AO');
}

const ratingFormat = new Intl.NumberFormat('pt-AO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Meta da loja: «Doces · 12 produtos», mais « · 4,8» com avaliações.
 * Com `noRatingText`, acrescenta esse texto quando ainda não há avaliações.
 */
export function storeMeta(store: StoreSummary, noRatingText?: string): string {
  const parts: string[] = [];
  if (store.categoryName) parts.push(store.categoryName);
  parts.push(`${store.productCount} ${store.productCount === 1 ? 'produto' : 'produtos'}`);
  if (store.rating && store.rating.count > 0) parts.push(ratingFormat.format(store.rating.avg));
  else if (noRatingText) parts.push(noRatingText);
  return parts.join(' · ');
}
