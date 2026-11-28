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

// --- Produto (V06 e V06b) ---------------------------------------------------------------

export const PRODUCT_NAME_MAX = 80;
export const PRODUCT_DESCRIPTION_MAX = 1000;
export const PRODUCT_PRICE_MAX = 10_000_000;
export const PRODUCT_STOCK_MAX = 9999;

export interface ProductFormValues {
  name: string;
  description: string;
  categoryId: string;
  /** Como está escrito no campo (texto). */
  price: string;
  stock: string;
  publish: boolean;
}

export type ProductField = 'name' | 'categoryId' | 'price' | 'stock';
export type ProductErrors = Partial<Record<ProductField, string>>;

/** Pela ordem do formulário: o primeiro com erro recebe o foco. */
export const PRODUCT_FIELDS: readonly ProductField[] = ['name', 'categoryId', 'price', 'stock'];

/** Um inteiro sem sinal nem casas decimais; os espaços (de agrupar milhares) não contam. */
export function parseWhole(text: string): number | null {
  const digits = text.replace(/\s/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

export function validateProduct(values: ProductFormValues): ProductErrors {
  const errors: ProductErrors = {};
  if (values.name.trim() === '') errors.name = MESSAGES.productNameRequired;
  if (values.categoryId === '') errors.categoryId = MESSAGES.categoryNotFound;
  const price = parseWhole(values.price);
  if (price === null || price < 1) errors.price = MESSAGES.productPriceInvalid;
  else if (price > PRODUCT_PRICE_MAX) errors.price = MESSAGES.productPriceTooHigh;
  const stock = parseWhole(values.stock);
  if (stock === null || stock > PRODUCT_STOCK_MAX) errors.stock = MESSAGES.productStockInvalid;
  return errors;
}
