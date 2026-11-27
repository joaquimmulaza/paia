import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/sonner';
import type { CatalogProduct, ProductCursor, StoreSummary } from '@/features/catalog/types';
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

import { ExplorePage } from '@/features/catalog/ExplorePage';

function product(i: number, overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: `00000000-0000-0000-0000-0000000000${String(i).padStart(2, '0')}`,
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
    categoryName: 'Salgados',
    categorySlug: 'salgados',
    logoPath: null,
    productCount: 8,
    rating: null,
    ...overrides,
  };
}

const FOUR = [1, 2, 3, 4].map((i) => product(i));
const CURSOR: ProductCursor = { createdAt: FOUR[1]!.createdAt, priceKz: 1000, id: FOUR[1]!.id };

function page(items: CatalogProduct[], next: ProductCursor | null = null) {
  return { items, next };
}

function renderExplore(entry = '/explorar') {
  return renderRoutes(
    [
      {
        path: '/explorar',
        element: (
          <>
            <ExplorePage />
            <Toaster />
          </>
        ),
      },
    ],
    entry,
  );
}

/** O texto da contagem (há outras regiões status: o esqueleto e o estado vazio). */
async function expectCount(text: string) {
  await waitFor(() =>
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toContain(text),
  );
}

const searchbox = () => screen.getByRole('searchbox', { name: 'Pesquisar produtos e lojas' });

beforeEach(() => {
  vi.clearAllMocks();
  api.listCategories.mockResolvedValue([
    { id: 'c1', name: 'Doces', slug: 'doces' },
    { id: 'c2', name: 'Salgados', slug: 'salgados' },
  ]);
  api.searchProducts.mockResolvedValue(page(FOUR));
  api.listStores.mockResolvedValue([]);
});

describe('ExplorePage (C02)', () => {
  it('o h1 é «Explorar», o separador diz «Explorar · PAIÁ», há carrinho e o separador ativo é Explorar', async () => {
    const user = userEvent.setup({ delay: null });
    renderExplore();
    expect(screen.getByRole('heading', { level: 1, name: 'Explorar' })).toBeInTheDocument();
    expect(document.title).toBe('Explorar · PAIÁ');
    expect(screen.getByRole('link', { name: /Explorar/ })).toHaveAttribute('aria-current', 'page');
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Carrinho' }));
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });

  it('escrever «bolo» põe ?q=bolo no URL depois da pausa, sem nova entrada no histórico', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = renderExplore();
    await expectCount('4 produtos');
    await user.type(searchbox(), 'bolo');
    // Logo a seguir a escrever, o URL ainda não mudou.
    expect(router.state.location.search).toBe('');
    await waitFor(() => expect(router.state.location.search).toBe('?q=bolo'));
    expect(router.state.historyAction).toBe('REPLACE');
    await waitFor(() =>
      expect(api.searchProducts).toHaveBeenLastCalledWith({ q: 'bolo', sort: 'recentes' }),
    );
  });

  it('escolher «Doces» acrescenta categoria=doces e o Voltar repõe a pesquisa anterior', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = renderExplore('/explorar?q=bolo');
    const chips = screen.getByRole('group', { name: 'Filtrar por categoria' });
    await user.click(await within(chips).findByRole('button', { name: 'Doces' }));
    expect(router.state.location.search).toBe('?q=bolo&categoria=doces');
    expect(router.state.historyAction).toBe('PUSH');
    await waitFor(() =>
      expect(api.searchProducts).toHaveBeenLastCalledWith({
        q: 'bolo',
        categorySlug: 'doces',
        sort: 'recentes',
      }),
    );

    await act(() => router.navigate(-1));
    expect(router.state.location.search).toBe('?q=bolo');
    expect(within(chips).getByRole('button', { name: 'Tudo' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(searchbox()).toHaveValue('bolo');
  });

  it('o select nativo «Ordenar» tem as três ordens e muda o URL', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = renderExplore('/explorar?q=bolo');
    const select = screen.getByRole('combobox', { name: 'Ordenar' });
    expect(select.tagName).toBe('SELECT');
    const options = within(select).getAllByRole('option');
    expect(options.map((o) => [o.textContent, (o as HTMLOptionElement).value])).toEqual([
      ['Mais recentes', 'recentes'],
      ['Preço mais baixo', 'preco-asc'],
      ['Preço mais alto', 'preco-desc'],
    ]);
    expect(select).toHaveValue('recentes');

    await user.selectOptions(select, 'Preço mais baixo');
    expect(router.state.location.search).toBe('?q=bolo&ordem=preco-asc');
    expect(router.state.historyAction).toBe('PUSH');
    await waitFor(() =>
      expect(api.searchProducts).toHaveBeenLastCalledWith({ q: 'bolo', sort: 'preco-asc' }),
    );
    await expectCount('4 produtos para «bolo»');
    expect(screen.getByRole('combobox', { name: 'Ordenar' })).toHaveValue('preco-asc');

    await act(() => router.navigate(-1));
    expect(screen.getByRole('combobox', { name: 'Ordenar' })).toHaveValue('recentes');
  });

  it('a contagem diz «4 produtos para «bolo» em Doces»', async () => {
    renderExplore('/explorar?q=bolo&categoria=doces');
    await expectCount('4 produtos para «bolo» em Doces');
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('sem q, a contagem diz «4 produtos em Doces»', async () => {
    renderExplore('/explorar?categoria=doces');
    await expectCount('4 produtos em Doces');
  });

  it('sem filtros, «4 produtos»; com 1 resultado, «1 produto»', async () => {
    api.searchProducts.mockResolvedValueOnce(page(FOUR)).mockResolvedValue(page([product(1)]));
    const { unmount } = renderExplore();
    await expectCount('4 produtos');
    unmount();
    renderExplore('/explorar?q=bolo');
    await expectCount('1 produto para «bolo»');
  });

  it('com mais páginas, a contagem leva «+»', async () => {
    api.searchProducts.mockResolvedValue(page(FOUR, CURSOR));
    renderExplore();
    await expectCount('4+ produtos');
  });

  it('com q, mostra a secção «Lojas» com StoreLink', async () => {
    api.listStores.mockResolvedValue([store('Doces da Ana', 'doces-da-ana')]);
    renderExplore('/explorar?q=ana');
    const section = await screen.findByRole('region', { name: 'Lojas' });
    expect(within(section).getByRole('heading', { level: 2, name: 'Lojas' })).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /Doces da Ana/ })).toHaveAttribute(
      'href',
      '/loja/doces-da-ana',
    );
    expect(api.listStores).toHaveBeenCalledWith({ q: 'ana' });
  });

  it('sem q, não pede lojas nem mostra a secção', async () => {
    api.listStores.mockResolvedValue([store('Doces da Ana', 'doces-da-ana')]);
    renderExplore();
    await expectCount('4 produtos');
    expect(api.listStores).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Lojas' })).not.toBeInTheDocument();
  });

  it('«Ver mais produtos» pede a página seguinte com o cursor, junta os itens e leva o foco ao primeiro novo', async () => {
    const user = userEvent.setup({ delay: null });
    api.searchProducts.mockImplementation(async (p: { after?: ProductCursor }) =>
      p.after ? page(FOUR.slice(2)) : page(FOUR.slice(0, 2), CURSOR),
    );
    renderExplore();
    await expectCount('2+ produtos');
    await user.click(screen.getByRole('button', { name: 'Ver mais produtos' }));
    expect(api.searchProducts).toHaveBeenLastCalledWith({ sort: 'recentes', after: CURSOR });
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(4));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Produto 3' })).toHaveFocus());
    await expectCount('4 produtos');
    expect(screen.queryByRole('button', { name: 'Ver mais produtos' })).not.toBeInTheDocument();
  });

  it('se a página seguinte falha, o foco não salta para um cartão quando a ordem muda', async () => {
    const user = userEvent.setup({ delay: null });
    api.searchProducts.mockImplementation(async (p: { after?: ProductCursor; sort: string }) => {
      if (p.after) throw new Error('Sem ligação. Tenta outra vez.');
      return p.sort === 'recentes' ? page(FOUR.slice(0, 2), CURSOR) : page(FOUR);
    });
    renderExplore();
    await user.click(await screen.findByRole('button', { name: 'Ver mais produtos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem ligação. Tenta outra vez.');

    const select = screen.getByRole('combobox', { name: 'Ordenar' });
    await user.selectOptions(select, 'Preço mais baixo');
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(4));
    await expectCount('4 produtos');
    expect(screen.getByRole('link', { name: 'Produto 3' })).not.toHaveFocus();
    expect(select).toHaveFocus();
  });

  it('enquanto as categorias carregam, a contagem espera pelo nome da categoria', async () => {
    let resolveCategories: (c: { id: string; name: string; slug: string }[]) => void = () => {};
    api.listCategories.mockImplementation(
      () => new Promise((resolve) => (resolveCategories = resolve)),
    );
    renderExplore('/explorar?q=bolo&categoria=doces');
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(4));
    expect(screen.getAllByRole('status').map((s) => s.textContent)).not.toContain(
      '4 produtos para «bolo»',
    );
    await act(async () => resolveCategories([{ id: 'c1', name: 'Doces', slug: 'doces' }]));
    await expectCount('4 produtos para «bolo» em Doces');
  });

  it('enquanto as categorias carregam, o estado vazio não mostra um título sem a categoria', async () => {
    let resolveCategories: (c: { id: string; name: string; slug: string }[]) => void = () => {};
    api.listCategories.mockImplementation(
      () => new Promise((resolve) => (resolveCategories = resolve)),
    );
    api.searchProducts.mockResolvedValue(page([]));
    renderExplore('/explorar?q=pizza&categoria=salgados');
    await waitFor(() => expect(api.searchProducts).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole('heading', { name: 'Nada para «pizza»' })).not.toBeInTheDocument();
    await act(async () => resolveCategories([{ id: 'c2', name: 'Salgados', slug: 'salgados' }]));
    expect(
      await screen.findByRole('heading', { name: 'Nada para «pizza» em Salgados' }),
    ).toBeInTheDocument();
  });

  it('enquanto pede a página seguinte, o botão mostra o indicador', async () => {
    const user = userEvent.setup({ delay: null });
    api.searchProducts.mockImplementation((p: { after?: ProductCursor }) =>
      p.after ? new Promise<never>(() => {}) : Promise.resolve(page(FOUR.slice(0, 2), CURSOR)),
    );
    renderExplore();
    await user.click(await screen.findByRole('button', { name: 'Ver mais produtos' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Ver mais produtos' })).toHaveAttribute(
        'aria-busy',
        'true',
      ),
    );
  });

  it('abrir com ?ordem=x&q= mostra tudo por «recentes», sem erro', async () => {
    renderExplore('/explorar?ordem=x&q=');
    await expectCount('4 produtos');
    expect(api.searchProducts).toHaveBeenCalledWith({ sort: 'recentes' });
    expect(screen.getByRole('combobox', { name: 'Ordenar' })).toHaveValue('recentes');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('o campo acompanha o q do URL quando muda sem ser a escrever (ligação, Voltar)', async () => {
    const { router } = renderExplore('/explorar?q=bolo');
    expect(searchbox()).toHaveValue('bolo');
    await act(() => router.navigate('/explorar?q=pão'));
    await waitFor(() => expect(searchbox()).toHaveValue('pão'));
    await act(() => router.navigate(-1));
    await waitFor(() => expect(searchbox()).toHaveValue('bolo'));
    // Não reescreve o URL depois da pausa.
    await new Promise((r) => setTimeout(r, 350));
    expect(router.state.location.search).toBe('?q=bolo');
  });

  it('um erro mostra a mensagem e «Tentar outra vez» volta a pedir', async () => {
    const user = userEvent.setup({ delay: null });
    api.searchProducts.mockRejectedValueOnce(new Error('Sem ligação. Tenta outra vez.'));
    renderExplore();
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem ligação. Tenta outra vez.');
    await user.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    await expectCount('4 produtos');
  });
});

describe('ExplorePage (K07 · sem resultados)', () => {
  const SALGADOS = [
    store('Salgados do Bloco', 'salgados-do-bloco'),
    store('Rissóis da Maria', 'rissois-da-maria'),
    store('Pastéis do Zé', 'pasteis-do-ze'),
    store('Chamuças da Rosa', 'chamucas-da-rosa'),
  ];

  beforeEach(() => {
    api.searchProducts.mockImplementation(async (p: { q?: string }) =>
      p.q === 'pizza' ? page([]) : page(FOUR),
    );
    api.listStores.mockImplementation(async (p: { q?: string; categorySlug?: string }) =>
      !p.q && p.categorySlug === 'salgados' ? SALGADOS : [],
    );
  });

  it('com categoria: «Nada para «pizza» em Salgados», o texto e até 3 lojas da categoria', async () => {
    renderExplore('/explorar?q=pizza&categoria=salgados');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Nada para «pizza» em Salgados' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Experimenta outra palavra ou procura em todas as categorias.'),
    ).toBeInTheDocument();
    const section = await screen.findByRole('region', { name: 'Talvez te interesse' });
    expect(within(section).getAllByRole('link')).toHaveLength(3);
    expect(within(section).getByRole('link', { name: /Salgados do Bloco/ })).toBeInTheDocument();
    expect(api.listStores).toHaveBeenCalledWith({ categorySlug: 'salgados' });
    expect(screen.queryByRole('combobox', { name: 'Ordenar' })).not.toBeInTheDocument();
  });

  it('«Procurar em tudo» tira a categoria', async () => {
    const user = userEvent.setup({ delay: null });
    api.searchProducts.mockImplementation(async (p: { q?: string; categorySlug?: string }) =>
      p.categorySlug ? page([]) : page(FOUR),
    );
    const { router } = renderExplore('/explorar?q=pizza&categoria=salgados');
    await user.click(await screen.findByRole('button', { name: 'Procurar em tudo' }));
    expect(router.state.location.search).toBe('?q=pizza');
    await expectCount('4 produtos para «pizza»');
    // O foco passa para a contagem, que já é a região status: não há um segundo anúncio.
    await waitFor(() =>
      expect(document.activeElement).toHaveTextContent('4 produtos para «pizza»'),
    );
    expect(document.activeElement).toHaveAttribute('role', 'status');
    expect(document.activeElement).toHaveAttribute('tabindex', '-1');
  });

  it('«Procurar em tudo» ainda sem resultados leva o foco ao título do estado vazio', async () => {
    const user = userEvent.setup({ delay: null });
    renderExplore('/explorar?q=pizza&categoria=salgados');
    await user.click(await screen.findByRole('button', { name: 'Procurar em tudo' }));
    const title = await screen.findByRole('heading', { level: 2, name: 'Nada para «pizza»' });
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveAttribute('tabindex', '-1');
  });

  it('sem categoria: «Nada para «pizza»», sem «Procurar em tudo» nem sugestões', async () => {
    renderExplore('/explorar?q=pizza');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Nada para «pizza»' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Procurar em tudo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Talvez te interesse' })).not.toBeInTheDocument();
  });

  it('sem q nem resultados: «Ainda não há produtos.»', async () => {
    api.searchProducts.mockResolvedValue(page([]));
    renderExplore();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Ainda não há produtos.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Quando as lojas publicarem produtos, aparecem aqui.'),
    ).toBeInTheDocument();
  });
});
