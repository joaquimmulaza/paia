// Tipos próprios da administração. Os tipos gerados do Supabase não marcam como
// nulas as colunas que as funções podem devolver a null, por isso não se confia
// neles: o cast faz-se só na fronteira (api.ts).
import type { Affiliation } from '@/features/auth/schemas';

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
  /** Nula: ao criar, o fim da ordem dos ativos; ao alterar, a posição atual. */
  p_position: number | null;
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
  position: number | null;
  startsAt: string | null;
  endsAt: string | null;
  note: string | null;
}

// Candidaturas de lojas (A01).

/** Os estados que o A01 lista. `draft` não é candidatura (a base recusa com INVALID_STATUS). */
export type ApplicationStatus = 'pending_approval' | 'approved' | 'rejected';
export type DecisionKind = 'approved' | 'rejected' | 'suspended' | 'reactivated';

/** As 4 caixas da lista de verificação do A01, com as chaves que a base aceita. */
export interface Checklist {
  name_description: boolean;
  allowed: boolean;
  images: boolean;
  account: boolean;
}

/** Uma linha de `admin_list_store_applications`, como chega da base. */
export interface ApplicationSummaryRow {
  id: string;
  name: string;
  slug: string;
  category_name: string | null;
  logo_path: string | null;
  owner_name: string;
  owner_affiliation: Affiliation;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by_name: string | null;
  rejection_count: number;
}

export interface ApplicationSummary {
  id: string;
  name: string;
  slug: string;
  categoryName: string | null;
  logoPath: string | null;
  ownerName: string;
  ownerAffiliation: Affiliation;
  submittedAt: string | null;
  decidedAt: string | null;
  /** Quem decidiu (nome completo); nulo numa pendente. */
  decidedByName: string | null;
  /** Quantas recusas a loja já teve («2.ª recusa» no A01b). */
  rejectionCount: number;
}

/** Uma linha de `admin_get_store_application`. */
export interface ApplicationDetailRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  category_name: string | null;
  logo_path: string | null;
  cover_path: string | null;
  status: StoreStatus;
  submitted_at: string | null;
  owner_name: string;
  owner_affiliation: Affiliation;
  owner_created_at: string;
}

/** O que a administração vê de uma candidatura: do dono, só o nome, o vínculo e a idade da conta. */
export interface ApplicationDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryName: string | null;
  logoPath: string | null;
  status: StoreStatus;
  submittedAt: string | null;
  ownerName: string;
  ownerAffiliation: Affiliation;
  ownerCreatedAt: string;
}

/** Uma linha de `admin_list_store_decisions`. */
export interface StoreDecisionRow {
  decision: DecisionKind;
  message: string | null;
  checklist: unknown;
  admin_name: string | null;
  created_at: string;
}

export interface StoreDecisionEntry {
  decision: DecisionKind;
  message: string | null;
  checklist: Checklist;
  /** Nulo se a conta de quem decidiu já não tem perfil. */
  adminName: string | null;
  createdAt: string;
}

export interface DecideStoreInput {
  storeId: string;
  decision: 'approved' | 'rejected';
  message: string;
  checklist: Checklist;
  /** O submitted_at que o ecrã mostrou: se a loja foi reenviada entretanto, a base recusa. */
  expectedSubmittedAt: string | null;
}
