// Candidaturas de lojas (A01). As funções da base verificam `is_admin` primeiro e a decisão
// tranca a linha da loja: a segurança e a concorrência estão lá, não aqui.
import { isKnownDbCode, MESSAGES, translateDbError } from '@/lib/errors';
import { call } from './api';
import type {
  ApplicationDetail,
  ApplicationDetailRow,
  ApplicationStatus,
  ApplicationSummary,
  ApplicationSummaryRow,
  Checklist,
  DecideStoreInput,
  StoreDecisionEntry,
  StoreDecisionRow,
  StoreStatus,
} from './types';

/** Uma página só, no máximo que a base deixa (50). */
export const APPLICATIONS_LIMIT = 50;

function toSummary(r: ApplicationSummaryRow): ApplicationSummary {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    categoryName: r.category_name ?? null,
    logoPath: r.logo_path ?? null,
    ownerName: r.owner_name,
    ownerAffiliation: r.owner_affiliation,
    submittedAt: r.submitted_at ?? null,
    decidedAt: r.decided_at ?? null,
  };
}

function toDetail(r: ApplicationDetailRow): ApplicationDetail {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    categoryName: r.category_name ?? null,
    logoPath: r.logo_path ?? null,
    status: r.status,
    submittedAt: r.submitted_at ?? null,
    ownerName: r.owner_name,
    ownerAffiliation: r.owner_affiliation,
    ownerCreatedAt: r.owner_created_at,
  };
}

/** Só as 4 chaves conhecidas, e só `true` conta como confirmado. */
function toChecklist(value: unknown): Checklist {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    name_description: source.name_description === true,
    allowed: source.allowed === true,
    images: source.images === true,
    account: source.account === true,
  };
}

function toDecision(r: StoreDecisionRow): StoreDecisionEntry {
  return {
    decision: r.decision,
    message: r.message ?? null,
    checklist: toChecklist(r.checklist),
    adminName: r.admin_name ?? null,
    createdAt: r.created_at,
  };
}

export async function listApplications(status: ApplicationStatus): Promise<ApplicationSummary[]> {
  const data = await call('admin_list_store_applications', {
    p_status: status,
    p_limit: APPLICATIONS_LIMIT,
  });
  return Array.isArray(data) ? (data as ApplicationSummaryRow[]).map(toSummary) : [];
}

/** Null quando a loja não existe. */
export async function getApplication(storeId: string): Promise<ApplicationDetail | null> {
  const data = await call('admin_get_store_application', { p_store_id: storeId });
  const row = Array.isArray(data) ? (data[0] as ApplicationDetailRow | undefined) : undefined;
  return row ? toDetail(row) : null;
}

/** Da mais recente para a mais antiga. */
export async function listStoreDecisions(storeId: string): Promise<StoreDecisionEntry[]> {
  const data = await call('admin_list_store_decisions', { p_store_id: storeId });
  return Array.isArray(data) ? (data as StoreDecisionRow[]).map(toDecision) : [];
}

export async function countPendingApplications(): Promise<number> {
  return Number(await call('admin_count_pending_stores')) || 0;
}

/**
 * Aprova ou recusa. Erros: ALREADY_DECIDED (outra pessoa da equipa decidiu, ou a loja foi
 * reenviada depois de o ecrã a mostrar) vira MESSAGES.alreadyDecided; uma falha sem código
 * conhecido vira MESSAGES.decisionFailed.
 */
export async function decideStore(input: DecideStoreInput): Promise<StoreStatus> {
  try {
    const data = await call(
      'admin_decide_store',
      {
        p_store_id: input.storeId,
        p_decision: input.decision,
        p_message: input.message.trim() === '' ? null : input.message,
        p_checklist: input.checklist,
        p_expected_submitted_at: input.expectedSubmittedAt,
      },
      (code) => (isKnownDbCode(code) ? translateDbError(code) : MESSAGES.decisionFailed),
    );
    return data as StoreStatus;
  } catch (error) {
    // A falha de rede chega como MESSAGES.generic: no A01b é «Não foi possível guardar a decisão».
    if (error instanceof Error && error.message === MESSAGES.generic) {
      throw new Error(MESSAGES.decisionFailed);
    }
    throw error;
  }
}
