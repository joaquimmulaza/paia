// Ecrãs: s-top (cabeçalho), s-iconbtn (botão Voltar) e s-logo.
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn, focusRing } from '@/lib/utils';

type AppHeaderProps = {
  /** Destino do botão Voltar. Sem ele, não há botão. */
  back?: string;
  /** Título do ecrã, como o h1 da página. */
  title?: string;
  /** Mostra o logótipo (30 px). */
  logo?: boolean;
  /** Botões de ícone à direita (s-row), por exemplo as notificações e o carrinho. */
  actions?: ReactNode;
};

export function AppHeader({ back, title, logo = false, actions }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 py-3.5">
      {back && (
        <Link
          to={back}
          aria-label="Voltar"
          className={cn(
            'inline-flex size-11 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-surface text-ink',
            'touch-manipulation [-webkit-tap-highlight-color:transparent] active:bg-brand-tint',
            focusRing,
          )}
        >
          <ChevronLeft aria-hidden="true" className="size-6" />
        </Link>
      )}
      {logo && (
        <img src="/logo.png" alt="PAIÁ" className="block h-[30px] w-auto mix-blend-multiply" />
      )}
      {title && <h1 className="m-0 flex-1 font-display text-title font-bold text-ink">{title}</h1>}
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </header>
  );
}
