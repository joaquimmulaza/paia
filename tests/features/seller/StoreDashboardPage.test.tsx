import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sellerApi = vi.hoisted(() => ({ getMyStore: vi.fn() }));
vi.mock('@/features/seller/api', () => sellerApi);
vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-test' } }, loading: false }),
  currentUserId: () => 'user-test',
}));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast,
}));

import { StoreDashboardPage } from '@/features/seller/StoreDashboardPage';
import { renderRoutes } from '../../utils/renderRoutes';
import { makeStore } from './fixtures';

function mount() {
  return renderRoutes(
    [
      { path: '/vender', element: <p>Quero vender</p> },
      { path: '/vender/estado', element: <p>Estado</p> },
      { path: '/vender/pedido', element: <p>Pedido</p> },
      { path: '/vender/loja', element: <StoreDashboardPage /> },
    ],
    '/vender/loja',
  );
}

const approved = makeStore({ status: 'approved', kind: 'approved', logoPath: 'stores/x.webp' });

beforeEach(() => vi.clearAllMocks());

describe('StoreDashboardPage (V04b)', () => {
  it('com 0 produtos publicados mostra «Publica o primeiro produto»', async () => {
    sellerApi.getMyStore.mockResolvedValue(approved);
    mount();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Publica o primeiro produto' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Doces da Ana' })).toBeVisible();
    expect(screen.getByText('Aprovada')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Publicar produto' })).toHaveAttribute(
      'href',
      '/vender/produtos/novo',
    );
    expect(document.title).toBe('Doces da Ana · PAIÁ');
  });

  it('mostra os números de get_my_store, com ligação ao filtro', async () => {
    sellerApi.getMyStore.mockResolvedValue(
      makeStore({
        ...approved,
        publishedProductsCount: 12,
        soldOutProductsCount: 1,
        hiddenProductsCount: 2,
      }),
    );
    mount();
    const published = await screen.findByRole('link', { name: '12 Publicados' });
    expect(published).toHaveAttribute('href', '/vender/produtos?filtro=publicados');
    expect(screen.getByRole('link', { name: '1 Esgotados' })).toHaveAttribute(
      'href',
      '/vender/produtos?filtro=esgotados',
    );
    expect(screen.getByRole('link', { name: '2 Ocultos' })).toHaveAttribute(
      'href',
      '/vender/produtos?filtro=ocultos',
    );
    expect(screen.queryByText('Publica o primeiro produto')).not.toBeInTheDocument();
  });

  it('tem a navegação da loja e «Pedidos recebidos» desativado com «Disponível em breve»', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.getMyStore.mockResolvedValue(approved);
    mount();
    const nav = await screen.findByRole('navigation', { name: 'Gerir loja' });
    expect(nav).toBeVisible();
    expect(screen.getByRole('link', { name: 'Produtos' })).toHaveAttribute(
      'href',
      '/vender/produtos',
    );
    expect(screen.getByRole('link', { name: 'Editar loja' })).toHaveAttribute(
      'href',
      '/vender/loja/editar',
    );
    expect(screen.getByRole('link', { name: 'Ver a loja como comprador' })).toHaveAttribute(
      'href',
      '/loja/doces-da-ana',
    );
    const orders = screen.getByRole('button', { name: /Pedidos recebidos/ });
    expect(orders).toHaveAttribute('aria-disabled', 'true');
    expect(orders).toHaveTextContent('Disponível em breve');
    await user.click(orders);
    expect(toast).toHaveBeenCalledWith('Disponível em breve', expect.anything());
  });

  it.each([
    ['suspended', '/vender/estado'],
    ['pending', '/vender/estado'],
    ['draft', '/vender/pedido'],
  ] as const)('uma loja %s segue para %s', async (kind, path) => {
    sellerApi.getMyStore.mockResolvedValue(makeStore({ kind }));
    const { router } = mount();
    await vi.waitFor(() => expect(router.state.location.pathname).toBe(path));
  });

  it('sem loja segue para /vender', async () => {
    sellerApi.getMyStore.mockResolvedValue(null);
    const { router } = mount();
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/vender'));
  });
});
