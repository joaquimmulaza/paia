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
vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-test' } }, loading: false }),
}));

const toast = vi.hoisted(() => vi.fn());
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast,
}));

import { ProfilePage } from '@/features/auth/ProfilePage';
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

  it('o estudante vê o cartão A minha loja; Quero vender avisa que vem em breve', async () => {
    const user = userEvent.setup({ delay: null });
    api.getMyProfile.mockResolvedValue(student);
    mount();
    const shop = await screen.findByRole('region', { name: 'A minha loja' });
    expect(shop).toHaveTextContent(
      'Ainda não tens loja. Pede a tua: a equipa do PAIÁ analisa e responde.',
    );
    await user.click(screen.getByRole('button', { name: 'Quero vender' }));
    expect(toast).toHaveBeenCalledWith('Disponível em breve');
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
