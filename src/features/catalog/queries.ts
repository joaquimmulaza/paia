import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getProduct,
  getStore,
  listCategories,
  listFeaturedStores,
  listStores,
  searchProducts,
} from './api';
import type { ProductCursor, ProductSort } from './types';

export interface ProductFilters {
  q?: string;
  categorySlug?: string;
  storeSlug?: string;
  sort: ProductSort;
  /** Tamanho de cada página; sem ele, o da api (24). */
  limit?: number;
}

export const catalogKeys = {
  all: ['catalog'] as const,
  categories: () => ['catalog', 'categories'] as const,
  products: (f: ProductFilters) =>
    [
      'catalog',
      'products',
      f.q ?? '',
      f.categorySlug ?? '',
      f.storeSlug ?? '',
      f.sort,
      f.limit ?? null,
    ] as const,
  product: (id: string) => ['catalog', 'product', id] as const,
  stores: (p: { q?: string; categorySlug?: string }) =>
    ['catalog', 'stores', p.q ?? '', p.categorySlug ?? ''] as const,
  store: (slug: string) => ['catalog', 'store', slug] as const,
  featured: () => ['catalog', 'featured'] as const,
};

export function useCategories() {
  return useQuery({ queryKey: catalogKeys.categories(), queryFn: listCategories });
}

export function useProducts(filters: ProductFilters) {
  return useInfiniteQuery({
    queryKey: catalogKeys.products(filters),
    queryFn: ({ pageParam }) => searchProducts({ ...filters, after: pageParam }),
    initialPageParam: undefined as ProductCursor | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
  });
}

export function useProduct(id: string) {
  return useQuery({ queryKey: catalogKeys.product(id), queryFn: () => getProduct(id) });
}

export function useStores(p: { q?: string; categorySlug?: string }) {
  return useQuery({ queryKey: catalogKeys.stores(p), queryFn: () => listStores(p) });
}

export function useStore(slug: string) {
  return useQuery({ queryKey: catalogKeys.store(slug), queryFn: () => getStore(slug) });
}

export function useFeaturedStores() {
  return useQuery({ queryKey: catalogKeys.featured(), queryFn: listFeaturedStores });
}
