import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
vi.mock('@/features/auth/AuthProvider', () => auth);

import { RequireAuth, RequireGuest } from '@/app/guards';
import { renderRoutes } from '../utils/renderRoutes';

function mount(entry: string) {
  return renderRoutes(
    [
      {
        path: '/perfil',
        element: (
          <RequireAuth>
            <p>Conteúdo privado</p>
          </RequireAuth>
        ),
      },
      {
        path: '/entrar',
        element: (
          <RequireGuest>
            <p>Formulário de entrada</p>
          </RequireGuest>
        ),
      },
      { path: '/pedidos', element: <p>Página dos pedidos</p> },
    ],
    entry,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RequireAuth', () => {
  it('enquanto carrega, não mostra o conteúdo nem redireciona', () => {
    auth.useAuth.mockReturnValue({ session: null, loading: true });
    const { router } = mount('/perfil');
    expect(screen.queryByText('Conteúdo privado')).toBeNull();
    expect(router.state.location.pathname).toBe('/perfil');
  });

  it('sem sessão redireciona para /entrar com voltar=<rota>', async () => {
    auth.useAuth.mockReturnValue({ session: null, loading: false });
    const { router } = mount('/perfil?tab=1');
    expect(await screen.findByText('Formulário de entrada')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
    expect(new URLSearchParams(router.state.location.search).get('voltar')).toBe('/perfil?tab=1');
  });

  it('com sessão mostra o conteúdo', () => {
    auth.useAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    mount('/perfil');
    expect(screen.getByText('Conteúdo privado')).toBeInTheDocument();
  });
});

describe('RequireGuest', () => {
  it('sem sessão mostra o conteúdo', () => {
    auth.useAuth.mockReturnValue({ session: null, loading: false });
    mount('/entrar');
    expect(screen.getByText('Formulário de entrada')).toBeInTheDocument();
  });

  it('com sessão redireciona para /perfil', async () => {
    auth.useAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    const { router } = mount('/entrar');
    expect(await screen.findByText('Conteúdo privado')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/perfil');
  });

  it('com sessão respeita um voltar seguro e recusa um inseguro', async () => {
    auth.useAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    const first = mount('/entrar?voltar=%2Fpedidos');
    expect(await screen.findByText('Página dos pedidos')).toBeInTheDocument();
    first.unmount();
    const second = mount('/entrar?voltar=%2F%2Fevil.com');
    expect(await screen.findByText('Conteúdo privado')).toBeInTheDocument();
    expect(second.router.state.location.pathname).toBe('/perfil');
  });
});
