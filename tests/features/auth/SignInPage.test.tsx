import { screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getMyProfile: vi.fn(),
}));
vi.mock('@/features/auth/api', () => api);

import { SignInPage } from '@/features/auth/SignInPage';
import { renderRoutes } from '../../utils/renderRoutes';

function mount(entry = '/entrar') {
  return renderRoutes(
    [
      { path: '/entrar', element: <SignInPage /> },
      { path: '/perfil', element: <p>Página do perfil</p> },
      { path: '/pedidos', element: <p>Página dos pedidos</p> },
    ],
    entry,
  );
}

async function signInWith(user: UserEvent, password = 'segredo-de-teste') {
  await user.type(await screen.findByLabelText('Email'), 'estudante@exemplo.test');
  await user.type(screen.getByLabelText('Palavra-passe'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SignInPage (K01)', () => {
  it('tem o título com PAIÁ realçado, um só h1 e o título da página', async () => {
    mount();
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Entra no PAIÁ');
    expect(h1.querySelector('mark')).toHaveTextContent('PAIÁ');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe('Entrar · PAIÁ');
  });

  it('voltar=//evil.com não sai da aplicação: vai para /perfil', async () => {
    const user = userEvent.setup({ delay: null });
    api.signIn.mockResolvedValue(undefined);
    const { router } = mount('/entrar?voltar=%2F%2Fevil.com');
    await signInWith(user);
    expect(await screen.findByText('Página do perfil')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/perfil');
  });

  it('voltar com caminho relativo seguro volta para lá', async () => {
    const user = userEvent.setup({ delay: null });
    api.signIn.mockResolvedValue(undefined);
    mount('/entrar?voltar=%2Fpedidos');
    await signInWith(user);
    expect(await screen.findByText('Página dos pedidos')).toBeInTheDocument();
    expect(api.signIn).toHaveBeenCalledWith({
      email: 'estudante@exemplo.test',
      password: 'segredo-de-teste',
    });
  });

  it('palavra-passe errada mostra o erro num alerta acima do botão', async () => {
    const user = userEvent.setup({ delay: null });
    api.signIn.mockRejectedValue(new Error('Email ou palavra-passe incorretos.'));
    mount();
    await signInWith(user, 'errada-123');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email ou palavra-passe incorretos.');
    const submit = screen.getByRole('button', { name: 'Entrar' });
    expect(alert.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('o botão Mostrar revela e volta a esconder a palavra-passe', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    const password = await screen.findByLabelText('Palavra-passe');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar palavra-passe' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Esconder palavra-passe' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('Esqueci-me da palavra-passe está desativado, com a nota ligada', async () => {
    mount();
    const forgot = await screen.findByRole('button', { name: 'Esqueci-me da palavra-passe' });
    expect(forgot).toHaveAttribute('aria-disabled', 'true');
    expect(forgot).toHaveAccessibleDescription('Disponível em breve');
  });

  it('tem as ligações Criar conta e Continuar sem conta', async () => {
    mount();
    expect(await screen.findByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/criar-conta',
    );
    expect(screen.getByRole('link', { name: 'Continuar sem conta' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Voltar' })).toBeInTheDocument();
  });
});
