import { MESSAGES } from '@/lib/errors';

export const STORE_NAME_MAX = 60;
export const STORE_DESCRIPTION_MAX = 280;

export interface StoreFormValues {
  name: string;
  description: string;
  categoryId: string;
  logoPath: string | null;
  coverPath: string | null;
}

export type StoreField = 'name' | 'description' | 'categoryId' | 'logoPath';
export type StoreErrors = Partial<Record<StoreField, string>>;

/** Pela ordem do formulário: o primeiro com erro recebe o foco. */
export const STORE_FIELDS: readonly StoreField[] = [
  'name',
  'description',
  'categoryId',
  'logoPath',
];

/** Caracteres como a base os conta (pontos de código), não unidades UTF-16. */
export function charCount(text: string): number {
  return Array.from(text).length;
}

/**
 * `draft`: o rascunho só exige nome e categoria (as colunas são `not null`).
 * `submit`: para enviar, também a descrição e o logótipo.
 */
export function validateStore(values: StoreFormValues, mode: 'draft' | 'submit'): StoreErrors {
  const errors: StoreErrors = {};
  if (values.name.trim() === '') errors.name = MESSAGES.storeNameRequired;
  if (values.categoryId === '') errors.categoryId = MESSAGES.storeCategoryRequired;
  if (mode === 'submit') {
    if (values.description.trim() === '') errors.description = MESSAGES.storeDescriptionRequired;
    if (!values.logoPath) errors.logoPath = MESSAGES.storeLogoRequired;
  }
  return errors;
}
