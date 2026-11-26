import { describe, expect, it } from 'vitest';
import { translateAuthError, translateDbError } from '@/lib/errors';

const GENERIC = 'Algo correu mal. Tenta outra vez.';

describe('translateAuthError', () => {
  it.each([
    [{ message: 'Invalid login credentials' }, 'Email ou palavra-passe errados.'],
    [{ code: 'invalid_credentials' }, 'Email ou palavra-passe errados.'],
    [
      { message: 'User already registered' },
      'Não foi possível criar a conta. Se já tens conta, entra.',
    ],
    [{ code: 'user_already_exists' }, 'Não foi possível criar a conta. Se já tens conta, entra.'],
    [{ code: 'email_exists' }, 'Não foi possível criar a conta. Se já tens conta, entra.'],
    [{ message: 'Email not confirmed' }, 'Confirma o teu email antes de entrares.'],
    [{ code: 'email_not_confirmed' }, 'Confirma o teu email antes de entrares.'],
    [{ code: 'weak_password' }, 'Pelo menos 8 caracteres.'],
  ])('traduz %j', (err, expected) => {
    expect(translateAuthError(err)).toBe(expected);
  });

  it('o código tem prioridade sobre a mensagem', () => {
    expect(
      translateAuthError({ code: 'weak_password', message: 'Invalid login credentials' }),
    ).toBe('Pelo menos 8 caracteres.');
  });

  it.each([null, {}, { message: 'boom: connection refused 10.0.0.1' }, { code: 'xyz' }])(
    'dá a mensagem genérica para %j',
    (err) => {
      expect(translateAuthError(err)).toBe(GENERIC);
    },
  );

  it('não revela se a conta existe: credenciais erradas e conta inexistente iguais', () => {
    expect(translateAuthError({ code: 'invalid_credentials' })).toBe(
      translateAuthError({ message: 'Invalid login credentials' }),
    );
    const msg = translateAuthError({ code: 'user_already_exists' });
    expect(msg).not.toMatch(/já (está|existe)|registad/i);
  });

  it('não deixa passar texto técnico', () => {
    expect(translateAuthError({ message: 'JWT expired at pg_catalog' })).not.toMatch(/JWT|pg_/);
  });
});

describe('translateDbError', () => {
  it.each([
    ['NOT_FOUND', 'Não encontrámos o que procuras.'],
    ['NOT_ALLOWED', 'Não tens permissão para fazer isto.'],
    ['TERMS_REQUIRED', 'Tens de aceitar os Termos e a Política de privacidade.'],
    ['23505 duplicate key value', GENERIC],
    ['', GENERIC],
  ])('traduz %s', (code, expected) => {
    expect(translateDbError(code)).toBe(expected);
  });
});

describe('códigos dos triggers de registo', () => {
  it.each([
    ['INVALID_PHONE', 'Indica um número angolano com 9 algarismos, a começar por 9.'],
    ['INVALID_NAME', 'Escreve o teu nome completo.'],
    ['ACADEMIC_REQUIRED', 'Preenche os dados académicos.'],
    ['INVALID_ACADEMIC', 'Revê os dados académicos.'],
    ['INVALID_TEXT', 'Há caracteres que não podemos aceitar.'],
    ['INVALID_AFFILIATION', 'Escolhe o teu vínculo à UGS.'],
  ])('translateDbError(%s)', (code, expected) => {
    expect(translateDbError(code)).toBe(expected);
  });
});

describe('erro genérico do trigger no registo', () => {
  it('Database error saving new user tem mensagem própria', () => {
    expect(translateAuthError({ message: 'Database error saving new user' })).toBe(
      'Não foi possível criar a conta. Revê os dados e tenta outra vez.',
    );
  });
});
