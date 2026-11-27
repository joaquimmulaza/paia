import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyProfile } from '@/features/auth/api';

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('@/features/auth/AuthProvider', () => auth);

const api = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getMyProfile: vi.fn(),
}));
vi.mock('@/features/auth/api', () => api);

import { RequireAuth } from '@/app/guards';
import { RequireAdmin } from '@/features/admin/RequireAdmin';
import { renderRoutes } from '../../utils/renderRoutes';

const profile: MyProfile = {
  fullName: 'Teste Administrador',
  phone: '923456789',
  affiliation: 'staff',
  course: null,
  curricularYear: null,
  shift: null,
  classGroup: null,
  isAdmin: true,
};

function mount() {
  return renderRoutes(
    [
      {
        path: '/admin/destaques',
        element: (
          <RequireAuth>
            <RequireAdmin>
              <p>Página da administração</p>
            </RequireAdmin>
          </RequireAuth>
        ),
      },
      { path: '/entrar', element: <p>Página de entrada</p> },
    ],
    '/admin/destaques',
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.useAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
});

describe('RequireAdmin', () => {
  it('sem sessão, redireciona para /entrar?voltar=%2Fadmin%2Fdestaques', async () => {
    auth.useAuth.mockReturnValue({ session: null, loading: false });
    const { router } = mount();
    expect(await screen.findByText('Página de entrada')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
    expect(router.state.location.search).toBe('?voltar=%2Fadmin%2Fdestaques');
    expect(api.getMyProfile).not.toHaveBeenCalled();
  });

  it('enquanto o perfil carrega, mostra um esqueleto e não a página', () => {
    api.getMyProfile.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('A carregar…');
    expect(screen.queryByText('Página da administração')).toBeNull();
  });

  it('um utilizador comum vê «Não tens permissão para fazer isto.» e volta ao início', async () => {
    api.getMyProfile.mockResolvedValue({ ...profile, isAdmin: false });
    mount();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Não tens permissão para fazer isto.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('Página da administração')).toBeNull();
  });

  it('um administrador vê a página', async () => {
    api.getMyProfile.mockResolvedValue(profile);
    mount();
    expect(await screen.findByText('Página da administração')).toBeInTheDocument();
  });

  it('se o perfil não carregar, mostra o erro e não a página', async () => {
    api.getMyProfile.mockRejectedValue(new Error('Algo correu mal. Tenta outra vez.'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo correu mal. Tenta outra vez.');
    expect(screen.getByRole('button', { name: 'Tentar outra vez' })).toBeInTheDocument();
    expect(screen.queryByText('Página da administração')).toBeNull();
  });
});
