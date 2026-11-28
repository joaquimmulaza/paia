export type StoreStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';
export type MyStoreKind = 'none' | 'draft' | 'pending' | 'rejected' | 'approved' | 'suspended';

export interface MyStore {
  id: string;
  name: string;
  slug: string;
  /** Vazia num rascunho que ainda não a tem. */
  description: string;
  categoryId: string;
  logoPath: string | null;
  coverPath: string | null;
  status: StoreStatus;
  kind: MyStoreKind;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  publishedProductsCount: number;
  hiddenProductsCount: number;
  soldOutProductsCount: number;
  /** A resposta da administração; só existe com a loja rejeitada. */
  lastMessage: string | null;
}

export interface StoreDecision {
  decision: 'approved' | 'rejected' | 'suspended' | 'reactivated';
  message: string | null;
  createdAt: string;
}

export interface SaveStoreInput {
  name: string;
  description: string;
  categoryId: string;
  logoPath: string | null;
  coverPath: string | null;
}

export type ProductFilter = 'all' | 'published' | 'sold_out' | 'hidden';

/** Cursor (created_at, id); o createdAt segue em bruto (microssegundos). */
export interface Cursor {
  createdAt: string;
  id: string;
}

export interface Page<T> {
  items: T[];
  next: Cursor | null;
}

export interface MyProduct {
  id: string;
  name: string;
  priceKz: number;
  stock: number;
  isPublished: boolean;
  moderationStatus: 'visible' | 'hidden';
  categoryId: string;
  createdAt: string;
  mainImagePath: string | null;
}

export interface ProductImage {
  id: string;
  path: string;
  position: number;
}

export interface MyProductDetail extends MyProduct {
  description: string;
  moderationReason: string | null;
  images: ProductImage[];
}

export interface ProductInput {
  storeId: string;
  categoryId: string;
  name: string;
  description: string;
  priceKz: number;
  stock: number;
}
