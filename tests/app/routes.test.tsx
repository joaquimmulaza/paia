import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyProfile } from '@/features/auth/api';

const auth = vi.hoisted(() => ({
  state: { session: null as unknown, loading: false },
  useAuth: vi.fn(),
}));
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: auth.useAuth }));

const api = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getMyProfile: vi.fn(),
}));
vi.mock('@/features/auth/api', () => api);

const catalog = vi.hoisted(() => ({
  listCategories: vi.fn(async () => []),
  searchProducts: vi.fn(async () => ({ items: [], next: null })),
  getProduct: vi.fn(),
  listStores: vi.fn(async () => []),
  getStore: vi.fn(),
  listFeaturedStores: vi.fn(async () => []),
}));
vi.mock('@/features/catalog/api', () => catalog);

import { routes } from '@/app/router';
import { renderRoutes } from '../utils/renderRoutes';

const student: MyProfile = {
  fullName: 'Teste Estudante',
  phone: '923456789',
  affiliation: 'student',
  course: 'Engenharia',
  curricularYear: '1.º ano',
  shift: 'Manhã',
  classGroup: 'A',
  isAdmin: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.state = { session: null, loading: false };
  auth.useAuth.mockImplementation(() => auth.state);
});

describe('rotas da aplicação', () => {
  it('no perfil (com RequireAuth), terminar sessão acaba em /entrar', async () => {
    const user = userEvent.setup({ delay: null });
    auth.state = { session: { user: { id: 'u1' } }, loading: false };
    api.getMyProfile.mockResolvedValue(student);
    api.signOut.mockImplementation(async () => {
      auth.state = { session: null, loading: false };
    });
    const { router } = renderRoutes(routes, '/perfil');

    await user.click(await screen.findByRole('button', { name: 'Terminar sessão' }));
    expect(await screen.findByRole('heading', { name: 'Entra no PAIÁ' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
  });

  it.each(['/entrar', '/criar-conta'])('%s não tem a navegação inferior', async (path) => {
    renderRoutes(routes, path);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeNull();
  });

  it.each(['/', '/explorar', '/lojas', '/pedidos'])('%s tem a navegação inferior', async (path) => {
    renderRoutes(routes, path);
    expect(
      await screen.findByRole('navigation', { name: 'Navegação principal' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['/', 'O que procuras hoje?'],
    ['/explorar', 'Explorar'],
    ['/lojas', 'Lojas'],
    ['/pedidos', 'Em construção'],
  ])('%s mostra o título «%s»', async (path, title) => {
    renderRoutes(routes, path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it.each([
    ['/', 'PAIÁ', 'Início'],
    ['/explorar', 'Explorar · PAIÁ', 'Explorar'],
    ['/lojas', 'Lojas · PAIÁ', 'Lojas'],
    ['/pedidos', 'Pedidos · PAIÁ', 'Pedidos'],
  ])('%s tem o título «%s» e o separador %s ativo', async (path, title, tab) => {
    renderRoutes(routes, path);
    expect(await screen.findByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
    expect(document.title).toBe(title);
  });

  it('uma rota desconhecida mostra «Página não encontrada» com ligação ao início', async () => {
    renderRoutes(routes, '/nao-existe/mesmo');
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Página não encontrada');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
    expect(document.title).toBe('Página não encontrada · PAIÁ');
  });
});
