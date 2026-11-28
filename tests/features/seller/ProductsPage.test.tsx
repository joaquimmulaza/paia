import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sellerApi = vi.hoisted(() => ({
  getMyStore: vi.fn(),
  listMyProducts: vi.fn(),
  countMyProducts: vi.fn(),
}));
vi.mock('@/features/seller/api', () => sellerApi);
vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-test' } }, loading: false }),
  currentUserId: () => 'user-test',
}));

import { ProductsPage } from '@/features/seller/ProductsPage';
import type { MyProduct, ProductFilter } from '@/features/seller/types';
import { MESSAGES } from '@/lib/errors';
import { renderRoutes } from '../../utils/renderRoutes';
import { makeStore } from './fixtures';

function mount(path = '/vender/produtos') {
  return renderRoutes(
    [
      { path: '/vender', element: <p>Quero vender</p> },
      { path: '/vender/estado', element: <p>Estado</p> },
      { path: '/vender/produtos', element: <ProductsPage /> },
    ],
    path,
  );
}

const approved = makeStore({ id: 's1', status: 'approved', kind: 'approved' });

function product(overrides: Partial<MyProduct> = {}): MyProduct {
  return {
    id: 'p1',
    name: 'Fatia de bolo de chocolate',
    priceKz: 1500,
    stock: 8,
    isPublished: true,
    moderationStatus: 'visible',
    moderationReason: null,
    categoryId: 'cat-doces',
    createdAt: '2026-11-28T10:00:00+00:00',
    mainImagePath: 'products/s1/p1/a.webp',
    ...overrides,
  };
}

function counts(c: Record<ProductFilter, number>) {
  sellerApi.countMyProducts.mockImplementation(async (_s: string, f: ProductFilter) => c[f]);
}

beforeEach(() => {
  vi.clearAllMocks();
  sellerApi.getMyStore.mockResolvedValue(approved);
});

describe('ProductsPage (V05, V05b)', () => {
  it('mostra os separadores com contagens e as linhas com o estado', async () => {
    counts({ all: 4, published: 3, sold_out: 1, hidden: 1 });
    sellerApi.listMyProducts.mockResolvedValue({
      items: [
        product(),
        product({ id: 'p2', name: 'Bolo de laranja (fatia)', stock: 0, priceKz: 1000 }),
        product({ id: 'p3', name: 'Bolo de aniversário', isPublished: false }),
        product({
          id: 'p4',
          name: 'Capa de telemóvel',
          moderationStatus: 'hidden',
          moderationReason: 'imagem com dados pessoais',
        }),
      ],
      next: null,
    });
    mount();
    expect(await screen.findByRole('button', { name: 'Todos · 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Publicados · 3' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Esgotados · 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ocultos · 1' })).toBeVisible();
    expect(sellerApi.listMyProducts).toHaveBeenCalledWith('s1', 'all', undefined);

    const first = await screen.findByRole('link', { name: /Fatia de bolo de chocolate/ });
    expect(first).toHaveAttribute('href', '/vender/produtos/p1');
    expect(first).toHaveTextContent('1 500 Kz · 8 em stock');
    expect(within(first).getByText('Publicado')).toBeVisible();
    expect(
      within(screen.getByRole('link', { name: /Bolo de laranja/ })).getByText('Esgotado'),
    ).toBeVisible();
    expect(
      within(screen.getByRole('link', { name: /Bolo de aniversário/ })).getByText('Oculto'),
    ).toBeVisible();
    const moderated = screen.getByRole('link', { name: /Capa de telemóvel/ });
    expect(within(moderated).getByText('Ocultado')).toBeVisible();
    expect(moderated).toHaveTextContent('Ocultado pela equipa: imagem com dados pessoais');
    expect(
      screen.getByText(
        'Oculto: só tu vês. Esgotado: aparece na loja, mas ninguém o pode pedir até repores o stock.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Novo' })).toHaveAttribute(
      'href',
      '/vender/produtos/novo',
    );
  });

  it('no filtro «Esgotados», sem resultados, mostra «Não tens produtos esgotados.»', async () => {
    const user = userEvent.setup({ delay: null });
    counts({ all: 6, published: 6, sold_out: 0, hidden: 0 });
    sellerApi.listMyProducts.mockImplementation(async (_s: string, f: ProductFilter) => ({
      items: f === 'sold_out' ? [] : [product()],
      next: null,
    }));
    const { router } = mount();
    await user.click(await screen.findByRole('button', { name: 'Esgotados · 0' }));
    expect(await screen.findByText('Não tens produtos esgotados.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Esgotados · 0' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(router.state.location.search).toBe('?filtro=esgotados');
    expect(sellerApi.listMyProducts).toHaveBeenCalledWith('s1', 'sold_out', undefined);
  });

  it('abre no filtro do endereço', async () => {
    counts({ all: 1, published: 0, sold_out: 0, hidden: 1 });
    sellerApi.listMyProducts.mockResolvedValue({ items: [], next: null });
    mount('/vender/produtos?filtro=ocultos');
    expect(await screen.findByRole('button', { name: 'Ocultos · 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(sellerApi.listMyProducts).toHaveBeenCalledWith('s1', 'hidden', undefined);
  });

  it('sem produtos nenhuns mostra o estado vazio com «Publicar produto»', async () => {
    counts({ all: 0, published: 0, sold_out: 0, hidden: 0 });
    sellerApi.listMyProducts.mockResolvedValue({ items: [], next: null });
    mount();
    expect(await screen.findByRole('heading', { name: 'Ainda não tens produtos' })).toBeVisible();
    expect(
      screen.getByText('Junta fotos, preço e stock. Ficam logo visíveis na tua loja.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Publicar produto' })).toHaveAttribute(
      'href',
      '/vender/produtos/novo',
    );
    expect(screen.queryByRole('group', { name: 'Filtrar produtos' })).not.toBeInTheDocument();
  });

  it('a carregar, anuncia «A carregar os produtos…»', async () => {
    counts({ all: 1, published: 1, sold_out: 0, hidden: 0 });
    sellerApi.listMyProducts.mockReturnValue(new Promise(() => {}));
    mount();
    expect(await screen.findByText('A carregar os produtos…')).toBeInTheDocument();
  });

  it('um erro mostra a mensagem do V05b e «Tentar outra vez» volta a pedir', async () => {
    const user = userEvent.setup({ delay: null });
    counts({ all: 1, published: 1, sold_out: 0, hidden: 0 });
    sellerApi.listMyProducts.mockRejectedValueOnce(new Error(MESSAGES.generic));
    sellerApi.listMyProducts.mockResolvedValue({ items: [product()], next: null });
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os produtos. Verifica a ligação e tenta outra vez.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByRole('link', { name: /Fatia de bolo/ })).toBeVisible();
  });

  it('«Carregar mais» pede a página seguinte e leva o foco ao primeiro novo', async () => {
    const user = userEvent.setup({ delay: null });
    counts({ all: 21, published: 21, sold_out: 0, hidden: 0 });
    const cursor = { createdAt: 'c', id: 'p1' };
    sellerApi.listMyProducts.mockImplementation(async (_s, _f, c) =>
      c
        ? { items: [product({ id: 'p2', name: 'Pudim (fatia)' })], next: null }
        : { items: [product()], next: cursor },
    );
    mount();
    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }));
    const added = await screen.findByRole('link', { name: /Pudim/ });
    await vi.waitFor(() => expect(added).toHaveFocus());
    expect(sellerApi.listMyProducts).toHaveBeenLastCalledWith('s1', 'all', cursor);
  });

  it('uma loja suspensa segue para /vender/estado', async () => {
    sellerApi.getMyStore.mockResolvedValue(makeStore({ kind: 'suspended', status: 'suspended' }));
    const { router } = mount();
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/vender/estado'));
  });
});
