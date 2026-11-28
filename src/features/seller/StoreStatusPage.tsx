// Ecrã V03 · Candidatura: em análise, recusada ou suspensa (a suspensão chega na F4; aqui só
// o aviso). Sem loja, com rascunho ou aprovada, segue para o ecrã certo.
import { Link, Navigate } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { LoadError } from '@/features/catalog/components/LoadError';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';
import {
  BackLink,
  cardClass,
  h2Class,
  HistoryItem,
  HOME_BY_KIND,
  kickerClass,
  SellerSkeleton,
  TeamMessage,
} from './components/seller-ui';
import { StoreTag } from './components/StoreTag';
import { useMyStore } from './queries';
import type { MyStore } from './types';

const leadClass = 'm-0 font-body text-body';

export function StoreStatusPage() {
  useDocumentTitle('A minha loja');
  const store = useMyStore();
  const header = (
    <AppHeader start={<BackLink to="/perfil" label="Voltar ao perfil" />} title="A minha loja" />
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
        <SellerSkeleton />
      </PageShell>
    );
  }
  const data = store.data;
  if (!data || data.kind === 'draft' || data.kind === 'approved') {
    return <Navigate to={HOME_BY_KIND[data?.kind ?? 'none']} replace />;
  }

  return (
    <PageShell header={header} className="gap-5.5">
      {data.kind === 'pending' && <Pending store={data} />}
      {data.kind === 'rejected' && <Rejected store={data} />}
      {data.kind === 'suspended' && <Suspended store={data} />}
    </PageShell>
  );
}

function CardTitle({ id, store }: { id: string; store: MyStore }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className={cn(kickerClass, 'min-w-0 break-words')}>
        {store.name}
      </h2>
      {store.kind !== 'none' && <StoreTag kind={store.kind} />}
    </div>
  );
}

function Pending({ store }: { store: MyStore }) {
  return (
    <section aria-labelledby="estado-loja" className={cn(cardClass, 'shadow-hard')}>
      <CardTitle id="estado-loja" store={store} />
      <p className={h2Class}>Recebemos o teu pedido</p>
      <p className={leadClass}>
        A equipa do PAIÁ vai analisar a tua loja. A resposta aparece aqui e em Perfil. Enquanto
        esperas, podes continuar a comprar.
      </p>
      {store.submittedAt && (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          <HistoryItem at={store.submittedAt}>Pedido enviado para análise.</HistoryItem>
        </ul>
      )}
      <Button asChild variant="secondary" size="sm" className="self-start">
        <Link to="/vender/pedido/ver">Ver o pedido</Link>
      </Button>
    </section>
  );
}

function Rejected({ store }: { store: MyStore }) {
  return (
    <section aria-labelledby="estado-loja" className={cardClass}>
      <CardTitle id="estado-loja" store={store} />
      <p className={h2Class}>A loja ainda não foi aprovada</p>
      {store.lastMessage && <TeamMessage message={store.lastMessage} />}
      <p className="m-0 font-body text-caption font-medium text-ink-muted">
        Podes corrigir e enviar outra vez. Não há limite de tentativas.
      </p>
      <Button asChild variant="primary" size="sm" className="self-start">
        <Link to="/vender/pedido">Corrigir e enviar</Link>
      </Button>
    </section>
  );
}

function Suspended({ store }: { store: MyStore }) {
  return (
    <section aria-labelledby="estado-loja" className={cardClass}>
      <CardTitle id="estado-loja" store={store} />
      <p className={leadClass}>A tua loja está suspensa. Fala com a equipa do PAIÁ.</p>
    </section>
  );
}
