export const MESSAGES = {
  generic: 'Algo correu mal. Tenta outra vez.',
  invalidCredentials: 'Email ou palavra-passe errados.',
  signUpFailed: 'Não foi possível criar a conta. Se já tens conta, entra.',
  signUpDataRejected: 'Não foi possível criar a conta. Revê os dados e tenta outra vez.',
  emailNotConfirmed: 'Confirma o teu email antes de entrares.',
  weakPassword: 'Pelo menos 8 caracteres.',
  notFound: 'Não encontrámos o que procuras.',
  notAllowed: 'Não tens permissão para fazer isto.',
  termsRequired: 'Tens de aceitar os Termos e a Política de privacidade.',
  invalidPhone: 'Indica um número angolano com 9 algarismos, a começar por 9.',
  invalidName: 'Escreve o teu nome completo.',
  academicRequired: 'Preenche os dados académicos.',
  invalidAcademic: 'Revê os dados académicos.',
  invalidText: 'Há caracteres que não podemos aceitar.',
  invalidAffiliation: 'Escolhe o teu vínculo à UGS.',
  storeNotApproved: 'Esta loja não está aprovada.',
  invalidPeriod: 'A data de fim tem de ser depois da data de início.',
  featureExists: 'Esta loja já está em destaque.',
  invalidPosition: 'A ordem tem de ser 0 ou mais.',
  invalidCursor: 'Não foi possível carregar mais resultados. Tenta outra vez.',
} as const;

const AUTH_BY_CODE: Record<string, string> = {
  invalid_credentials: MESSAGES.invalidCredentials,
  user_already_exists: MESSAGES.signUpFailed,
  email_exists: MESSAGES.signUpFailed,
  email_not_confirmed: MESSAGES.emailNotConfirmed,
  weak_password: MESSAGES.weakPassword,
  // Entrada que o GoTrue recusa (por exemplo, palavra-passe longa demais): sem detalhe técnico.
  validation_failed: MESSAGES.generic,
};

const AUTH_BY_MESSAGE: Record<string, string> = {
  'Invalid login credentials': MESSAGES.invalidCredentials,
  'User already registered': MESSAGES.signUpFailed,
  'Email not confirmed': MESSAGES.emailNotConfirmed,
  'Database error saving new user': MESSAGES.signUpDataRejected,
};

const DB_BY_CODE: Record<string, string> = {
  NOT_FOUND: MESSAGES.notFound,
  NOT_ALLOWED: MESSAGES.notAllowed,
  TERMS_REQUIRED: MESSAGES.termsRequired,
  INVALID_PHONE: MESSAGES.invalidPhone,
  INVALID_NAME: MESSAGES.invalidName,
  ACADEMIC_REQUIRED: MESSAGES.academicRequired,
  INVALID_ACADEMIC: MESSAGES.invalidAcademic,
  INVALID_TEXT: MESSAGES.invalidText,
  INVALID_AFFILIATION: MESSAGES.invalidAffiliation,
  STORE_NOT_APPROVED: MESSAGES.storeNotApproved,
  INVALID_PERIOD: MESSAGES.invalidPeriod,
  FEATURE_EXISTS: MESSAGES.featureExists,
  INVALID_POSITION: MESSAGES.invalidPosition,
  INVALID_CURSOR: MESSAGES.invalidCursor,
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

/** Verdadeiro se o código é um dos que a base de dados levanta (e que `translateDbError` conhece). */
export function isKnownDbCode(code: string | undefined): code is string {
  return lookup(DB_BY_CODE, code) !== undefined;
}
