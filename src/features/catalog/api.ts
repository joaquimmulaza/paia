import { MESSAGES, translateDbError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type {
  CatalogProduct,
  Category,
  FeaturedStore,
  ProductCursor,
  ProductDetail,
  ProductSort,
  Rating,
  StoreDetail,
  StoreSummary,
} from './types';

const DEFAULT_LIMIT = 24;

interface Reply {
  data: unknown;
  error: { message: string } | null;
}

/** Executa o pedido; qualquer falha (erro da base ou rede) vira `Error` com texto PT-AO. */
async function run<T>(request: () => PromiseLike<Reply>): Promise<T[]> {
  let result: Reply;
  try {
    result = await request();
  } catch {
    throw new Error(MESSAGES.generic);
  }
  if (result.error) throw new Error(translateDbError(result.error.message));
  return Array.isArray(result.data) ? (result.data as T[]) : [];
}

/** A média pode chegar como texto (numeric); sem avaliações é `null`. */
function toRating(avg: unknown, count: number | null): Rating | null {
  if (!count || count <= 0 || avg === null || avg === undefined) return null;
  const n = Number(avg);
  return Number.isFinite(n) ? { avg: n, count } : null;
}

export async function listCategories(): Promise<Category[]> {
  const rows = await run<Category>(() =>
    supabase.from('categories').select('id,name,slug').order('position'),
  );
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
}

interface ProductRow {
  id: string;
  name: string;
  price_kz: number;
  stock: number;
  created_at: string;
  store_name: string;
  store_slug: string;
  category_slug: string | null;
  main_image_path: string | null;
}

function toProduct(r: ProductRow): CatalogProduct {
  return {
    id: r.id,
    name: r.name,
    priceKz: r.price_kz,
    stock: r.stock,
    createdAt: r.created_at,
    storeName: r.store_name,
    storeSlug: r.store_slug,
    categorySlug: r.category_slug ?? null,
    mainImagePath: r.main_image_path ?? null,
  };
}

export async function searchProducts(p: {
  q?: string;
  categorySlug?: string;
  storeSlug?: string;
  sort: ProductSort;
  after?: ProductCursor;
  limit?: number;
}): Promise<{ items: CatalogProduct[]; next: ProductCursor | null }> {
  const limit = p.limit ?? DEFAULT_LIMIT;
  const rows = await run<ProductRow>(() =>
    supabase.rpc('search_products', {
      p_q: p.q || undefined,
      p_category_slug: p.categorySlug,
      p_store_slug: p.storeSlug,
      p_sort: p.sort,
      // O createdAt segue em bruto: passar por Date truncaria os microssegundos.
      p_after_created_at: p.after?.createdAt,
      p_after_price: p.after?.priceKz,
      p_after_id: p.after?.id,
      p_limit: limit,
    }),
  );
  const items = rows.map(toProduct);
  const last = items[items.length - 1];
  const next =
    last && items.length >= limit
      ? { createdAt: last.createdAt, priceKz: last.priceKz, id: last.id }
      : null;
  return { items, next };
}

interface ProductDetailRow {
  id: string;
  name: string;
  description: string | null;
  price_kz: number;
  stock: number;
  created_at: string;
  category_name: string | null;
  category_slug: string | null;
  store_name: string;
  store_slug: string;
  store_rating_avg: number | string | null;
  store_rating_count: number | null;
  images: { path: string; position: number }[] | null;
}

export async function getProduct(id: string): Promise<ProductDetail> {
  const rows = await run<ProductDetailRow>(() => supabase.rpc('get_product', { p_id: id }));
  const r = rows[0];
  if (!r) throw new Error(MESSAGES.notFound);
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    priceKz: r.price_kz,
    stock: r.stock,
    createdAt: r.created_at,
    categoryName: r.category_name ?? null,
    categorySlug: r.category_slug ?? null,
    storeName: r.store_name,
    storeSlug: r.store_slug,
    storeRating: toRating(r.store_rating_avg, r.store_rating_count),
    images: Array.isArray(r.images)
      ? r.images.map((i) => ({ path: i.path, position: i.position }))
      : [],
  };
}

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_name: string | null;
  category_slug: string | null;
  logo_path: string | null;
  published_products_count: number;
  rating_avg: number | string | null;
  rating_count: number | null;
}

function toStore(r: StoreRow): StoreSummary {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? null,
    categoryName: r.category_name ?? null,
    categorySlug: r.category_slug ?? null,
    logoPath: r.logo_path ?? null,
    productCount: r.published_products_count,
    rating: toRating(r.rating_avg, r.rating_count),
  };
}

export async function listStores(p: {
  q?: string;
  categorySlug?: string;
}): Promise<StoreSummary[]> {
  const rows = await run<StoreRow>(() =>
    supabase.rpc('list_stores', { p_q: p.q || undefined, p_category_slug: p.categorySlug }),
  );
  return rows.map(toStore);
}

export async function getStore(slug: string): Promise<StoreDetail> {
  const rows = await run<StoreRow & { product_categories: unknown }>(() =>
    supabase.rpc('get_store', { p_slug: slug }),
  );
  const r = rows[0];
  if (!r) throw new Error(MESSAGES.notFound);
  const cats = Array.isArray(r.product_categories)
    ? (r.product_categories as { name: string; slug: string }[])
    : [];
  return {
    ...toStore(r),
    productCategories: cats.map((c) => ({ name: c.name, slug: c.slug })),
  };
}

export async function listFeaturedStores(): Promise<FeaturedStore[]> {
  const rows = await run<StoreRow & { source: string }>(() => supabase.rpc('list_featured_stores'));
  return rows.map((r) => ({ ...toStore(r), isPromoted: r.source === 'paid' }));
}
