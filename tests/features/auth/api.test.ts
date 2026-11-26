import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, rpc } = vi.hoisted(() => ({
  auth: { signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() },
  rpc: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth, rpc } }));

import { getMyProfile, signIn, signOut, signUp } from '@/features/auth/api';
import type { SignUpInput } from '@/features/auth/schemas';

const student: SignUpInput = {
  fullName: 'Maria da Silva',
  email: 'maria@example.com',
  phone: '912345678',
  password: 'segredo123',
  affiliation: 'student',
  academic: { course: 'Gestão', curricularYear: '2.º ano', shift: 'Manhã', classGroup: 'A' },
  termsAccepted: true,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('signUp', () => {
  it('envia os metadados em snake_case', async () => {
    auth.signUp.mockResolvedValue({ error: null });
    await signUp(student);
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'maria@example.com',
      password: 'segredo123',
      options: {
        data: {
          full_name: 'Maria da Silva',
          phone: '912345678',
          affiliation: 'student',
          terms_accepted: true,
          academic: {
            course: 'Gestão',
            curricular_year: '2.º ano',
            shift: 'Manhã',
            class_group: 'A',
          },
        },
      },
    });
  });

  it('não envia academic para professores', async () => {
    auth.signUp.mockResolvedValue({ error: null });
    await signUp({ ...student, academic: undefined, affiliation: 'teacher' });
    const data = auth.signUp.mock.calls[0]![0].options.data;
    expect(data).not.toHaveProperty('academic');
    expect(data.affiliation).toBe('teacher');
  });

  it('não envia academic mesmo que um chamador o passe a um professor', async () => {
    auth.signUp.mockResolvedValue({ error: null });
    await signUp({ ...student, affiliation: 'staff' });
    expect(auth.signUp.mock.calls[0]![0].options.data).not.toHaveProperty('academic');
  });

  it('traduz códigos dos triggers através de translateDbError', async () => {
    auth.signUp.mockResolvedValue({ error: { message: 'INVALID_PHONE', status: 500 } });
    await expect(signUp(student)).rejects.toThrow(
      'Indica um número angolano com 9 algarismos, a começar por 9.',
    );
  });

  it('traduz erros do Auth e esconde texto técnico', async () => {
    auth.signUp.mockResolvedValue({
      error: { message: 'User already registered', code: 'user_already_exists' },
    });
    await expect(signUp(student)).rejects.toThrow(
      'Não foi possível criar a conta. Se já tens conta, entra.',
    );
    auth.signUp.mockResolvedValue({ error: { message: 'Database error saving new user' } });
    await expect(signUp(student)).rejects.toThrow(
      'Não foi possível criar a conta. Revê os dados e tenta outra vez.',
    );
    auth.signUp.mockResolvedValue({ error: { message: 'boom 10.0.0.1' } });
    await expect(signUp(student)).rejects.toThrow('Algo correu mal. Tenta outra vez.');
  });

  it('erros de rede também dão mensagem genérica', async () => {
    auth.signUp.mockRejectedValue(new TypeError('fetch failed 127.0.0.1'));
    await expect(signUp(student)).rejects.toThrow('Algo correu mal. Tenta outra vez.');
  });
});

describe('signIn', () => {
  it('chama signInWithPassword', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await signIn({ email: 'a@b.co', password: 'x' });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'x' });
  });

  it('palavra-passe errada e email desconhecido dão a mesma mensagem', async () => {
    const err = { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 };
    auth.signInWithPassword.mockResolvedValue({ error: err });
    const wrongPassword = await signIn({ email: 'existe@b.co', password: 'errada' }).catch(
      (e: Error) => e.message,
    );
    const unknownEmail = await signIn({ email: 'nao@b.co', password: 'errada' }).catch(
      (e: Error) => e.message,
    );
    expect(wrongPassword).toBe('Email ou palavra-passe errados.');
    expect(unknownEmail).toBe(wrongPassword);
  });
});

describe('signOut', () => {
  it.each(['local', 'global'] as const)('passa o scope %s', async (scope) => {
    auth.signOut.mockResolvedValue({ error: null });
    await signOut(scope);
    expect(auth.signOut).toHaveBeenCalledWith({ scope });
  });
  it('traduz erros', async () => {
    auth.signOut.mockResolvedValue({ error: { message: 'boom' } });
    await expect(signOut('local')).rejects.toThrow('Algo correu mal. Tenta outra vez.');
  });
});

describe('getMyProfile', () => {
  const row = {
    full_name: 'Maria',
    phone: '912345678',
    affiliation: 'student',
    course: 'Gestão',
    curricular_year: '2.º ano',
    shift: 'Manhã',
    class_group: 'A',
    is_admin: false,
  };

  it('chama get_my_profile e devolve o perfil', async () => {
    rpc.mockResolvedValue({ data: [row], error: null });
    expect(await getMyProfile()).toEqual({
      fullName: 'Maria',
      phone: '912345678',
      affiliation: 'student',
      course: 'Gestão',
      curricularYear: '2.º ano',
      shift: 'Manhã',
      classGroup: 'A',
      isAdmin: false,
    });
    expect(rpc).toHaveBeenCalledWith('get_my_profile');
  });

  it('devolve campos académicos null para professores', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          ...row,
          affiliation: 'teacher',
          course: null,
          curricular_year: null,
          shift: null,
          class_group: null,
        },
      ],
      error: null,
    });
    const p = await getMyProfile();
    expect(p.course).toBeNull();
    expect(p.classGroup).toBeNull();
  });

  it('lança «não encontrado» quando não há linha', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(getMyProfile()).rejects.toThrow('Não encontrámos o que procuras.');
  });

  it('traduz erros da base de dados', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'NOT_ALLOWED', code: 'P0001' } });
    await expect(getMyProfile()).rejects.toThrow('Não tens permissão para fazer isto.');
    rpc.mockResolvedValue({ data: null, error: { message: 'relation x does not exist' } });
    await expect(getMyProfile()).rejects.toThrow('Algo correu mal. Tenta outra vez.');
  });
});
