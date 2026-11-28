// Camada de dados do vendedor. A segurança está na base (funções e RLS); aqui só se chama,
// se converte para camelCase e se traduz qualquer falha para texto PT-AO (nunca texto técnico).
import { MESSAGES, translateDbError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type {
  Cursor,
  MyProduct,
  MyProductDetail,
  MyStore,
  MyStoreKind,
  Page,
  ProductFilter,
  ProductImage,
  ProductInput,
  SaveStoreInput,
  StoreDecision,
  StoreStatus,
} from './types';

export const PAGE_SIZE = 20;

interface Reply {
  data: unknown;
  error: { message: string; code?: string } | null;
}

/** 22P02 (sintaxe inválida, por exemplo um uuid mal formado) é «não encontrado». */
function errorCode(error: { message: string; code?: string }): string {
  return error.code === '22P02' ? 'NOT_FOUND' : error.message;
}

/** Executa o pedido; erro da base ou da rede vira `Error` com texto PT-AO. Devolve `data`. */
async function exec(request: () => PromiseLike<Reply>): Promise<unknown> {
  let result: Reply;
  try {
    result = await request();
  } catch {
    throw new Error(MESSAGES.generic);
  }
  if (result.error) throw new Error(translateDbError(errorCode(result.error)));
  return result.data;
}

function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

// --- Loja -------------------------------------------------------------------------------

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string;
  logo_path: string | null;
  cover_path: string | null;
  status: StoreStatus;
  submitted_at: string | null;
  decided_at: string | null;
  created_at: string;
  published_products_count: number;
  hidden_products_count: number;
  sold_out_products_count: number;
  last_message: string | null;
}

const KIND: Record<StoreStatus, MyStoreKind> = {
  draft: 'draft',
  pending_approval: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  suspended: 'suspended',
};

function toStore(r: StoreRow): MyStore {
  const kind = KIND[r.status];
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? '',
    categoryId: r.category_id,
    logoPath: r.logo_path ?? null,
    coverPath: r.cover_path ?? null,
    status: r.status,
    kind,
    submittedAt: r.submitted_at ?? null,
    decidedAt: r.decided_at ?? null,
    createdAt: r.created_at,
    publishedProductsCount: r.published_products_count,
    hiddenProductsCount: r.hidden_products_count,
    soldOutProductsCount: r.sold_out_products_count,
    // Só a rejeição tem resposta a mostrar; depois de reenviar, a antiga não volta.
    lastMessage: kind === 'rejected' ? (r.last_message ?? null) : null,
  };
}

export async function getMyStore(): Promise<MyStore | null> {
  const [row] = rows<StoreRow>(await exec(() => supabase.rpc('get_my_store')));
  return row ? toStore(row) : null;
}

export async function saveMyStore(input: SaveStoreInput): Promise<string> {
  const id = await exec(() =>
    supabase.rpc('save_my_store', {
      p_name: input.name,
      p_description: input.description,
      p_category_id: input.categoryId,
      // Os tipos gerados dão string; a função aceita null.
      p_logo_path: input.logoPath as unknown as string,
      p_cover_path: input.coverPath as unknown as string,
    }),
  );
  return String(id);
}

export async function submitMyStore(): Promise<void> {
  await exec(() => supabase.rpc('submit_my_store'));
}

interface DecisionRow {
  decision: StoreDecision['decision'];
  message: string | null;
  created_at: string;
}

export async function getMyStoreDecisions(): Promise<StoreDecision[]> {
  const data = await exec(() => supabase.rpc('get_my_store_decisions'));
  return rows<DecisionRow>(data).map((r) => ({
    decision: r.decision,
    message: r.message ?? null,
    createdAt: r.created_at,
  }));
}

// --- Ficheiros --------------------------------------------------------------------------

type Bucket = 'store-media' | 'product-media';

async function uploadFile(bucket: Bucket, path: string, blob: Blob): Promise<void> {
  let failed: boolean;
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType: 'image/webp', upsert: false });
    failed = error !== null;
  } catch {
    failed = true;
  }
  if (failed) throw new Error(MESSAGES.uploadFailed);
}

/** Apaga ficheiros sem nunca lançar: um órfão no Storage revê-se à mão (não é erro do utilizador). */
async function removeFiles(bucket: Bucket, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(bucket).remove(paths);
  } catch {
    // Sem detalhe: nada sensível e nada que o utilizador possa fazer.
  }
}

/** Envia o logótipo ou a capa e devolve o caminho a guardar com `saveMyStore`. */
export async function uploadStoreImage(
  storeId: string,
  kind: 'logo' | 'cover',
  blob: Blob,
): Promise<string> {
  const path = `stores/${storeId}/${kind}-${crypto.randomUUID()}.webp`;
  await uploadFile('store-media', path, blob);
  return path;
}

// --- Produtos ---------------------------------------------------------------------------

const LIST_COLUMNS =
  'id,name,price_kz,stock,is_published,moderation_status,category_id,created_at,product_images(path,position)';
const DETAIL_COLUMNS =
  'id,name,description,price_kz,stock,is_published,moderation_status,moderation_reason,category_id,created_at,product_images(id,path,position)';

interface ProductRow {
  id: string;
  name: string;
  description?: string | null;
  price_kz: number;
  stock: number;
  is_published: boolean;
  moderation_status: 'visible' | 'hidden';
  moderation_reason?: string | null;
  category_id: string;
  created_at: string;
  product_images: { id?: string; path: string; position: number }[] | null;
}

function sortedImages(r: ProductRow) {
  return [...(r.product_images ?? [])].sort((a, b) => a.position - b.position);
}

function toProduct(r: ProductRow): MyProduct {
  return {
    id: r.id,
    name: r.name,
    priceKz: r.price_kz,
    stock: r.stock,
    isPublished: r.is_published,
    moderationStatus: r.moderation_status,
    categoryId: r.category_id,
    createdAt: r.created_at,
    mainImagePath: sortedImages(r)[0]?.path ?? null,
  };
}

/** Lê `products` direto: a RLS do dono mostra também os produtos escondidos. */
export async function listMyProducts(
  filter: ProductFilter,
  cursor?: Cursor,
): Promise<Page<MyProduct>> {
  const data = await exec(() => {
    let q = supabase.from('products').select(LIST_COLUMNS);
    if (filter === 'published') q = q.eq('is_published', true);
    if (filter === 'sold_out') q = q.eq('is_published', true).eq('stock', 0);
    if (filter === 'hidden') q = q.eq('is_published', false);
    if (cursor) {
      // O texto bruto do created_at: passar por Date truncaria os microssegundos.
      q = q.or(
        `created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`,
      );
    }
    return q
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1);
  });
  const all = rows<ProductRow>(data);
  const items = all.slice(0, PAGE_SIZE).map(toProduct);
  const last = items[items.length - 1];
  return {
    items,
    next: last && all.length > PAGE_SIZE ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

export async function getMyProduct(id: string): Promise<MyProductDetail | null> {
  let data: unknown;
  try {
    data = await exec(() =>
      supabase.from('products').select(DETAIL_COLUMNS).eq('id', id).maybeSingle(),
    );
  } catch (e) {
    // Um id que não é uuid dá 22P02 (já traduzido para «não encontrado»).
    if (e instanceof Error && e.message === MESSAGES.notFound) return null;
    throw e;
  }
  if (!data) return null;
  const r = data as ProductRow;
  return {
    ...toProduct(r),
    description: r.description ?? '',
    moderationReason: r.moderation_reason ?? null,
    images: sortedImages(r).map((i) => ({ id: i.id ?? '', path: i.path, position: i.position })),
  };
}

/** Cria sempre escondido: só se publica depois de ter foto (a base recusa sem ela). */
export async function createProduct(input: ProductInput): Promise<string> {
  const data = await exec(() =>
    supabase
      .from('products')
      .insert({
        store_id: input.storeId,
        category_id: input.categoryId,
        name: input.name,
        description: input.description,
        price_kz: input.priceKz,
        stock: input.stock,
        is_published: false,
      })
      .select('id')
      .single(),
  );
  return String((data as { id: string }).id);
}

export async function updateProduct(
  id: string,
  input: Partial<Omit<ProductInput, 'storeId'>> & { isPublished?: boolean },
): Promise<void> {
  const patch = {
    category_id: input.categoryId,
    name: input.name,
    description: input.description,
    price_kz: input.priceKz,
    stock: input.stock,
    is_published: input.isPublished,
  };
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Database['public']['Tables']['products']['Update'];
  await exec(() => supabase.from('products').update(defined).eq('id', id));
}

/** Apaga a linha (as fotos saem em cascata) e só depois os ficheiros. */
export async function deleteProduct(id: string, imagePaths: string[]): Promise<void> {
  await exec(() => supabase.from('products').delete().eq('id', id));
  await removeFiles('product-media', imagePaths);
}

interface ImageRow {
  id: string;
  path: string;
  position: number;
}

/** Envia o ficheiro e insere a linha; se a linha falhar, o ficheiro acabado de enviar sai. */
export async function uploadProductImage(
  storeId: string,
  productId: string,
  blob: Blob,
  position: number,
): Promise<ProductImage> {
  const path = `products/${storeId}/${productId}/${crypto.randomUUID()}.webp`;
  await uploadFile('product-media', path, blob);
  try {
    const data = await exec(() =>
      supabase
        .from('product_images')
        .insert({ product_id: productId, path, position })
        .select('id,path,position')
        .single(),
    );
    const r = data as ImageRow;
    return { id: r.id, path: r.path, position: r.position };
  } catch (e) {
    await removeFiles('product-media', [path]);
    throw e;
  }
}

/** A base recusa apagar a última foto de um produto publicado (PHOTO_REQUIRED). */
export async function removeProductImage(image: ProductImage): Promise<void> {
  await exec(() => supabase.from('product_images').delete().eq('id', image.id));
  await removeFiles('product-media', [image.path]);
}

export async function setProductImageOrder(productId: string, imageIds: string[]): Promise<void> {
  await exec(() =>
    supabase.rpc('set_product_image_order', { p_product_id: productId, p_image_ids: imageIds }),
  );
}
