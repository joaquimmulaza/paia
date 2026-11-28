import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sellerApi = vi.hoisted(() => ({
  getMyProduct: vi.fn(),
  countMyProducts: vi.fn(),
}));
vi.mock('@/features/seller/api', () => sellerApi);

import { useMyProduct, useMyProductCounts } from '@/features/seller/queries';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe('useMyProduct', () => {
  it('com o id vazio, não pede nada', async () => {
    const { result } = renderHook(() => useMyProduct('s1', ''), { wrapper });
    await new Promise((r) => setTimeout(r, 10));
    expect(sellerApi.getMyProduct).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('com a loja e o id, pede o produto dessa loja', async () => {
    sellerApi.getMyProduct.mockResolvedValue(null);
    renderHook(() => useMyProduct('s1', 'p1'), { wrapper });
    await waitFor(() => expect(sellerApi.getMyProduct).toHaveBeenCalledWith('s1', 'p1'));
  });
});

describe('useMyProductCounts', () => {
  it('conta os quatro separadores da loja', async () => {
    sellerApi.countMyProducts.mockImplementation(
      async (_s: string, f: string) => ({ all: 6, published: 6, sold_out: 0, hidden: 0 })[f],
    );
    const { result } = renderHook(() => useMyProductCounts('s1'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ all: 6, published: 6, sold_out: 0, hidden: 0 });
    expect(sellerApi.countMyProducts).toHaveBeenCalledTimes(4);
  });
});
