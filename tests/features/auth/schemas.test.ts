import { describe, expect, it } from 'vitest';
import { signInSchema, signUpSchema, type SignUpInput } from '@/features/auth/schemas';

const academic = {
  course: 'Gestão',
  curricularYear: '2.º ano',
  shift: 'Manhã',
  classGroup: 'A',
};

const base = {
  fullName: 'Maria da Silva',
  email: 'maria@example.com',
  phone: '912345678',
  password: '12345678',
  affiliation: 'student' as const,
  academic,
  termsAccepted: true as const,
};

function issues(input: unknown) {
  const r = signUpSchema.safeParse(input);
  if (r.success) throw new Error('esperava falha');
  return r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

describe('signUpSchema', () => {
  it('o resultado é atribuível a SignUpInput', () => {
    const out: SignUpInput = signUpSchema.parse(base);
    expect(out.affiliation).toBe('student');
  });

  it('aceita um estudante completo', () => {
    expect(signUpSchema.parse(base)).toEqual(base);
  });

  it('estudante sem academic falha em todos os campos académicos', () => {
    const noAcademic = { ...base, academic: undefined };
    expect(issues(noAcademic)).toEqual([
      { path: 'academic.course', message: 'Indica o teu curso.' },
      { path: 'academic.curricularYear', message: 'Indica o teu ano curricular.' },
      { path: 'academic.shift', message: 'Indica o teu turno.' },
      { path: 'academic.classGroup', message: 'Indica a tua turma.' },
    ]);
  });

  it('mostra todos os erros de uma vez: termos, telefone e dados académicos', () => {
    const got = issues({ ...base, termsAccepted: false, phone: '81234', academic: undefined });
    expect(got).toEqual(
      expect.arrayContaining([
        {
          path: 'termsAccepted',
          message: 'Tens de aceitar os Termos e a Política de privacidade.',
        },
        {
          path: 'phone',
          message: 'Indica um número angolano com 9 algarismos, a começar por 9.',
        },
        { path: 'academic.course', message: 'Indica o teu curso.' },
        { path: 'academic.curricularYear', message: 'Indica o teu ano curricular.' },
        { path: 'academic.shift', message: 'Indica o teu turno.' },
        { path: 'academic.classGroup', message: 'Indica a tua turma.' },
      ]),
    );
    expect(got).toHaveLength(6);
  });

  it('estudante com campos académicos vazios ou só espaços falha', () => {
    const got = issues({ ...base, academic: { ...academic, course: '   ', shift: '' } });
    expect(got).toContainEqual({ path: 'academic.course', message: 'Indica o teu curso.' });
    expect(got).toContainEqual({ path: 'academic.shift', message: 'Indica o teu turno.' });
  });

  it.each(['teacher', 'staff'] as const)('%s com academic preenchido passa sem academic', (a) => {
    const out = signUpSchema.parse({ ...base, affiliation: a });
    expect(out).not.toHaveProperty('academic');
    expect(out.affiliation).toBe(a);
  });

  it('professor sem academic passa', () => {
    const rest = { ...base, academic: undefined };
    expect(signUpSchema.parse({ ...rest, affiliation: 'teacher' })).not.toHaveProperty('academic');
  });

  it('normaliza o telefone', () => {
    expect(signUpSchema.parse({ ...base, phone: '912 345 678' }).phone).toBe('912345678');
    expect(signUpSchema.parse({ ...base, phone: '+244 912 345 678' }).phone).toBe('912345678');
    expect(signUpSchema.parse({ ...base, phone: '00244912345678' }).phone).toBe('912345678');
  });

  it.each(['81234', '912 34 56', ''])('recusa o telefone %j', (phone) => {
    expect(issues({ ...base, phone })).toContainEqual({
      path: 'phone',
      message: 'Indica um número angolano com 9 algarismos, a começar por 9.',
    });
  });

  it('recusa palavra-passe com menos de 8 caracteres', () => {
    expect(issues({ ...base, password: '1234567' })).toContainEqual({
      path: 'password',
      message: 'Pelo menos 8 caracteres.',
    });
  });

  it('não faz trim à palavra-passe', () => {
    expect(signUpSchema.parse({ ...base, password: '  1234  ' }).password).toBe('  1234  ');
  });

  it('exige termsAccepted verdadeiro', () => {
    expect(issues({ ...base, termsAccepted: false })).toContainEqual({
      path: 'termsAccepted',
      message: 'Tens de aceitar os Termos e a Política de privacidade.',
    });
  });

  it('nome com 1 caractere falha; nome longo demais falha', () => {
    expect(issues({ ...base, fullName: 'A' })).toContainEqual({
      path: 'fullName',
      message: 'Escreve o teu nome completo.',
    });
    expect(issues({ ...base, fullName: '  A  ' })).toContainEqual({
      path: 'fullName',
      message: 'Escreve o teu nome completo.',
    });
    expect(issues({ ...base, fullName: 'a'.repeat(121) })).toContainEqual({
      path: 'fullName',
      message: 'Demasiado longo.',
    });
    expect(signUpSchema.parse({ ...base, fullName: 'a'.repeat(120) }).fullName).toHaveLength(120);
  });

  it('email inválido falha e é normalizado', () => {
    expect(issues({ ...base, email: 'nao-e-email' })).toContainEqual({
      path: 'email',
      message: 'Indica um email válido.',
    });
    expect(signUpSchema.parse({ ...base, email: '  Maria@Example.COM ' }).email).toBe(
      'maria@example.com',
    );
  });

  it('faz trim a todos os campos de texto', () => {
    const out = signUpSchema.parse({
      ...base,
      fullName: '  Maria da Silva ',
      academic: {
        course: ' Gestão ',
        curricularYear: ' 2.º ano ',
        shift: ' Manhã ',
        classGroup: ' A ',
      },
    });
    expect(out.fullName).toBe('Maria da Silva');
    expect((out as SignUpInput).academic).toEqual(academic);
  });

  it.each([
    ['course', 80],
    ['curricularYear', 20],
    ['shift', 20],
    ['classGroup', 20],
  ] as const)('limita %s a %i caracteres', (field, max) => {
    const ok = { ...base, academic: { ...academic, [field]: 'x'.repeat(max) } };
    expect(signUpSchema.safeParse(ok).success).toBe(true);
    expect(
      issues({ ...base, academic: { ...academic, [field]: 'x'.repeat(max + 1) } }),
    ).toContainEqual({ path: `academic.${field}`, message: 'Demasiado longo.' });
  });

  it('recusa vínculo desconhecido', () => {
    expect(signUpSchema.safeParse({ ...base, affiliation: 'admin' }).success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('aceita email e palavra-passe', () => {
    expect(signInSchema.parse({ email: ' A@b.co ', password: 'x' })).toEqual({
      email: 'a@b.co',
      password: 'x',
    });
  });
  it('recusa email inválido e palavra-passe vazia', () => {
    const r = signInSchema.safeParse({ email: 'x', password: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain('Indica um email válido.');
      expect(msgs).toContain('Indica a tua palavra-passe.');
    }
  });
});
