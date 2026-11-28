// Chaves de cache da administração. Começam por 'me' por convenção; ao mudar de conta,
// o Providers limpa a cache inteira.
import type { QueryClient } from '@tanstack/react-query';
import { catalogKeys } from '@/features/catalog/queries';

export const adminKeys = {
  all: ['me', 'admin'] as const,
  /** Prefixo da lista de qualquer utilizador (para invalidar). */
  featuresAll: ['me', 'admin', 'features'] as const,
  /** A lista de um utilizador: a chave leva a sessão, como a do perfil. */
  features: (userId: string | null) => ['me', 'admin', 'features', userId] as const,
  /** Prefixo de tudo o que é das candidaturas (listas, detalhe, histórico e contador). */
  applicationsAll: ['me', 'admin', 'applications'] as const,
  applications: (userId: string | null, status: string) =>
    ['me', 'admin', 'applications', userId, 'list', status] as const,
  application: (userId: string | null, storeId: string) =>
    ['me', 'admin', 'applications', userId, 'detail', storeId] as const,
  decisions: (userId: string | null, storeId: string) =>
    ['me', 'admin', 'applications', userId, 'decisions', storeId] as const,
  pendingCount: (userId: string | null) =>
    ['me', 'admin', 'applications', userId, 'pending-count'] as const,
};

/**
 * Depois de uma decisão (ou de saber que outra pessoa decidiu): listas, detalhe, histórico e
 * contador. O catálogo também, porque uma loja aprovada passa a ser pública.
 */
export function invalidateApplications(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: adminKeys.applicationsAll }),
    queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  ]);
}

/** Depois de mudar um destaque: a lista da administração e a secção do Início. */
export function invalidateFeatures(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: adminKeys.featuresAll }),
    queryClient.invalidateQueries({ queryKey: catalogKeys.featured() }),
  ]);
}
