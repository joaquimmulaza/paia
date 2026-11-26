import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getMyProfile: vi.fn(),
}));
vi.mock('@/features/auth/api', () => api);

import { SignUpPage } from '@/features/auth/SignUpPage';
import { renderRoutes } from '../../utils/renderRoutes';

function mount() {
  return renderRoutes(
    [
      { path: '/criar-conta', element: <SignUpPage /> },
      { path: '/perfil', element: <p>Página do perfil</p> },
      { path: '/entrar', element: <p>Página de entrada</p> },
    ],
    '/criar-conta',
  );
}

/** Preenche tudo o que é válido para um estudante; `skip` deixa campos em branco. */
async function fillStudent(user: UserEvent, skip: string[] = []) {
  const values: Record<string, string> = {
    'Nome completo': 'Teste Estudante',
    Email: 'estudante@exemplo.test',
    Telefone: '923 456 789',
    'Palavra-passe': 'segredo-de-teste',
    Curso: 'Engenharia Informática',
    'Ano curricular': '2.º ano',
    Turno: 'Manhã',
    Turma: 'A',
  };
  for (const [label, value] of Object.entries(values)) {
    if (skip.includes(label)) continue;
    await user.type(screen.getByLabelText(label), value);
  }
  await user.click(screen.getByRole('checkbox', { name: /Aceito os Termos de utilização/ }));
}

function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SignUpPage (K02)', () => {
  it('tem um só h1 e define o título da página', async () => {
    mount();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Criar conta');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe('Criar conta · PAIÁ');
  });

  it('começa com Estudante escolhido e mostra os dados académicos', async () => {
    mount();
    const group = await screen.findByRole('radiogroup', { name: 'Na UGS, és' });
    expect(within(group).getByRole('radio', { name: 'Estudante' })).toBeChecked();
    expect(screen.getByRole('group', { name: 'Dados académicos' })).toBeInTheDocument();
  });

  it('escolher Professor esconde a secção Dados académicos', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await user.click(await screen.findByRole('radio', { name: 'Professor' }));
    expect(screen.queryByRole('group', { name: 'Dados académicos' })).toBeNull();
  });

  it('os campos académicos são texto livre, sem placeholder e sem listas', async () => {
    mount();
    const group = await screen.findByRole('group', { name: 'Dados académicos' });
    const inputs = within(group).getAllByRole('textbox');
    expect(inputs).toHaveLength(4);
    for (const input of inputs) {
      expect(input).toHaveAttribute('type', 'text');
      expect(input).not.toHaveAttribute('placeholder');
      expect(input).toHaveAttribute('autocomplete', 'off');
    }
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('listbox')).toHaveLength(0);
  });

  it('estudante sem curso: mensagem junto ao campo, aria-invalid, aria-describedby e foco', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await screen.findByLabelText('Curso');
    await fillStudent(user, ['Curso']);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    const course = screen.getByLabelText('Curso');
    const message = await screen.findByText('Indica o teu curso.');
    expect(course).toHaveAttribute('aria-invalid', 'true');
    expect(course.getAttribute('aria-describedby')?.split(' ')).toContain(message.id);
    expect(course).toHaveFocus();
    expect(api.signUp).not.toHaveBeenCalled();
  });

  it('com tudo em branco, o foco vai para o primeiro campo com erro', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await user.click(await screen.findByRole('button', { name: 'Criar conta' }));
    await waitFor(() => expect(screen.getByLabelText('Nome completo')).toHaveFocus());
    expect(screen.getByText('Escreve o teu nome completo.')).toBeInTheDocument();
    expect(
      screen.getByText('Tens de aceitar os Termos e a Política de privacidade.'),
    ).toBeInTheDocument();
  });

  it('dados válidos chamam signUp uma vez; o segundo clique durante o envio não conta', async () => {
    const user = userEvent.setup({ delay: null });
    const pending = deferred();
    api.signUp.mockReturnValue(pending.promise);
    const { router } = mount();
    await screen.findByLabelText('Curso');
    await fillStudent(user);

    const submit = screen.getByRole('button', { name: 'Criar conta' });
    await user.click(submit);
    await waitFor(() => expect(submit).toHaveAttribute('aria-busy', 'true'));
    await user.click(submit);
    expect(api.signUp).toHaveBeenCalledTimes(1);
    expect(api.signUp).toHaveBeenCalledWith({
      fullName: 'Teste Estudante',
      email: 'estudante@exemplo.test',
      phone: '923456789',
      password: 'segredo-de-teste',
      affiliation: 'student',
      academic: {
        course: 'Engenharia Informática',
        curricularYear: '2.º ano',
        shift: 'Manhã',
        classGroup: 'A',
      },
      termsAccepted: true,
    });

    await act(async () => pending.resolve());
    expect(await screen.findByText('Página do perfil')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/perfil');
  });

  it('professor que preencheu dados académicos antes de mudar não os envia', async () => {
    const user = userEvent.setup({ delay: null });
    api.signUp.mockResolvedValue(undefined);
    mount();
    await screen.findByLabelText('Curso');
    await fillStudent(user);
    await user.click(screen.getByRole('radio', { name: 'Professor' }));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await screen.findByText('Página do perfil');
    expect(api.signUp).toHaveBeenCalledTimes(1);
    const payload = api.signUp.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.affiliation).toBe('teacher');
    expect(payload).not.toHaveProperty('academic');
  });

  it('erro do servidor aparece num alerta acima do botão, e o botão volta a ficar ativo', async () => {
    const user = userEvent.setup({ delay: null });
    api.signUp.mockRejectedValue(new Error('Não foi possível criar a conta. Tenta outra vez.'));
    mount();
    await screen.findByLabelText('Curso');
    await fillStudent(user);
    const submit = screen.getByRole('button', { name: 'Criar conta' });
    await user.click(submit);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível criar a conta. Tenta outra vez.');
    expect(alert.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(submit).not.toHaveAttribute('aria-busy');
    expect(submit).toBeEnabled();
  });

  it('com a palavra-passe curta, «Pelo menos 8 caracteres.» aparece uma só vez', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await user.type(await screen.findByLabelText('Palavra-passe'), 'curta');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    await screen.findByText('Escreve o teu nome completo.');
    expect(screen.getAllByText('Pelo menos 8 caracteres.')).toHaveLength(1);
    expect(screen.getByLabelText('Palavra-passe')).toHaveAccessibleDescription(
      'Pelo menos 8 caracteres.',
    );
  });

  it('o telefone e a palavra-passe têm as ajudas ligadas ao campo', async () => {
    mount();
    const phone = await screen.findByLabelText('Telefone');
    expect(phone).toHaveAttribute('inputmode', 'tel');
    expect(phone).toHaveAttribute('placeholder', '9XX XXX XXX');
    expect(phone).toHaveAccessibleDescription(
      'Só é partilhado com o vendedor depois de ele aceitar um pedido teu.',
    );
    expect(screen.getByLabelText('Palavra-passe')).toHaveAccessibleDescription(
      'Pelo menos 8 caracteres.',
    );
  });
});
