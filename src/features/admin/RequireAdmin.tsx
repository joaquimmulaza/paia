// Guarda da administração. Fica dentro de <RequireAuth>, que já trata de quem não tem sessão.
// É só para a experiência: quem não é administrador recebe NOT_ALLOWED das funções da base
// mesmo que contorne este ecrã.
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { getMyProfile } from '@/features/auth/api';
import { AuthErrorAlert, errorMessage } from '@/features/auth/AuthErrorAlert';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDocumentTitle } from '@/lib/use-document-title';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const userId = useAuth().session?.user.id ?? null;
  const profile = useQuery({
    queryKey: ['me', 'profile', userId],
    queryFn: getMyProfile,
    enabled: userId !== null,
  });

  if (profile.isPending) return <AdminSkeleton />;
  if (profile.isError) {
    return (
      <div className="flex min-h-dvh flex-col items-start gap-3 bg-paper p-4 text-ink">
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
    );
  }
  if (!profile.data.isAdmin) return <NotAllowed />;
  return <>{children}</>;
}

function NotAllowed() {
  useDocumentTitle('Sem acesso');
  return (
    <PageShell header={<AppHeader logo />} className="gap-5">
      <span
        aria-hidden="true"
        data-testid="lock-mark"
        className="flex size-16 items-center justify-center self-start rounded-full border-2 border-ink bg-surface"
      >
        <Lock className="size-7" />
      </span>
      <h1 className="m-0 font-display text-title font-bold text-ink">
        Não tens acesso a esta área
      </h1>
      <p className="m-0 font-body text-body-lg">É só para a equipa da administração do PAIÁ.</p>
      <Button asChild variant="primary" className="w-full">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </PageShell>
  );
}

/** Blocos estáticos (s-skel) com a forma da administração: barra lateral e área principal. */
function AdminSkeleton() {
  return (
    <div role="status" className="flex min-h-dvh flex-wrap bg-paper">
      <span className="sr-only">A carregar…</span>
      <span
        aria-hidden="true"
        className="flex max-w-full flex-[1_1_220px] flex-col gap-2 border-r border-ink bg-surface px-3.5 py-5"
      >
        <span className="h-7 w-20 rounded-sm bg-brand-tint" />
        <span className="mt-4 h-10 rounded-sm bg-brand-tint" />
      </span>
      <span
        aria-hidden="true"
        className="flex min-w-0 flex-[999_1_640px] flex-col gap-4 px-4 py-6 sm:px-7"
      >
        <span className="h-7 w-40 rounded-sm bg-brand-tint" />
        <span className="h-48 rounded-md bg-brand-tint" />
      </span>
    </div>
  );
}
