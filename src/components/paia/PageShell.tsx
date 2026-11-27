// Ecrãs: s-app (coluna móvel), s-body e s-foot (navegação fixa em baixo).
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BottomNav, type BottomNavTab } from './BottomNav';

type PageShellProps = {
  header: ReactNode;
  children: ReactNode;
  /** Separador ativo da navegação inferior. Sem ele, não há navegação (entrar, criar conta). */
  nav?: BottomNavTab;
  /** Barra fixa de ação em baixo (s-cta), em vez da navegação. Fica no fluxo: não tapa o conteúdo. */
  footer?: ReactNode;
  className?: string;
};

export function PageShell({ header, children, nav, footer, className }: PageShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper text-ink">
      {header}
      <main className={cn('flex flex-1 flex-col gap-6 px-5 pt-1 pb-6', className)}>{children}</main>
      {nav && (
        <div className="sticky bottom-0 bg-paper px-3 pt-2 pb-[max(--spacing(3),env(safe-area-inset-bottom))]">
          <BottomNav active={nav} />
        </div>
      )}
      {!nav && footer && <div className="sticky bottom-0">{footer}</div>}
    </div>
  );
}
