export interface Category {
  id: string;
  name: string;
  slug: string;
}

export type ProductSort = 'recentes' | 'preco-asc' | 'preco-desc';

export interface Rating {
  avg: number;
  count: number;
}

export interface CatalogProduct {
  id: string;
  name: string;
  priceKz: number;
  stock: number;
  /** Texto bruto da API (microssegundos); nunca passar por `Date`. */
  createdAt: string;
  storeName: string;
  storeSlug: string;
  /** `null` quando a categoria está escondida. */
  categorySlug: string | null;
  mainImagePath: string | null;
}

export interface ProductDetail {
  id: string;
  name: string;
  description: string | null;
  priceKz: number;
  stock: number;
  createdAt: string;
  categoryName: string | null;
  categorySlug: string | null;
  storeName: string;
  storeSlug: string;
  storeRating: Rating | null;
  images: { path: string; position: number }[];
}

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  logoPath: string | null;
  productCount: number;
  rating: Rating | null;
}

export type StoreDetail = StoreSummary & {
  productCategories: { name: string; slug: string }[];
};

export type FeaturedStore = StoreSummary & { isPromoted: boolean };

export interface ProductCursor {
  createdAt: string;
  priceKz: number;
  id: string;
}
