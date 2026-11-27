import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/sonner';
import type { StoreSummary } from '@/features/catalog/types';
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

import { StoresPage } from '@/features/catalog/StoresPage';

function store(name: string, slug: string): StoreSummary {
  return {
    id: `id-${slug}`,
    name,
    slug,
    description: 'Bolos por fatia e encomendas para aniversários.',
    categoryName: 'Doces',
    categorySlug: 'doces',
    logoPath: null,
    productCount: 4,
    rating: null,
  };
}

const STORES = [
  store('Doces da Ana', 'doces-da-ana'),
  store('Salgados do Bloco', 'salgados-do-bloco'),
  store('Acessórios do Kiko', 'acessorios-do-kiko'),
];

function renderStores(entry = '/lojas') {
  return renderRoutes(
    [
      {
        path: '/lojas',
        element: (
          <>
            <StoresPage />
            <Toaster />
          </>
        ),
      },
    ],
    entry,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listCategories.mockResolvedValue([
    { id: 'c1', name: 'Doces', slug: 'doces' },
    { id: 'c2', name: 'Salgados', slug: 'salgados' },
  ]);
  api.listStores.mockResolvedValue(STORES);
});

describe('StoresPage (C05)', () => {
  it('o h1 é «Lojas», o título do separador é «Lojas · PAIÁ» e o cabeçalho tem o carrinho', async () => {
    const user = userEvent.setup({ delay: null });
    renderStores();
    expect(screen.getByRole('heading', { level: 1, name: 'Lojas' })).toBeInTheDocument();
    expect(document.title).toBe('Lojas · PAIÁ');
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Carrinho' }));
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });

  it('mostra a nota sobre as lojas aprovadas', async () => {
    renderStores();
    expect(screen.getByText('Só aparecem lojas aprovadas pela equipa do PAIÁ.')).toBeVisible();
    await screen.findByRole('heading', { name: 'Doces da Ana' });
  });

  it('a primeira loja é um StoreCard em destaque e as restantes são StoreLink', async () => {
    renderStores();
    const first = await screen.findByRole('heading', { level: 2, name: 'Doces da Ana' });
    expect(first.closest('article')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Ver loja' })).toHaveAttribute(
      'href',
      '/loja/doces-da-ana',
    );
    expect(screen.getByRole('link', { name: /Salgados do Bloco/ })).toHaveAttribute(
      'href',
      '/loja/salgados-do-bloco',
    );
    expect(screen.getByRole('link', { name: /Acessórios do Kiko/ })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('pesquisa com o q depois de 300 ms de pausa e guarda-o no URL', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = renderStores();
    await screen.findByRole('heading', { name: 'Doces da Ana' });
    expect(api.listStores).toHaveBeenLastCalledWith({});

    await user.type(screen.getByRole('searchbox', { name: 'Pesquisar lojas' }), 'ana');
    // Logo a seguir a escrever, ainda não pediu nada novo.
    expect(api.listStores).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(api.listStores).toHaveBeenLastCalledWith({ q: 'ana' }));
    expect(api.listStores).toHaveBeenCalledTimes(2);
    expect(router.state.location.search).toBe('?q=ana');
  });

  it('o q do URL preenche o campo e filtra logo', async () => {
    renderStores('/lojas?q=kiko');
    expect(screen.getByRole('searchbox', { name: 'Pesquisar lojas' })).toHaveValue('kiko');
    await screen.findByRole('heading', { name: 'Doces da Ana' });
    expect(api.listStores).toHaveBeenCalledWith({ q: 'kiko' });
  });

  it('o campo acompanha o q do URL quando muda sem ser a escrever (ligação, Voltar)', async () => {
    const { router } = renderStores('/lojas?q=bolo');
    const field = () => screen.getByRole('searchbox', { name: 'Pesquisar lojas' });
    expect(field()).toHaveValue('bolo');
    await act(() => router.navigate('/lojas?q=pão'));
    await waitFor(() => expect(field()).toHaveValue('pão'));
    await act(() => router.navigate(-1));
    await waitFor(() => expect(field()).toHaveValue('bolo'));
    await screen.findByRole('heading', { name: 'Doces da Ana' });
  });

  it('os chips começam em «Todas» e filtram pela categoria no URL', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = renderStores();
    const chips = screen.getByRole('group', { name: 'Filtrar por categoria' });
    expect(within(chips).getByRole('button', { name: 'Todas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(await within(chips).findByRole('button', { name: 'Doces' }));
    expect(within(chips).getByRole('button', { name: 'Doces' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(router.state.location.search).toBe('?categoria=doces');
    await waitFor(() => expect(api.listStores).toHaveBeenLastCalledWith({ categorySlug: 'doces' }));
  });

  it('sem resultados, mostra «Nenhuma loja encontrada.» e «Limpar pesquisa» tira q e categoria', async () => {
    const user = userEvent.setup({ delay: null });
    api.listStores.mockImplementation(async (p: { q?: string; categorySlug?: string }) =>
      p.q || p.categorySlug ? [] : STORES,
    );
    const { router } = renderStores('/lojas?q=xyz&categoria=doces');
    expect(
      await screen.findByRole('heading', { name: 'Nenhuma loja encontrada.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Experimenta outro nome ou outra categoria.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpar pesquisa' }));
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('searchbox', { name: 'Pesquisar lojas' })).toHaveValue('');
    expect(await screen.findByRole('heading', { name: 'Doces da Ana' })).toBeInTheDocument();
  });

  it('enquanto carrega, mostra o CatalogSkeleton', () => {
    api.listStores.mockImplementation(() => new Promise<never>(() => {}));
    renderStores();
    expect(screen.getByRole('status')).toHaveTextContent('A carregar lojas…');
  });

  it('um erro mostra a mensagem e «Tentar outra vez» volta a pedir', async () => {
    const user = userEvent.setup({ delay: null });
    api.listStores.mockRejectedValueOnce(new Error('Algo correu mal. Tenta outra vez.'));
    renderStores();
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo correu mal. Tenta outra vez.');
    await user.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByRole('heading', { name: 'Doces da Ana' })).toBeInTheDocument();
  });
});
