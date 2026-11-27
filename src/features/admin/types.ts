// Tipos próprios da administração. Os tipos gerados do Supabase não marcam como
// nulas as colunas que as funções podem devolver a null, por isso não se confia
// neles: o cast faz-se só na fronteira (api.ts).

export type StoreStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';
export type FeatureSource = 'admin' | 'paid';

/** Uma linha de `admin_list_store_features()`, como chega da base. */
export interface AdminFeatureRow {
  id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  store_status: StoreStatus;
  source: FeatureSource;
  position: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  note: string | null;
  is_live: boolean;
}

/** Argumentos de `admin_save_store_feature`. `p_id` nulo cria um destaque novo. */
export interface SaveFeatureArgs {
  p_id: string | null;
  p_store_id: string;
  p_position: number;
  p_starts_at: string | null;
  p_ends_at: string | null;
  p_note: string | null;
}

export interface AdminFeature {
  id: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeStatus: StoreStatus;
  source: FeatureSource;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  note: string | null;
  /** Elegível para o Início (loja aprovada, ativo, dentro do período). Não conta com o limite de 10. */
  isLive: boolean;
}

export interface SaveFeatureInput {
  id?: string;
  storeId: string;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  note: string | null;
}
