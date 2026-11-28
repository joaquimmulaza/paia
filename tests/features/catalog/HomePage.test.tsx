import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/sonner';
import type { CatalogProduct, FeaturedStore, StoreSummary } from '@/features/catalog/types';
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

import { HomePage } from '@/features/catalog/HomePage';

function product(i: number, overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: `00000000-0000-0000-0000-00000000000${i}`,
    name: `Produto ${i}`,
    priceKz: 500 * i,
    stock: 10,
    createdAt: '2020-01-01T00:00:00.000000+00:00',
    storeName: 'Doces da Ana',
    storeSlug: 'doces-da-ana',
    categorySlug: 'doces',
    mainImagePath: null,
    ...overrides,
  };
}

function store(name: string, slug: string, overrides: Partial<StoreSummary> = {}): StoreSummary {
  return {
    id: `id-${slug}`,
    name,
    slug,
    description: null,
    categoryName: 'Doces',
    categorySlug: 'doces',
    logoPath: null,
    productCount: 4,
    rating: null,
    ...overrides,
  };
}

function featured(name: string, slug: string, isPromoted = false): FeaturedStore {
  return { ...store(name, slug), isPromoted };
}

const never = () => new Promise<never>(() => {});

function renderHome() {
  return renderRoutes(
    [
      {
        path: '/',
        element: (
          <>
            <HomePage />
            <Toaster />
          </>
        ),
      },
      { path: '/vender', element: <p>Página Quero vender</p> },
    ],
    '/',
  );
}

function section(name: string) {
  return screen.getByRole('region', { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listCategories.mockResolvedValue([
    { id: 'c1', name: 'Doces', slug: 'doces' },
    { id: 'c2', name: 'Salgados', slug: 'salgados' },
  ]);
  api.searchProducts.mockResolvedValue({
    items: [1, 2, 3, 4, 5, 6].map((i) => product(i)),
    next: null,
  });
  api.listFeaturedStores.mockResolvedValue([
    featured('Doces da Ana', 'doces-da-ana'),
    featured('Gelados Fresquinhos', 'gelados-fresquinhos'),
  ]);
  api.listStores.mockResolvedValue([]);
});

describe('HomePage (C01)', () => {
  it('o único h1 é «O que procuras hoje?», com «hoje?» em <mark>', async () => {
    renderHome();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('O que procuras hoje?');
    expect(h1.querySelector('mark')).toHaveTextContent('hoje?');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await screen.findByText('Produto 1');
    expect(document.title).toBe('PAIÁ');
  });

  it('o campo de pesquisa é uma ligação para /explorar', async () => {
    renderHome();
    expect(screen.getByRole('link', { name: /Bolos, salgados, acessórios…/ })).toHaveAttribute(
      'href',
      '/explorar',
    );
    await screen.findByText('Produto 1');
  });

  it('os chips ligam a /explorar?categoria=<slug>', async () => {
    renderHome();
    const chips = screen.getByRole('navigation', { name: 'Categorias' });
    expect(await within(chips).findByRole('link', { name: 'Doces' })).toHaveAttribute(
      'href',
      '/explorar?categoria=doces',
    );
    expect(within(chips).getByRole('link', { name: 'Tudo' })).toHaveAttribute('href', '/explorar');
  });

  it('«Novidades na comunidade» pede 6 produtos recentes e liga «Ver tudo» a /explorar', async () => {
    api.searchProducts.mockResolvedValue({
      items: [1, 2, 3, 4, 5, 6, 7].map((i) => product(i)),
      next: null,
    });
    renderHome();
    const news = section('Novidades na comunidade');
    expect(await within(news).findAllByRole('article')).toHaveLength(6);
    expect(api.searchProducts).toHaveBeenCalledTimes(1);
    expect(api.searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'recentes', limit: 6 }),
    );
    expect(within(news).getByRole('link', { name: 'Ver tudo' })).toHaveAttribute(
      'href',
      '/explorar',
    );
  });

  it('o botão de adicionar das novidades mostra «Disponível em breve»', async () => {
    const user = userEvent.setup({ delay: null });
    renderHome();
    await user.click(
      await screen.findByRole('button', { name: 'Adicionar Produto 1 ao carrinho' }),
    );
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });

  it('«Quero vender» é uma ligação para /vender (o F2 já existe)', async () => {
    const user = userEvent.setup({ delay: null });
    renderHome();
    const sell = section('Tens alguma coisa para vender?');
    const link = within(sell).getByRole('link', { name: 'Quero vender' });
    expect(link).toHaveAttribute('href', '/vender');
    await user.click(link);
    expect(await screen.findByText('Página Quero vender')).toBeInTheDocument();
    expect(screen.queryByText('Disponível em breve')).not.toBeInTheDocument();
  });

  it('o cabeçalho tem o logótipo, as notificações e o carrinho, ambos «Disponível em breve»', async () => {
    const user = userEvent.setup({ delay: null });
    renderHome();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('img', { name: 'PAIÁ' })).toBeInTheDocument();
    await user.click(within(header).getByRole('button', { name: 'Notificações' }));
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
    await user.click(within(header).getByRole('button', { name: 'Carrinho' }));
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });

  it('«Lojas da comunidade» mostra um StoreCard por destaque, pela ordem devolvida', async () => {
    renderHome();
    const stores = section('Lojas da comunidade');
    const names = await within(stores).findAllByRole('heading', { level: 3 });
    expect(names.map((h) => h.textContent)).toEqual(['Doces da Ana', 'Gelados Fresquinhos']);
    expect(within(stores).getAllByRole('link', { name: 'Ver loja' })[1]).toHaveAttribute(
      'href',
      '/loja/gelados-fresquinhos',
    );
    expect(within(stores).getByRole('link', { name: 'Ver todas' })).toHaveAttribute(
      'href',
      '/lojas',
    );
    expect(api.listStores).not.toHaveBeenCalled();
  });

  it('um destaque pago mostra «Promovida»; um destaque da administração não', async () => {
    api.listFeaturedStores.mockResolvedValue([
      featured('Doces da Ana', 'doces-da-ana', false),
      featured('Gelados Fresquinhos', 'gelados-fresquinhos', true),
    ]);
    renderHome();
    const cards = await within(section('Lojas da comunidade')).findAllByRole('article');
    expect(within(cards[0]!).queryByText('Promovida')).not.toBeInTheDocument();
    expect(within(cards[1]!).getByText('Promovida')).toBeInTheDocument();
  });

  it('sem destaques, mostra até 3 StoreLink de listStores({})', async () => {
    api.listFeaturedStores.mockResolvedValue([]);
    api.listStores.mockResolvedValue([
      store('Doces da Ana', 'doces-da-ana'),
      store('Salgados do Bloco', 'salgados-do-bloco'),
      store('Acessórios do Kiko', 'acessorios-do-kiko'),
      store('Mimos da Teresa', 'mimos-da-teresa'),
    ]);
    renderHome();
    const stores = section('Lojas da comunidade');
    expect(await within(stores).findByRole('link', { name: /Salgados do Bloco/ })).toHaveAttribute(
      'href',
      '/loja/salgados-do-bloco',
    );
    expect(within(stores).queryByRole('link', { name: /Mimos da Teresa/ })).toBeNull();
    expect(within(stores).queryByRole('article')).toBeNull();
    expect(api.listStores).toHaveBeenCalledWith({});
  });

  it('as secções seguem a ordem do C01b', async () => {
    renderHome();
    await screen.findByText('Produto 1');
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual([
      'Lojas da comunidade',
      'Novidades na comunidade',
      'Tens alguma coisa para vender?',
    ]);
  });

  it('enquanto carrega, cada secção mostra o CatalogSkeleton', () => {
    api.searchProducts.mockImplementation(never);
    api.listFeaturedStores.mockImplementation(never);
    renderHome();
    expect(within(section('Novidades na comunidade')).getByRole('status')).toHaveTextContent(
      'A carregar produtos…',
    );
    expect(within(section('Lojas da comunidade')).getByRole('status')).toHaveTextContent(
      'A carregar lojas…',
    );
  });

  it('um erro numa secção mostra a mensagem e «Tentar outra vez», sem apagar as outras', async () => {
    const user = userEvent.setup({ delay: null });
    api.listFeaturedStores.mockRejectedValueOnce(new Error('Algo correu mal. Tenta outra vez.'));
    renderHome();
    const stores = section('Lojas da comunidade');
    expect(await within(stores).findByRole('alert')).toHaveTextContent(
      'Algo correu mal. Tenta outra vez.',
    );
    expect(await screen.findByText('Produto 1')).toBeInTheDocument();

    await user.click(within(stores).getByRole('button', { name: 'Tentar outra vez' }));
    expect(await within(stores).findByRole('heading', { name: 'Doces da Ana' })).toBeVisible();
    expect(api.listFeaturedStores).toHaveBeenCalledTimes(2);
  });

  it('sem produtos, «Novidades» mostra um estado vazio', async () => {
    api.searchProducts.mockResolvedValue({ items: [], next: null });
    renderHome();
    const news = section('Novidades na comunidade');
    expect(
      await within(news).findByRole('heading', { name: 'Ainda não há produtos.' }),
    ).toBeInTheDocument();
  });
});
