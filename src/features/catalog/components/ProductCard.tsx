// Design system: CartaoProduto (p-pcard).
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { comingSoon } from '@/components/paia/ComingSoon';
import { Button } from '@/components/ui/button';
import { formatKz } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isNew, stockLabel } from '../labels';
import type { CatalogProduct } from '../types';
import { ProductPhoto } from './ProductPhoto';
import { tagClass } from './tag-styles';

type ProductCardProps = {
  product: CatalogProduct;
  /** Mostra o nome da loja por baixo do nome do produto. */
  showStore?: boolean;
  className?: string;
};

// Hover só com rato; premido entra em 0 ms. Com movimento reduzido, --hover-lift e --press-offset valem 0.
const cardMotion = [
  'transition-[transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  '[@media(hover:hover)]:has-[a:hover]:-translate-x-[var(--hover-lift)] [@media(hover:hover)]:has-[a:hover]:-translate-y-[var(--hover-lift)] [@media(hover:hover)]:has-[a:hover]:shadow-hard-hover',
  'has-[a:active]:translate-x-[var(--press-offset)] has-[a:active]:translate-y-[var(--press-offset)] has-[a:active]:shadow-none has-[a:active]:duration-0',
];

// Ligação esticada: o ::after cobre o cartão e leva o anel de foco à volta dele.
const stretchedLink = [
  'text-ink no-underline outline-hidden touch-manipulation [-webkit-tap-highlight-color:transparent]',
  "after:absolute after:inset-0 after:rounded-lg after:content-['']",
  'focus-visible:after:outline-solid focus-visible:after:outline-[length:var(--focus-ring-width)] focus-visible:after:outline-offset-[var(--focus-ring-offset)] focus-visible:after:outline-[color:var(--ring-color,var(--focus-ring))]',
].join(' ');

export function ProductCard({ product, showStore = false, className }: ProductCardProps) {
  const stock = stockLabel(product.stock);
  const soldOut = stock.kind === 'soldout';
  const tag =
    stock.kind === 'soldout'
      ? { className: tagClass.soldout, text: stock.text }
      : stock.kind === 'last'
        ? { className: tagClass.waiting, text: stock.text }
        : isNew(product.createdAt)
          ? { className: tagClass.new, text: 'Novo' }
          : null;

  return (
    <article
      className={cn(
        'relative flex w-full min-w-0 flex-col rounded-lg border-2 border-ink bg-surface shadow-hard',
        cardMotion,
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-t-[calc(var(--radius-lg)-2px)] border-b-2 border-ink">
        <ProductPhoto
          path={product.mainImagePath}
          // Decorativa: o nome já está na ligação do h3, mesmo ao lado.
          alt=""
          className={soldOut ? 'bg-paper' : undefined}
        />
        {tag && <span className={cn(tag.className, 'absolute top-2 left-2')}>{tag.text}</span>}
      </div>
      <div className="flex flex-col gap-0.5 px-3 pt-2.5 pb-3">
        <h3 className="m-0 font-body text-body font-bold wrap-break-word hyphens-auto">
          <Link to={`/produto/${product.id}`} className={stretchedLink}>
            {product.name}
          </Link>
        </h3>
        {showStore && (
          <p className="m-0 font-body text-caption font-medium text-ink-muted">
            {product.storeName}
          </p>
        )}
        {/* Quebra linha quando o cartão é estreito: o preço nunca se parte nem passa por baixo do botão. */}
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <span
            data-testid="product-price"
            className={cn(
              'min-w-0 font-display text-price font-bold whitespace-nowrap',
              soldOut ? 'text-ink-muted' : 'text-ink',
            )}
          >
            {formatKz(product.priceKz)}
            {soldOut && <span className="sr-only"> · indisponível</span>}
          </span>
          {/* Fica acima da ligação esticada e é a sua própria paragem de Tab. */}
          <Button
            variant="icon"
            className="relative z-1 ml-auto"
            aria-label={
              soldOut ? `${product.name} esgotado` : `Adicionar ${product.name} ao carrinho`
            }
            disabled={soldOut}
            onClick={comingSoon}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  );
}
