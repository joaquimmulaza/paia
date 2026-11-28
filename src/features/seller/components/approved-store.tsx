// Os ecrãs da loja aprovada (V04b–V06b): só com a loja aprovada. Qualquer outro estado segue
// para o ecrã que lhe serve (a suspensa, que não pode escrever produtos, para /vender/estado).
import type { ReactElement, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { PageShell } from '@/components/paia/PageShell';
import { LoadError } from '@/features/catalog/components/LoadError';
import { useMyStore } from '../queries';
import type { MyStore } from '../types';
import { HOME_BY_KIND, SellerSkeleton } from './seller-ui';

type Gate = { store: MyStore; gate: null } | { store: null; gate: ReactElement };

/** Devolve a loja aprovada, ou o ecrã a mostrar no lugar da página (a carregar, erro, desvio). */
export function useApprovedStore(header: ReactNode): Gate {
  const store = useMyStore();
  if (store.isError && !store.data) {
    return {
      store: null,
      gate: (
        <PageShell header={header}>
          <LoadError
            error={store.error}
            retrying={store.isFetching}
            onRetry={() => void store.refetch()}
          />
        </PageShell>
      ),
    };
  }
  if (store.isPending) {
    return {
      store: null,
      gate: (
        <PageShell header={header}>
          <SellerSkeleton />
        </PageShell>
      ),
    };
  }
  const data = store.data;
  if (!data || data.kind !== 'approved') {
    return { store: null, gate: <Navigate to={HOME_BY_KIND[data?.kind ?? 'none']} replace /> };
  }
  return { store: data, gate: null };
}
