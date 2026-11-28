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
  featureExists: 'Esta loja já está em destaque. Encontra-a na lista.',
  invalidPosition: 'A ordem tem de ser 0 ou mais.',
  invalidCursor: 'Não foi possível carregar mais resultados. Tenta outra vez.',
  notStudent: 'Só os estudantes podem abrir uma loja.',
  storeLocked: 'A loja está em análise. Espera pela resposta para a mudar.',
  storeIncomplete: 'Falta preencher a descrição ou o logótipo.',
  noStore: 'Ainda não tens loja. Preenche os dados e guarda.',
  invalidTransition: 'Esta loja já não pode ser enviada para análise.',
  invalidPath: 'Não foi possível usar esta imagem. Escolhe outra.',
  photoRequired: 'Junta pelo menos uma foto.',
  invalidOrder: 'A ordem das fotos mudou. Atualizámos a lista; tenta outra vez.',
  categoryNotFound: 'Escolhe uma categoria disponível.',
  imageFormat: 'Este formato não é aceite. Escolhe uma foto JPG, PNG ou WebP.',
  uploadFailed: 'Não foi possível enviar a imagem. Verifica a ligação e tenta outra vez.',
  alreadyDecided:
    'Esta candidatura já foi decidida por outra pessoa da equipa. Atualizámos o estado.',
  messageRequired: 'Para recusar, diz à candidata o que deve corrigir.',
  /** A01b: a decisão falhou por um motivo que não é de negócio (ligação, servidor). */
  decisionFailed: 'Não foi possível guardar a decisão. Tenta outra vez.',
  storeNameRequired: 'Escreve o nome da loja.',
  storeDescriptionRequired: 'Diz em poucas palavras o que vendes.',
  storeCategoryRequired: 'Escolhe a categoria principal.',
  storeLogoRequired: 'Escolhe o logótipo ou uma foto da loja.',
  submitFailed:
    'Não foi possível enviar o pedido. Verifica a ligação e tenta outra vez. O que escreveste ficou guardado.',
  saveFailed:
    'Não foi possível guardar o rascunho. Verifica a ligação e tenta outra vez. O que escreveste continua aqui.',
  // V05b e V06b: produtos.
  productsLoadFailed:
    'Não foi possível carregar os produtos. Verifica a ligação e tenta outra vez.',
  productNameRequired: 'Escreve o nome do produto.',
  productPriceInvalid: 'O preço tem de ser pelo menos 1 Kz, sem casas decimais.',
  productPriceTooHigh: 'O preço pode ir até 10 000 000 Kz.',
  productStockInvalid: 'Indica um número inteiro, 0 ou mais.',
  productPhotosFull: 'Já tens 5 fotos. Remove uma para juntar outra.',
  productPhotosUploading: 'Espera que as fotos acabem de enviar e guarda outra vez.',
  storeImagesUploading: 'Espera que as imagens acabem de enviar e guarda outra vez.',
  /** V02b: o resumo dos campos em falta ao enviar. */
  missingFields: (n: number) =>
    n === 1
      ? 'Falta preencher 1 campo. Corrige-o e envia outra vez.'
      : `Falta preencher ${n} campos. Corrige-os e envia outra vez.`,
  /** `mb` com vírgula decimal quando não é inteiro (por exemplo 16,3). */
  imageTooLarge: (mb: number) =>
    `A imagem tem ${Number.isInteger(mb) ? mb : mb.toFixed(1).replace('.', ',')} MB. Escolhe uma com até 15 MB.`,
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
  NOT_STUDENT: MESSAGES.notStudent,
  STORE_LOCKED: MESSAGES.storeLocked,
  STORE_INCOMPLETE: MESSAGES.storeIncomplete,
  NO_STORE: MESSAGES.noStore,
  INVALID_TRANSITION: MESSAGES.invalidTransition,
  INVALID_PATH: MESSAGES.invalidPath,
  PHOTO_REQUIRED: MESSAGES.photoRequired,
  INVALID_ORDER: MESSAGES.invalidOrder,
  CATEGORY_NOT_FOUND: MESSAGES.categoryNotFound,
  ALREADY_DECIDED: MESSAGES.alreadyDecided,
  MESSAGE_REQUIRED: MESSAGES.messageRequired,
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
