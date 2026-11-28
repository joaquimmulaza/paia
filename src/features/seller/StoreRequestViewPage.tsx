// Ecrã V03b · Ver o pedido: a loja como vai aparecer e o histórico do pedido.
// O histórico nunca mostra quem decidiu (a função da base nem o devolve).
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { LoadError } from '@/features/catalog/components/LoadError';
import { publicImageUrl } from '@/features/catalog/labels';
import { useCategories } from '@/features/catalog/queries';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';
import {
  BackLink,
  cardClass,
  HistoryItem,
  HOME_BY_KIND,
  Notice,
  SellerSkeleton,
  StoreMark,
} from './components/seller-ui';
import { StoreTag } from './components/StoreTag';
import { useMyStore, useMyStoreDecisions } from './queries';
import type { MyStore, StoreDecision } from './types';

const dtClass = 'font-display text-tag font-bold text-ink-muted uppercase';
const ddClass = 'm-0 mt-0.5 font-body text-body break-words whitespace-pre-line';

export function StoreRequestViewPage() {
  useDocumentTitle('O teu pedido');
  const store = useMyStore();
  const kind = store.data?.kind;
  const header = (
    <AppHeader
      start={<BackLink to="/vender/estado" />}
      title="O teu pedido"
      actions={kind && kind !== 'none' ? <StoreTag kind={kind} /> : undefined}
    />
  );

  if (store.isError && !store.data) {
    return (
      <PageShell header={header}>
        <LoadError
          error={store.error}
          retrying={store.isFetching}
          onRetry={() => void store.refetch()}
        />
      </PageShell>
    );
  }
  if (store.isPending) {
    return (
      <PageShell header={header}>
        <SellerSkeleton label="A carregar o pedido…" />
      </PageShell>
    );
  }
  const data = store.data;
  if (!data || data.kind === 'draft' || data.kind === 'approved') {
    return <Navigate to={HOME_BY_KIND[data?.kind ?? 'none']} replace />;
  }

  return (
    <PageShell header={header} className="gap-4.5">
      {data.kind === 'pending' && (
        <Notice>
          Durante a análise não podes mudar o pedido. Se for recusado, corriges e envias outra vez.
        </Notice>
      )}
      <Preview store={data} />
      <History store={data} />
    </PageShell>
  );
}

function Preview({ store }: { store: MyStore }) {
  const categories = useCategories();
  const category = categories.data?.find((c) => c.id === store.categoryId)?.name;
  return (
    <section aria-label="Como a loja vai aparecer" className={cn(cardClass, 'gap-3.5')}>
      <div className="flex items-center gap-3.5">
        <StoreMark name={store.name} logoPath={store.logoPath} size="lg" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="m-0 font-display text-xl leading-6 font-bold break-words">{store.name}</p>
          <span className="font-body text-small font-medium break-all text-ink-muted">
            …/loja/{store.slug}
          </span>
        </div>
      </div>
      <dl className="m-0 flex flex-col gap-3">
        <div>
          <dt className={dtClass}>Descrição</dt>
          <dd className={ddClass}>{store.description}</dd>
        </div>
        <div>
          <dt className={dtClass}>Categoria principal</dt>
          <dd className={ddClass}>{category ?? (categories.isError ? '—' : '…')}</dd>
        </div>
        <div>
          <dt className={dtClass}>Imagem de capa</dt>
          <dd className={ddClass}>
            {store.coverPath ? (
              <img
                src={publicImageUrl('store-media', store.coverPath)}
                alt="Imagem de capa"
                className="mt-1 block aspect-[16/7] w-full rounded-md border-2 border-ink object-cover"
              />
            ) : (
              'Sem capa'
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

interface HistoryEvent {
  at: string;
  /** Desempate quando duas datas são iguais: o mais recente no ciclo vem primeiro. */
  rank: number;
  text: ReactNode;
}

function decisionEvent(d: StoreDecision): HistoryEvent | null {
  if (d.decision === 'approved') return { at: d.createdAt, rank: 2, text: 'Aprovado pela equipa.' };
  if (d.decision !== 'rejected') return null;
  return {
    at: d.createdAt,
    rank: 2,
    text: (
      <>
        Recusado pela equipa.
        {d.message && (
          <span className="mt-0.5 block break-words whitespace-pre-line text-ink-muted">
            {d.message}
          </span>
        )}
      </>
    ),
  };
}

function History({ store }: { store: MyStore }) {
  const decisions = useMyStoreDecisions();
  const events: HistoryEvent[] = [
    { at: store.createdAt, rank: 0, text: 'Rascunho guardado.' },
    ...(store.submittedAt
      ? [{ at: store.submittedAt, rank: 1, text: 'Enviado para análise.' }]
      : []),
    ...(decisions.data ?? []).map(decisionEvent).filter((e): e is HistoryEvent => e !== null),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.rank - a.rank);

  return (
    <section aria-labelledby="pedido-historico" className="flex flex-col gap-2.5">
      <h2 id="pedido-historico" className="m-0 font-display text-lg leading-[22px] font-bold">
        Histórico
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {events.map((e, i) => (
          <HistoryItem key={`${e.at}-${i}`} at={e.at}>
            {e.text}
          </HistoryItem>
        ))}
      </ul>
      {decisions.isError && (
        <LoadError
          error={decisions.error}
          retrying={decisions.isFetching}
          onRetry={() => void decisions.refetch()}
        />
      )}
    </section>
  );
}
