import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyStoreKind } from '@/features/seller/types';

const sellerApi = vi.hoisted(() => ({
  getMyStore: vi.fn(),
  getMyStoreDecisions: vi.fn(),
  saveMyStore: vi.fn(),
  submitMyStore: vi.fn(),
  uploadStoreImage: vi.fn(),
}));
vi.mock('@/features/seller/api', () => sellerApi);
const authApi = vi.hoisted(() => ({ getMyProfile: vi.fn() }));
vi.mock('@/features/auth/api', () => authApi);
vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-test' } }, loading: false }),
  currentUserId: () => 'user-test',
}));

import { SellPage } from '@/features/seller/SellPage';
import { renderRoutes } from '../../utils/renderRoutes';
import { makeStore, student, teacher } from './fixtures';

function mount() {
  return renderRoutes(
    [
      { path: '/vender', element: <SellPage /> },
      { path: '/vender/pedido', element: <p>Formulário</p> },
      { path: '/vender/estado', element: <p>Estado</p> },
      { path: '/vender/loja', element: <p>Painel</p> },
    ],
    '/vender',
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SellPage (V01, V01b)', () => {
  it('um estudante sem loja vê o V01 e «Pedir a minha loja» leva a /vender/pedido', async () => {
    authApi.getMyProfile.mockResolvedValue(student);
    sellerApi.getMyStore.mockResolvedValue(null);
    mount();
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Vende à tua comunidade');
    expect(screen.getByText('Pede a tua loja')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Antes de começares' })).toHaveTextContent(
      'Só estudantes podem ter loja, uma por conta.',
    );
    expect(screen.getByRole('link', { name: 'Pedir a minha loja' })).toHaveAttribute(
      'href',
      '/vender/pedido',
    );
    expect(screen.getByRole('link', { name: 'Voltar ao perfil' })).toHaveAttribute(
      'href',
      '/perfil',
    );
    expect(document.title).toBe('Quero vender · PAIÁ');
  });

  it('uma conta teacher vê «Lojas só para estudantes» (V01b)', async () => {
    authApi.getMyProfile.mockResolvedValue(teacher);
    sellerApi.getMyStore.mockResolvedValue(null);
    mount();
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Lojas só para estudantes');
    expect(screen.getByRole('link', { name: 'Ver lojas' })).toHaveAttribute('href', '/lojas');
    expect(screen.queryByRole('link', { name: 'Pedir a minha loja' })).toBeNull();
  });

  it.each([
    ['draft', 'Formulário', '/vender/pedido'],
    ['pending', 'Estado', '/vender/estado'],
    ['rejected', 'Estado', '/vender/estado'],
    ['suspended', 'Estado', '/vender/estado'],
    ['approved', 'Painel', '/vender/loja'],
  ] as const)('com loja %s, vai para %s', async (kind: MyStoreKind, text, path) => {
    authApi.getMyProfile.mockResolvedValue(student);
    sellerApi.getMyStore.mockResolvedValue(makeStore({ kind }));
    const { router } = mount();
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
  });

  it('se a loja não carregar, mostra o erro e «Tentar outra vez»', async () => {
    authApi.getMyProfile.mockResolvedValue(student);
    sellerApi.getMyStore.mockRejectedValue(new Error('Algo correu mal. Tenta outra vez.'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo correu mal.');
    expect(screen.getByRole('button', { name: 'Tentar outra vez' })).toBeInTheDocument();
  });
});
