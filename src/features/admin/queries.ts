// Chaves de cache da administração. Começam por 'me' para o AuthProvider as apagar
// quando o utilizador muda (onUserChange remove ['me', …]).
import type { QueryClient } from '@tanstack/react-query';
import { catalogKeys } from '@/features/catalog/queries';

export const adminKeys = {
  all: ['me', 'admin'] as const,
  /** Prefixo da lista de qualquer utilizador (para invalidar). */
  featuresAll: ['me', 'admin', 'features'] as const,
  /** A lista de um utilizador: a chave leva a sessão, como a do perfil. */
  features: (userId: string | null) => ['me', 'admin', 'features', userId] as const,
};

/** Depois de mudar um destaque: a lista da administração e a secção do Início. */
export function invalidateFeatures(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: adminKeys.featuresAll }),
    queryClient.invalidateQueries({ queryKey: catalogKeys.featured() }),
  ]);
}
