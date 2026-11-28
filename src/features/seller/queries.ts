// Chaves e hooks do vendedor. Todas as mutações invalidam as chaves do vendedor e `['catalog']`
// (o catálogo público muda quando a loja ou um produto muda). Ao trocar de conta, o
// `Providers` limpa a cache inteira.
import {
  useInfiniteQuery,
  useQueries,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { catalogKeys } from '@/features/catalog/queries';
import {
  countMyProducts,
  createProduct,
  deleteProduct,
  getMyProduct,
  getMyStore,
  getMyStoreDecisions,
  listMyProducts,
  removeProductImage,
  saveMyStore,
  setProductImageOrder,
  submitMyStore,
  updateProduct,
  uploadProductImage,
  uploadStoreImage,
} from './api';
import { FILTERS } from './product-filters';
import type { Cursor, ProductFilter, ProductImage, ProductInput, SaveStoreInput } from './types';

export const sellerKeys = {
  all: ['seller'] as const,
  store: () => ['seller', 'store'] as const,
  decisions: () => ['seller', 'decisions'] as const,
  productsAll: () => ['seller', 'products'] as const,
  products: (storeId: string, filter: ProductFilter) =>
    ['seller', 'products', storeId, filter] as const,
  count: (storeId: string, filter: ProductFilter) =>
    ['seller', 'products', storeId, filter, 'count'] as const,
  product: (storeId: string, id: string) => ['seller', 'product', storeId, id] as const,
};

export function useMyStore() {
  return useQuery({ queryKey: sellerKeys.store(), queryFn: getMyStore });
}

export function useMyStoreDecisions() {
  return useQuery({ queryKey: sellerKeys.decisions(), queryFn: getMyStoreDecisions });
}

export function useMyProducts(storeId: string, filter: ProductFilter) {
  return useInfiniteQuery({
    queryKey: sellerKeys.products(storeId, filter),
    queryFn: ({ pageParam }) => listMyProducts(storeId, filter, pageParam),
    initialPageParam: undefined as Cursor | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
  });
}

/** As contagens dos separadores do V05; `data` só existe quando as quatro chegaram. */
export function useMyProductCounts(storeId: string) {
  return useQueries({
    queries: FILTERS.map((filter) => ({
      queryKey: sellerKeys.count(storeId, filter),
      queryFn: () => countMyProducts(storeId, filter),
    })),
    combine: (results) => {
      if (!results.every((r) => r.isSuccess)) return { data: undefined };
      const data = {} as Record<ProductFilter, number>;
      FILTERS.forEach((f, i) => {
        data[f] = results[i]?.data ?? 0;
      });
      return { data };
    },
  });
}

/** Sem a loja ou o id, não pede nada. */
export function useMyProduct(storeId: string, id: string) {
  return useQuery({
    queryKey: sellerKeys.product(storeId, id),
    queryFn: () => getMyProduct(storeId, id),
    enabled: storeId !== '' && id !== '',
  });
}

function invalidateSeller(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: sellerKeys.all }),
    queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  ]);
}

/** Uma mutação que, ao acabar (bem ou mal), refresca o vendedor e o catálogo. */
function useSellerMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => invalidateSeller(queryClient),
  });
}

// Sempre por uma seta: o TanStack passa um segundo argumento (o contexto) que a api não espera.
export const useSaveMyStore = () => useSellerMutation((v: SaveStoreInput) => saveMyStore(v));
export const useSubmitMyStore = () => useSellerMutation(() => submitMyStore());
export const useCreateProduct = () => useSellerMutation((v: ProductInput) => createProduct(v));
export const useUpdateProduct = () =>
  useSellerMutation((v: { id: string; input: Parameters<typeof updateProduct>[1] }) =>
    updateProduct(v.id, v.input),
  );
export const useDeleteProduct = () =>
  useSellerMutation((v: { id: string; imagePaths: string[] }) => deleteProduct(v.id, v.imagePaths));
export const useUploadStoreImage = () =>
  useSellerMutation((v: { storeId: string; kind: 'logo' | 'cover'; blob: Blob }) =>
    uploadStoreImage(v.storeId, v.kind, v.blob),
  );
export const useUploadProductImage = () =>
  useSellerMutation((v: { storeId: string; productId: string; blob: Blob; position: number }) =>
    uploadProductImage(v.storeId, v.productId, v.blob, v.position),
  );
export const useRemoveProductImage = () =>
  useSellerMutation((image: ProductImage) => removeProductImage(image));
export const useSetProductImageOrder = () =>
  useSellerMutation((v: { productId: string; imageIds: string[] }) =>
    setProductImageOrder(v.productId, v.imageIds),
  );
