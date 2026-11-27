// Design system: LigacaoLoja (s-storelink), com a marca s-mark.
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, focusRing } from '@/lib/utils';
import type { StoreSummary } from '../types';
import { storeInitials, storeMeta } from './store-text';

export function StoreLink({ store, className }: { store: StoreSummary; className?: string }) {
  return (
    <Link
      to={`/loja/${store.slug}`}
      className={cn(
        'flex items-center gap-3 rounded-lg border-2 border-ink bg-surface p-3 text-ink no-underline',
        'touch-manipulation [-webkit-tap-highlight-color:transparent] active:bg-brand-tint',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
        focusRing,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-11 flex-none items-center justify-center rounded-md border-2 border-ink bg-brand font-display text-lg leading-none font-bold text-ink"
      >
        {storeInitials(store.name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="font-body text-body font-bold wrap-break-word">{store.name}</strong>
        <span className="font-body text-caption font-medium text-ink-muted">
          {storeMeta(store, 'Ainda sem avaliações')}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-6 flex-none" />
    </Link>
  );
}
