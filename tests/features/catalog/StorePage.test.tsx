import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/sonner';
import type { CatalogProduct, ProductCursor, StoreDetail } from '@/features/catalog/types';
import { renderRoutes } from '../../utils/renderRoutes';

const api = vi.hoisted(() => ({
  listCategories: vi.fn(),
  searchProducts: vi.fn(),
  getProduct: vi.fn(),
  listStores: vi.fn(),
  getStore: vi.fn(),
  listFeaturedStores: vi.fn(),
}));
vi.mock('@/features/catalog/api', () => api);

import { StorePage } from '@/features/catalog/StorePage';

function storeDetail(overrides: Partial<StoreDetail> = {}): StoreDetail {
  return {
    id: 'id-doces-da-ana',
    name: 'Doces da Ana',
    slug: 'doces-da-ana',
    description: 'Bolos por fatia.\nTudo feito no próprio dia.',
    categoryName: 'Doces',
    categorySlug: 'doces',
    logoPath: null,
    productCount: 12,
    rating: null,
    productCategories: [
      { name: 'Bolos', slug: 'bolos' },
      { name: 'Bebidas', slug: 'bebidas' },
    ],
    ...overrides,
  };
}

function product(i: number): CatalogProduct {
  return {
    id: `00000000-0000-0000-0000-0000000000${String(i).padStart(2, '0')}`,
    name: `Produto ${i}`,
    priceKz: 500 * i,
    stock: 10,
    createdAt: '2020-01-01T00:00:00.000000+00:00',
    storeName: 'Doces da Ana',
    storeSlug: 'doces-da-ana',
    categorySlug: 'bolos',
    mainImagePath: null,
  };
}

const FOUR = [1, 2, 3, 4].map(product);
const CURSOR: ProductCursor = { createdAt: FOUR[1]!.createdAt, priceKz: 1000, id: FOUR[1]!.id };

function renderStore(entries: string[] = ['/loja/doces-da-ana']) {
  return renderRoutes(
    [
      {
        path: '/loja/:slug',
        element: (
          <>
            <StorePage />
            <Toaster />
          </>
        ),
      },
      { path: '/explorar', element: <p>Página Explorar</p> },
      { path: '/lojas', element: <p>Página Lojas</p> },
    ],
    entries,
  );
}

async function ready() {
  return screen.findByRole('heading', { level: 1, name: 'Doces da Ana' });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getStore.mockResolvedValue(storeDetail());
  api.searchProducts.mockResolvedValue({ items: FOUR, next: null });
  window.history.replaceState(null, '');
});

afterEach(() => {
  window.history.replaceState(null, '');
});

describe('StorePage (C04), conteúdo', () => {
  it('o h1 é o nome da loja, com «Loja aprovada», e o título do separador é «<nome> · PAIÁ»', async () => {
    renderStore();
    const h1 = await ready();
    expect(api.getStore).toHaveBeenCalledWith('doces-da-ana');
    expect(document.title).toBe('Doces da Ana · PAIÁ');
    const card = h1.closest('section')!;
    expect(within(card).getByText('Loja aprovada')).toBeInTheDocument();
  });

  it('mostra a descrição com as quebras de linha e «12 produtos»', async () => {
    renderStore();
    await ready();
    const text = screen.getByText(/Bolos por fatia\./);
    expect(text.textContent).toBe('Bolos por fatia.\nTudo feito no próprio dia.');
    expect(text).toHaveClass('whitespace-pre-line');
    expect(screen.getByText('12 produtos')).toBeInTheDocument();
  });

  it('com 1 produto, usa o singular', async () => {
    api.getStore.mockResolvedValue(storeDetail({ productCount: 1 }));
    renderStore();
    await ready();
    expect(screen.getByText('1 produto')).toBeInTheDocument();
  });

  it('sem avaliações, não mostra a avaliação nem a secção «Avaliações»', async () => {
    renderStore();
    await ready();
    expect(screen.queryByText(/avalia/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Avaliações' })).not.toBeInTheDocument();
  });

  it('com avaliações, mostra «4,8 · 23 avaliações»', async () => {
    api.getStore.mockResolvedValue(storeDetail({ rating: { avg: 4.8, count: 23 } }));
    renderStore();
    await ready();
    expect(screen.getByTestId('store-rating')).toHaveTextContent('4,8 · 23 avaliações');
  });

  it('sem logótipo, mostra as iniciais', async () => {
    renderStore();
    await ready();
    expect(screen.getByText('DA')).toBeInTheDocument();
  });

  it('com logótipo, mostra a imagem da loja', async () => {
    api.getStore.mockResolvedValue(storeDetail({ logoPath: 's/logo.png' }));
    renderStore();
    await ready();
    const img = document.querySelector('img')!;
    // O h1 já diz o nome: o logótipo é decorativo.
    expect(img).toHaveAttribute('alt', '');
    expect(img.getAttribute('src')).toContain('store-media');
    expect(img.getAttribute('src')).toContain('s/logo.png');
  });

  it('a navegação inferior marca «Lojas»', async () => {
    renderStore();
    await ready();
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getByRole('link', { name: 'Lojas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('o cabeçalho tem «Voltar» e o carrinho; «Denunciar loja» mostra «Disponível em breve»', async () => {
    const user = userEvent.setup({ delay: null });
    renderStore();
    await ready();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Carrinho' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Denunciar loja' }));
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });
});

describe('StorePage (C04), produtos', () => {
  it('lista os produtos da loja sem o nome da loja nos cartões', async () => {
    renderStore();
    await ready();
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(4));
    expect(api.searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ storeSlug: 'doces-da-ana', sort: 'recentes' }),
    );
    const card = screen.getAllByRole('article')[0]!;
    expect(within(card).queryByText('Doces da Ana')).not.toBeInTheDocument();
  });

  it('os chips «Tudo», «Bolos» e «Bebidas» filtram e ficam no URL', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = renderStore();
    await ready();
    const chips = screen.getByRole('group', { name: 'Filtrar produtos da loja' });
    expect(
      within(chips)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Tudo', 'Bolos', 'Bebidas']);
    expect(within(chips).getByRole('button', { name: 'Tudo' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(chips).getByRole('button', { name: 'Bolos' }));
    expect(router.state.location.search).toBe('?categoria=bolos');
    expect(router.state.historyAction).toBe('PUSH');
    await waitFor(() =>
      expect(api.searchProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ storeSlug: 'doces-da-ana', categorySlug: 'bolos' }),
      ),
    );
    expect(within(chips).getByRole('button', { name: 'Bolos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(chips).getByRole('button', { name: 'Tudo' }));
    expect(router.state.location.search).toBe('');
  });

  it('abrir com ?categoria=bebidas filtra logo', async () => {
    renderStore(['/loja/doces-da-ana?categoria=bebidas']);
    await ready();
    await waitFor(() =>
      expect(api.searchProducts).toHaveBeenCalledWith(
        expect.objectContaining({ storeSlug: 'doces-da-ana', categorySlug: 'bebidas' }),
      ),
    );
  });

  it('uma ?categoria= desconhecida vale «Tudo»: sem filtro e o chip «Tudo» ativo', async () => {
    renderStore(['/loja/doces-da-ana?categoria=nao-existe']);
    await ready();
    const chips = screen.getByRole('group', { name: 'Filtrar produtos da loja' });
    expect(within(chips).getByRole('button', { name: 'Tudo' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => expect(api.searchProducts).toHaveBeenCalled());
    for (const [args] of api.searchProducts.mock.calls) {
      expect(args.categorySlug).toBeUndefined();
    }
  });

  it('«Ver mais produtos» junta a página seguinte e leva o foco ao primeiro novo', async () => {
    const user = userEvent.setup({ delay: null });
    api.searchProducts.mockImplementation(async (p: { after?: ProductCursor }) =>
      p.after ? { items: FOUR.slice(2), next: null } : { items: FOUR.slice(0, 2), next: CURSOR },
    );
    renderStore();
    await ready();
    await user.click(await screen.findByRole('button', { name: 'Ver mais produtos' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(4));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Produto 3' })).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Ver mais produtos' })).not.toBeInTheDocument();
  });
});

describe('StorePage (C04), voltar e erros', () => {
  it('com histórico, «Voltar» volta à página anterior', async () => {
    const user = userEvent.setup({ delay: null });
    window.history.replaceState({ idx: 1 }, '');
    renderStore(['/lojas', '/loja/doces-da-ana']);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText('Página Lojas')).toBeInTheDocument();
  });

  it('sem histórico, «Voltar» vai para Explorar', async () => {
    const user = userEvent.setup({ delay: null });
    window.history.replaceState({ idx: 0 }, '');
    renderStore(['/lojas', '/loja/doces-da-ana']);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText('Página Explorar')).toBeInTheDocument();
  });

  it('uma loja que não existe mostra «Não encontrámos o que procuras.»', async () => {
    api.getStore.mockRejectedValue(new Error('Não encontrámos o que procuras.'));
    renderStore();
    expect(
      await screen.findByRole('heading', { name: 'Não encontrámos o que procuras.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar a explorar' })).toHaveAttribute(
      'href',
      '/explorar',
    );
    expect(document.title).toBe('Não encontrado · PAIÁ');
  });

  it('outro erro mostra a mensagem e «Tentar outra vez»', async () => {
    const user = userEvent.setup({ delay: null });
    api.getStore.mockRejectedValueOnce(new Error('Sem ligação. Tenta outra vez.'));
    renderStore();
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem ligação. Tenta outra vez.');
    await user.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    await ready();
  });
});
