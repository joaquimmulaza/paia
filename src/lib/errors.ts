export const MESSAGES = {
  generic: 'Algo correu mal. Tenta outra vez.',
  invalidCredentials: 'Email ou palavra-passe errados.',
  signUpFailed: 'Não foi possível criar a conta. Se já tens conta, entra.',
  emailNotConfirmed: 'Confirma o teu email antes de entrares.',
  weakPassword: 'Pelo menos 8 caracteres.',
  notFound: 'Não encontrámos o que procuras.',
  notAllowed: 'Não tens permissão para fazer isto.',
  termsRequired: 'Tens de aceitar os Termos e a Política de privacidade.',
} as const;

const AUTH_BY_CODE: Record<string, string> = {
  invalid_credentials: MESSAGES.invalidCredentials,
  user_already_exists: MESSAGES.signUpFailed,
  email_exists: MESSAGES.signUpFailed,
  email_not_confirmed: MESSAGES.emailNotConfirmed,
  weak_password: MESSAGES.weakPassword,
};

const AUTH_BY_MESSAGE: Record<string, string> = {
  'Invalid login credentials': MESSAGES.invalidCredentials,
  'User already registered': MESSAGES.signUpFailed,
  'Email not confirmed': MESSAGES.emailNotConfirmed,
};

const DB_BY_CODE: Record<string, string> = {
  NOT_FOUND: MESSAGES.notFound,
  NOT_ALLOWED: MESSAGES.notAllowed,
  TERMS_REQUIRED: MESSAGES.termsRequired,
};

function lookup(table: Record<string, string>, key: string | undefined): string | undefined {
  return key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
}

/** Traduz erros do Supabase Auth (código primeiro, depois mensagem). Nunca devolve texto técnico. */
export function translateAuthError(err: { message?: string; code?: string } | null): string {
  if (!err) return MESSAGES.generic;
  return lookup(AUTH_BY_CODE, err.code) ?? lookup(AUTH_BY_MESSAGE, err.message) ?? MESSAGES.generic;
}

/** Traduz os códigos de erro levantados pelas funções e triggers da base de dados. */
export function translateDbError(code: string): string {
  return lookup(DB_BY_CODE, code) ?? MESSAGES.generic;
}
