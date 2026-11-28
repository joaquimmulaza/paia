// Ecrã K03 · Perfil, com o cartão «A minha loja» do K03c (muda com o estado da loja).
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { LoadError } from '@/features/catalog/components/LoadError';
import { StoreMark } from '@/features/seller/components/seller-ui';
import { StoreTag } from '@/features/seller/components/StoreTag';
import { useMyStore } from '@/features/seller/queries';
import type { MyStore } from '@/features/seller/types';
import { cn, focusRing } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/use-document-title';
import { getMyProfile, signOut, type MyProfile } from './api';
import { AuthErrorAlert, errorMessage } from './AuthErrorAlert';
import { useAuth } from './AuthProvider';
import { AFFILIATION_LABEL } from './labels';

/** Iniciais do primeiro e do último nome («João Manuel» → «JM»). */
function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase('pt-AO');
}

type Scope = 'local' | 'global';

export function ProfilePage() {
  useDocumentTitle('Perfil');
  const navigate = useNavigate();
  const userId = useAuth().session?.user.id ?? null;
  const profile = useQuery({
    queryKey: ['me', 'profile', userId],
    queryFn: getMyProfile,
    enabled: userId !== null,
  });
  const [pendingScope, setPendingScope] = useState<Scope | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const sending = useRef(false);

  async function handleSignOut(scope: Scope) {
    if (sending.current) return;
    sending.current = true;
    setPendingScope(scope);
    setSignOutError(null);
    try {
      await signOut(scope);
      navigate('/entrar', { replace: true });
    } catch (error) {
      setSignOutError(errorMessage(error));
      setPendingScope(null);
    } finally {
      sending.current = false;
    }
  }

  return (
    <PageShell header={<AppHeader title="Perfil" />} nav="perfil" className="gap-5">
      {profile.isPending && <ProfileSkeleton />}

      {profile.isError && (
        <div className="flex flex-col items-start gap-3">
          <AuthErrorAlert message={errorMessage(profile.error)} />
          <Button
            variant="secondary"
            size="sm"
            loading={profile.isFetching}
            onClick={() => void profile.refetch()}
          >
            Tentar outra vez
          </Button>
        </div>
      )}

      {profile.isSuccess && <ProfileDetails profile={profile.data} />}

      <div className="flex flex-col gap-3">
        <AuthErrorAlert message={signOutError} />
        <Button
          variant="secondary"
          className="w-full"
          loading={pendingScope === 'local'}
          disabled={pendingScope !== null}
          onClick={() => void handleSignOut('local')}
        >
          Terminar sessão
        </Button>
        <Button
          variant="secondary"
          className="w-full whitespace-normal"
          loading={pendingScope === 'global'}
          disabled={pendingScope !== null}
          onClick={() => void handleSignOut('global')}
        >
          Terminar sessão em todos os aparelhos
        </Button>
      </div>
    </PageShell>
  );
}

function ProfileDetails({ profile }: { profile: MyProfile }) {
  return (
    <>
      <section
        aria-label="A tua conta"
        className="flex items-center gap-3.5 rounded-lg border-2 border-ink bg-surface p-4 shadow-hard"
      >
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-brand-tint font-display text-xl leading-none font-bold"
        >
          {initials(profile.fullName)}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <strong className="font-display text-price font-bold break-words">
            {profile.fullName}
          </strong>
          <span className="inline-flex min-h-6.5 items-center self-start rounded-sm border-2 border-ink bg-surface px-2 py-0.75 font-display text-tag font-bold text-ink uppercase">
            {AFFILIATION_LABEL[profile.affiliation]}
          </span>
        </div>
      </section>

      {/* Só estudantes podem pedir uma loja (context.md, secção 4). */}
      {profile.affiliation === 'student' && <ShopCard />}

      {/* Só para a experiência: as funções da administração verificam is_admin. */}
      {profile.isAdmin && (
        <nav
          aria-label="Administração"
          className="overflow-hidden rounded-lg border-2 border-ink bg-surface shadow-hard-sm"
        >
          <Link
            to="/admin"
            className={cn(
              'flex min-h-14 items-center gap-3 px-4 font-display font-bold text-ink no-underline hover:bg-brand-tint',
              focusRing,
            )}
          >
            <ShieldCheck aria-hidden="true" className="size-6 shrink-0" />
            <span className="flex-1">Administração</span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
          </Link>
        </nav>
      )}
    </>
  );
}

const shopCardClass = 'flex flex-col gap-2.5 rounded-lg border-2 border-ink p-4';

function ShopCard() {
  const store = useMyStore();
  if (store.isPending) return null;
  if (store.isError && !store.data) {
    return (
      <section aria-labelledby="minha-loja" className={cn(shopCardClass, 'bg-surface')}>
        <h2 id="minha-loja" className="m-0 font-display text-label font-bold text-ink uppercase">
          A minha loja
        </h2>
        <LoadError
          error={store.error}
          retrying={store.isFetching}
          onRetry={() => void store.refetch()}
        />
      </section>
    );
  }
  const data = store.data;
  if (!data) {
    return (
      <section aria-labelledby="minha-loja" className={cn(shopCardClass, 'bg-brand-tint')}>
        <h2 id="minha-loja" className="m-0 font-display text-label font-bold text-ink uppercase">
          A minha loja
        </h2>
        <p className="m-0 font-body text-body">
          Ainda não tens loja. Pede a tua: a equipa do PAIÁ analisa e responde.
        </p>
        <Button asChild variant="accent" size="sm" className="self-start">
          <Link to="/vender">Quero vender</Link>
        </Button>
      </section>
    );
  }
  if (data.kind === 'approved') return <ApprovedShop store={data} />;
  return <ShopStatusCard store={data} />;
}

const SHOP_STATE: Record<
  'draft' | 'pending' | 'rejected' | 'suspended',
  { text: string; action?: { label: string; to: string; variant: 'primary' | 'secondary' } }
> = {
  draft: {
    text: 'O pedido ainda não foi enviado. Acaba de o preencher e envia-o para análise.',
    action: { label: 'Continuar o pedido', to: '/vender/pedido', variant: 'primary' },
  },
  pending: {
    text: 'A equipa está a analisar a tua loja. A resposta aparece aqui.',
    action: { label: 'Ver o estado', to: '/vender/estado', variant: 'secondary' },
  },
  rejected: {
    text: 'A loja ainda não foi aprovada. Lê a mensagem da equipa, corrige e envia outra vez.',
    action: { label: 'Ver a mensagem', to: '/vender/estado', variant: 'primary' },
  },
  // F4: só o aviso, sem ação (o motivo chega com a moderação).
  suspended: { text: 'A tua loja está suspensa. Fala com a equipa do PAIÁ.' },
};

function ShopStatusCard({ store }: { store: MyStore }) {
  if (store.kind === 'none' || store.kind === 'approved') return null;
  const { text, action } = SHOP_STATE[store.kind];
  return (
    <section aria-labelledby="minha-loja" className={cn(shopCardClass, 'bg-surface')}>
      <div className="flex items-center justify-between gap-3">
        <h2
          id="minha-loja"
          className="m-0 min-w-0 font-display text-label font-bold break-words text-ink uppercase"
        >
          {store.name}
        </h2>
        <StoreTag kind={store.kind} />
      </div>
      <p className="m-0 font-body text-body">{text}</p>
      {action && (
        <Button asChild variant={action.variant} size="sm" className="self-start">
          <Link to={action.to}>{action.label}</Link>
        </Button>
      )}
    </section>
  );
}

/** s-storelink: a loja aprovada leva ao painel. */
function ApprovedShop({ store }: { store: MyStore }) {
  return (
    <Link
      to="/vender/loja"
      className={cn(
        'flex items-center gap-3 rounded-lg border-2 border-ink bg-surface p-3 text-ink no-underline shadow-hard-sm',
        'touch-manipulation [-webkit-tap-highlight-color:transparent] active:bg-brand-tint',
        focusRing,
      )}
    >
      <StoreMark name={store.name} logoPath={store.logoPath} />
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="font-body text-body font-bold break-words">{store.name}</strong>
        <span className="font-body text-small font-medium text-ink-muted">
          Gerir produtos e loja
        </span>
      </span>
      <StoreTag kind="approved" />
    </Link>
  );
}

/** Blocos estáticos (s-skel), sem animação. */
function ProfileSkeleton() {
  return (
    <div
      role="status"
      className="flex items-center gap-3.5 rounded-lg border-2 border-ink bg-surface p-4"
    >
      <span className="sr-only">A carregar o perfil…</span>
      <span aria-hidden="true" className="size-14 shrink-0 rounded-full bg-brand-tint" />
      <span aria-hidden="true" className="flex flex-1 flex-col gap-2">
        <span className="h-5 w-2/3 rounded-sm bg-brand-tint" />
        <span className="h-6.5 w-24 rounded-sm bg-brand-tint" />
      </span>
    </div>
  );
}
