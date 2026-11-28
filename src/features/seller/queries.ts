// Chaves e hooks do vendedor. Todas as mutações invalidam as chaves do vendedor e `['catalog']`
// (o catálogo público muda quando a loja ou um produto muda). Ao trocar de conta, o
// `Providers` limpa a cache inteira.
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { catalogKeys } from '@/features/catalog/queries';
import {
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
import type { Cursor, ProductFilter } from './types';

export const sellerKeys = {
  all: ['seller'] as const,
  store: () => ['seller', 'store'] as const,
  decisions: () => ['seller', 'decisions'] as const,
  productsAll: () => ['seller', 'products'] as const,
  products: (filter: ProductFilter) => ['seller', 'products', filter] as const,
  product: (id: string) => ['seller', 'product', id] as const,
};

export function useMyStore() {
  return useQuery({ queryKey: sellerKeys.store(), queryFn: getMyStore });
}

export function useMyStoreDecisions() {
  return useQuery({ queryKey: sellerKeys.decisions(), queryFn: getMyStoreDecisions });
}

export function useMyProducts(filter: ProductFilter) {
  return useInfiniteQuery({
    queryKey: sellerKeys.products(filter),
    queryFn: ({ pageParam }) => listMyProducts(filter, pageParam),
    initialPageParam: undefined as Cursor | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
  });
}

export function useMyProduct(id: string) {
  return useQuery({ queryKey: sellerKeys.product(id), queryFn: () => getMyProduct(id) });
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

export const useSaveMyStore = () => useSellerMutation(saveMyStore);
export const useSubmitMyStore = () => useSellerMutation(submitMyStore);
export const useCreateProduct = () => useSellerMutation(createProduct);
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
export const useRemoveProductImage = () => useSellerMutation(removeProductImage);
export const useSetProductImageOrder = () =>
  useSellerMutation((v: { productId: string; imageIds: string[] }) =>
    setProductImageOrder(v.productId, v.imageIds),
  );
