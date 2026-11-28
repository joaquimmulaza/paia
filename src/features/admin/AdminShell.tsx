// Ecrãs: a-app, a-side e a-main (administração, modo denso, quadros A01–A07).
// No F2 a barra lateral tem «Candidaturas» (com o número por analisar) e «Destaques»; os outros
// itens entram com as suas fases. Em ecrãs estreitos a barra fica por cima (flex-wrap), como
// nos quadros.
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn, focusRing } from '@/lib/utils';
import { countPendingApplications } from './applications-api';
import { adminKeys } from './queries';

export type AdminSection = 'candidaturas' | 'destaques';

const ITEMS: { id: AdminSection; label: string; to: string }[] = [
  { id: 'candidaturas', label: 'Candidaturas', to: '/admin/candidaturas' },
  { id: 'destaques', label: 'Destaques', to: '/admin/destaques' },
];

/** O número de candidaturas por analisar (o mesmo pedido do separador «Por analisar»). */
export function usePendingCount() {
  const userId = useAuth().session?.user.id ?? null;
  return useQuery({
    queryKey: adminKeys.pendingCount(userId),
    queryFn: countPendingApplications,
  });
}

export function AdminShell({ active, children }: { active: AdminSection; children: ReactNode }) {
  const pending = usePendingCount().data ?? 0;
  return (
    <div className="flex min-h-dvh flex-wrap bg-paper font-body text-[15px] leading-[22px] text-ink">
      <nav
        aria-label="Administração"
        className="flex max-w-full flex-[1_1_220px] flex-col gap-1 border-b border-ink bg-surface px-3.5 py-5 min-[876px]:border-r min-[876px]:border-b-0"
      >
        <Link
          to="/"
          className={cn('mx-1.5 mb-1.5 self-start rounded-sm p-0.5', focusRing)}
          aria-label="PAIÁ, ir para o início"
        >
          <img src="/logo.png" alt="" className="block h-7 w-auto mix-blend-multiply" />
        </Link>
        <p className="mx-2 mt-3.5 mb-1 font-display text-label font-bold text-ink-muted uppercase">
          Administração
        </p>
        {ITEMS.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            aria-current={item.id === active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center justify-between gap-2.5 rounded-sm px-2.5 font-body text-[15px] leading-5 font-medium text-ink no-underline',
              'hover:bg-brand-tint aria-[current=page]:bg-ink aria-[current=page]:font-bold aria-[current=page]:text-on-ink',
              focusRing,
            )}
          >
            {item.label}
            {item.id === 'candidaturas' && pending > 0 && (
              // p-count: sem contador quando não há nada por analisar (A01b). O número visível
              // fica escondido do leitor de ecrã, que ouve «3 por analisar».
              <>
                <span
                  aria-hidden="true"
                  className="inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full border-2 border-ink bg-brand px-1.5 font-display text-tag leading-none font-bold text-ink"
                >
                  {pending}
                </span>
                <span className="sr-only">, {pending} por analisar</span>
              </>
            )}
          </Link>
        ))}
      </nav>
      <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-4.5 px-4 pt-6 pb-8 sm:px-7">
        {children}
      </main>
    </div>
  );
}
