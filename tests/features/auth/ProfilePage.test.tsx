import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyProfile } from '@/features/auth/api';

const api = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getMyProfile: vi.fn(),
}));
vi.mock('@/features/auth/api', () => api);
const sellerApi = vi.hoisted(() => ({ getMyStore: vi.fn(), getMyStoreDecisions: vi.fn() }));
vi.mock('@/features/seller/api', () => sellerApi);
vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-test' } }, loading: false }),
}));

const toast = vi.hoisted(() => vi.fn());
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast,
}));

import { ProfilePage } from '@/features/auth/ProfilePage';
import type { MyStoreKind } from '@/features/seller/types';
import { makeStore } from '../seller/fixtures';
import { renderRoutes } from '../../utils/renderRoutes';

const student: MyProfile = {
  fullName: 'Teste da Silva Estudante',
  phone: '923456789',
  affiliation: 'student',
  course: 'Engenharia Informática',
  curricularYear: '2.º ano',
  shift: 'Manhã',
  classGroup: 'A',
  isAdmin: false,
};

function mount() {
  return renderRoutes(
    [
      { path: '/perfil', element: <ProfilePage /> },
      { path: '/entrar', element: <p>Página de entrada</p> },
    ],
    '/perfil',
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sellerApi.getMyStore.mockResolvedValue(null);
});

describe('ProfilePage (K03)', () => {
  it('mostra iniciais, nome e vínculo; um só h1 e o título da página', async () => {
    api.getMyProfile.mockResolvedValue(student);
    mount();
    expect(await screen.findByText('Teste da Silva Estudante')).toBeInTheDocument();
    expect(screen.getByText('TE')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Estudante')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Perfil');
    expect(document.title).toBe('Perfil · PAIÁ');
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['teacher', 'Professor'],
    ['staff', 'Funcionário ou colaborador'],
  ] as const)('vínculo %s aparece como «%s», sem o cartão da loja', async (affiliation, label) => {
    api.getMyProfile.mockResolvedValue({
      ...student,
      affiliation,
      course: null,
      curricularYear: null,
      shift: null,
      classGroup: null,
    });
    mount();
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'A minha loja' })).toBeNull();
  });

  it('o estudante sem loja vê o cartão A minha loja; Quero vender leva a /vender', async () => {
    api.getMyProfile.mockResolvedValue(student);
    mount();
    const shop = await screen.findByRole('region', { name: 'A minha loja' });
    expect(shop).toHaveTextContent(
      'Ainda não tens loja. Pede a tua: a equipa do PAIÁ analisa e responde.',
    );
    expect(await screen.findByRole('link', { name: 'Quero vender' })).toHaveAttribute(
      'href',
      '/vender',
    );
    expect(toast).not.toHaveBeenCalled();
  });

  it.each([
    [
      'draft',
      'Rascunho',
      'O pedido ainda não foi enviado.',
      'Continuar o pedido',
      '/vender/pedido',
    ],
    [
      'pending',
      'Em análise',
      'A equipa está a analisar a tua loja.',
      'Ver o estado',
      '/vender/estado',
    ],
    ['rejected', 'Recusada', 'A loja ainda não foi aprovada.', 'Ver a mensagem', '/vender/estado'],
  ] as const)(
    'o ShopCard em %s mostra «%s» e a ação certa',
    async (kind: MyStoreKind, tag, text, action, href) => {
      api.getMyProfile.mockResolvedValue(student);
      sellerApi.getMyStore.mockResolvedValue(makeStore({ kind }));
      mount();
      const card = await screen.findByRole('region', { name: 'Doces da Ana' });
      expect(card).toHaveTextContent(tag);
      expect(card).toHaveTextContent(text);
      expect(screen.getByRole('link', { name: action })).toHaveAttribute('href', href);
    },
  );

  it('o ShopCard aprovado é uma ligação para /vender/loja', async () => {
    api.getMyProfile.mockResolvedValue(student);
    sellerApi.getMyStore.mockResolvedValue(makeStore({ kind: 'approved', status: 'approved' }));
    mount();
    const link = await screen.findByRole('link', { name: /Doces da Ana/ });
    expect(link).toHaveAttribute('href', '/vender/loja');
    expect(link).toHaveTextContent('Gerir produtos e loja');
    expect(link).toHaveTextContent('Aprovada');
  });

  it('o ShopCard suspenso mostra «Suspensa», sem ação', async () => {
    api.getMyProfile.mockResolvedValue(student);
    sellerApi.getMyStore.mockResolvedValue(makeStore({ kind: 'suspended', status: 'suspended' }));
    mount();
    const card = await screen.findByRole('region', { name: 'Doces da Ana' });
    expect(card).toHaveTextContent('Suspensa');
    expect(card.querySelector('a')).toBeNull();
  });

  it('um administrador vê a ligação «Administração» para /admin/destaques', async () => {
    api.getMyProfile.mockResolvedValue({ ...student, isAdmin: true });
    mount();
    const link = await screen.findByRole('link', { name: 'Administração' });
    expect(link).toHaveAttribute('href', '/admin/destaques');
    // Linha de lista (k-list), não um botão: dentro de <nav aria-label="Administração">.
    expect(screen.getByRole('navigation', { name: 'Administração' })).toContainElement(link);
    expect(link).toHaveClass('min-h-14');
  });

  it('quem não é administrador não vê a ligação «Administração»', async () => {
    api.getMyProfile.mockResolvedValue(student);
    mount();
    await screen.findByText('Teste da Silva Estudante');
    expect(screen.queryByRole('link', { name: 'Administração' })).toBeNull();
  });

  it('Terminar sessão chama signOut local e vai para /entrar', async () => {
    const user = userEvent.setup({ delay: null });
    api.getMyProfile.mockResolvedValue(student);
    api.signOut.mockResolvedValue(undefined);
    const { router } = mount();
    await user.click(await screen.findByRole('button', { name: 'Terminar sessão' }));
    expect(await screen.findByText('Página de entrada')).toBeInTheDocument();
    expect(api.signOut).toHaveBeenCalledWith('local');
    expect(router.state.location.pathname).toBe('/entrar');
  });

  it('Terminar sessão em todos os aparelhos chama signOut global', async () => {
    const user = userEvent.setup({ delay: null });
    api.getMyProfile.mockResolvedValue(student);
    api.signOut.mockResolvedValue(undefined);
    mount();
    await user.click(
      await screen.findByRole('button', { name: 'Terminar sessão em todos os aparelhos' }),
    );
    expect(await screen.findByText('Página de entrada')).toBeInTheDocument();
    expect(api.signOut).toHaveBeenCalledWith('global');
  });

  it('se terminar a sessão falhar, mostra o erro e fica no perfil', async () => {
    const user = userEvent.setup({ delay: null });
    api.getMyProfile.mockResolvedValue(student);
    api.signOut.mockRejectedValue(new Error('Algo correu mal. Tenta outra vez.'));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Terminar sessão' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo correu mal. Tenta outra vez.');
    expect(screen.queryByText('Página de entrada')).toBeNull();
  });

  it('se o perfil não carregar, mostra a mensagem do erro e permite tentar de novo', async () => {
    const user = userEvent.setup({ delay: null });
    api.getMyProfile.mockRejectedValueOnce(new Error('Não encontrámos o que procuras.'));
    api.getMyProfile.mockResolvedValueOnce(student);
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não encontrámos o que procuras.');
    await user.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByText('Teste da Silva Estudante')).toBeInTheDocument();
  });
});
