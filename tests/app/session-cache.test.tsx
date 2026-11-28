import { useQueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyProfile } from '@/features/auth/api';

const mocks = vi.hoisted(() => {
  const state: { listener?: (event: string, session: unknown) => void } = {};
  return {
    state,
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      state.listener = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
  };
});
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange } },
}));

const api = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getMyProfile: vi.fn(),
}));
vi.mock('@/features/auth/api', () => api);

import { Providers } from '@/app/providers';
import { routes } from '@/app/router';
import { routerFuture, routerProviderFuture } from '@/app/router-future';

const profile = (fullName: string): MyProfile => ({
  fullName,
  phone: '923456789',
  affiliation: 'teacher',
  course: null,
  curricularYear: null,
  shift: null,
  classGroup: null,
  isAdmin: false,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cache do perfil entre sessões', () => {
  it('depois de sair e entrar com outra conta, o perfil antigo nunca aparece', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-a' } } } });
    api.getMyProfile.mockResolvedValueOnce(profile('Utilizador Antigo'));
    const router = createMemoryRouter(routes, {
      initialEntries: ['/perfil'],
      future: routerFuture,
    });
    render(
      <Providers>
        <RouterProvider router={router} future={routerProviderFuture} />
      </Providers>,
    );
    expect(await screen.findByText('Utilizador Antigo')).toBeInTheDocument();

    act(() => mocks.state.listener?.('SIGNED_OUT', null));
    await screen.findByRole('heading', { name: 'Entra no PAIÁ' });

    // O perfil da conta nova fica pendente: se a cache não fosse limpa, o antigo apareceria já.
    let resolveB!: (p: MyProfile) => void;
    api.getMyProfile.mockReturnValueOnce(new Promise<MyProfile>((r) => (resolveB = r)));
    act(() => mocks.state.listener?.('SIGNED_IN', { user: { id: 'user-b' } }));
    await screen.findByRole('heading', { name: 'Perfil' });
    expect(screen.queryByText('Utilizador Antigo')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('A carregar o perfil…');

    await act(async () => resolveB(profile('Utilizador Novo')));
    expect(await screen.findByText('Utilizador Novo')).toBeInTheDocument();
    expect(screen.queryByText('Utilizador Antigo')).toBeNull();
  });

  it('ao mudar de conta, a cache inteira é limpa: a loja e os produtos da conta anterior saem', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-a' } } } });
    let client!: ReturnType<typeof useQueryClient>;
    function Probe() {
      client = useQueryClient();
      return null;
    }
    render(
      <Providers>
        <Probe />
        <p>pronto</p>
      </Providers>,
    );
    await screen.findByText('pronto');
    await act(async () => {
      await Promise.resolve();
    });
    const categories = [{ id: '1', name: 'Bolos', slug: 'bolos' }];
    client.setQueryData(['catalog', 'categories'], categories);
    client.setQueryData(['me', 'profile', 'user-a'], profile('Utilizador Antigo'));
    client.setQueryData(['seller', 'store'], { name: 'Loja da conta A' });
    client.setQueryData(['seller', 'products', 'all'], { pages: [] });

    act(() => mocks.state.listener?.('SIGNED_OUT', null));

    expect(client.getQueryData(['seller', 'store'])).toBeUndefined();
    expect(client.getQueryData(['seller', 'products', 'all'])).toBeUndefined();
    expect(client.getQueryData(['me', 'profile', 'user-a'])).toBeUndefined();
    expect(client.getQueryData(['catalog', 'categories'])).toBeUndefined();
  });
});
