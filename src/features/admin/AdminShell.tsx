// Ecrãs: a-app, a-side e a-main (administração, modo denso, quadros A01–A07).
// Nesta fase a barra lateral só tem «Destaques»; os outros itens entram com as suas fases.
// Em ecrãs estreitos a barra fica por cima (flex-wrap), como nos quadros.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn, focusRing } from '@/lib/utils';

export type AdminSection = 'destaques';

const ITEMS: { id: AdminSection; label: string; to: string }[] = [
  { id: 'destaques', label: 'Destaques', to: '/admin/destaques' },
];

export function AdminShell({ active, children }: { active: AdminSection; children: ReactNode }) {
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
              'flex min-h-11 items-center rounded-sm px-2.5 font-body text-[15px] leading-5 font-medium text-ink no-underline',
              'hover:bg-brand-tint aria-[current=page]:bg-ink aria-[current=page]:font-bold aria-[current=page]:text-on-ink',
              focusRing,
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-4.5 px-4 pt-6 pb-8 sm:px-7">
        {children}
      </main>
    </div>
  );
}
