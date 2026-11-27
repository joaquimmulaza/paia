// Design system: CartaoLoja (p-scard--feature).
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FeaturedStore, StoreSummary } from '../types';
import { PromotedTag } from './PromotedTag';
import { storeInitials, storeMeta } from './store-text';

type StoreCardProps = {
  store: StoreSummary | FeaturedStore;
  /** Só existe a variante de destaque (fundo ink); fica explícita para quando vier a de lista (p-scard--list). */
  variant: 'feature';
  /** Nível do título: h3 dentro de uma secção (C01), h2 numa lista de topo (C05). */
  headingLevel?: 'h2' | 'h3';
  className?: string;
};

export function StoreCard({ store, headingLevel = 'h3', className }: StoreCardProps) {
  const Heading = headingLevel;
  const isPromoted = 'isPromoted' in store && store.isPromoted;
  return (
    <article
      data-surface="ink"
      className={cn(
        'relative flex w-full flex-col gap-3.5 rounded-lg border-2 border-ink bg-ink p-4 text-on-ink shadow-hard',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-[52px] flex-none items-center justify-center rounded-md border-2 border-on-ink bg-brand font-display text-xl leading-none font-bold text-ink"
        >
          {storeInitials(store.name)}
        </span>
        <div className="min-w-0">
          <Heading className="m-0 font-display text-title font-bold wrap-break-word">
            {store.name}
          </Heading>
          <p className="m-0 font-body text-caption font-medium text-on-ink-muted">
            {storeMeta(store)}
          </p>
        </div>
      </div>
      {isPromoted && (
        <span className="self-start">
          <PromotedTag isPromoted />
        </span>
      )}
      {store.description && (
        <p className="m-0 font-body text-body wrap-break-word">{store.description}</p>
      )}
      <Button asChild variant="secondary" size="sm" className="self-start">
        <Link to={`/loja/${store.slug}`}>Ver loja</Link>
      </Button>
    </article>
  );
}
