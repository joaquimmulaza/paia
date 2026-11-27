// Ecrã C03 · Produto.
import { MapPin, Minus, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { comingSoon } from '@/components/paia/ComingSoon';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { formatKz } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn, focusRing } from '@/lib/utils';
import { BackButton } from './components/BackButton';
import { CartButton } from './components/CartButton';
import { CatalogSkeleton } from './components/CatalogSkeleton';
import { LoadError } from './components/LoadError';
import { isNotFound, NotFoundState } from './components/NotFoundState';
import { ProductPhoto } from './components/ProductPhoto';
import { ReportLink } from './components/ReportLink';
import { StoreLink } from './components/StoreLink';
import { formatRating, ratingCount } from './components/store-text';
import { tagClass } from './components/tag-styles';
import { isNew, stockLabel } from './labels';
import { useProduct } from './queries';
import type { ProductDetail } from './types';

const DELIVERY_NOTICE =
  'Entrega dentro da universidade: na sala, num ponto de encontro ou a combinar com o vendedor. O pagamento é combinado diretamente com ele.';

/** «Loja aprovada pelo PAIÁ», mais « · 4,8 (23 avaliações)» só quando há avaliações. */
function storeLine(product: ProductDetail): string {
  const r = product.storeRating;
  const base = 'Loja aprovada pelo PAIÁ';
  return r && r.count > 0 ? `${base} · ${formatRating(r.avg)} (${ratingCount(r.count)})` : base;
}

/** s-photo e s-thumbs: a foto principal e, com 2 ou mais, as miniaturas para a trocar. */
function Photos({ product }: { product: ProductDetail }) {
  const images = [...product.images].sort((a, b) => a.position - b.position);
  const [selected, setSelected] = useState(0);
  // Um refetch pode trazer menos fotos do que a escolhida: mostra-se (e descreve-se) a primeira.
  const idx = images[selected] ? selected : 0;
  const current = images[idx];
  const total = images.length;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="aspect-square overflow-hidden rounded-lg border-2 border-ink">
        <ProductPhoto
          path={current?.path ?? null}
          alt={`${product.name}, foto ${idx + 1} de ${total}`}
          loading="eager"
          className="[&>svg]:size-10"
        />
      </div>
      {total >= 2 && (
        <div role="group" aria-label="Fotos" className="flex flex-wrap gap-2">
          {images.map((image, i) => (
            <button
              key={image.path}
              type="button"
              aria-label={`Foto ${i + 1}`}
              aria-current={i === idx ? 'true' : undefined}
              onClick={() => setSelected(i)}
              className={cn(
                'size-14 flex-none cursor-pointer overflow-hidden rounded-md border-2 border-ink bg-brand-tint p-0',
                'touch-manipulation [-webkit-tap-highlight-color:transparent]',
                'transition-shadow duration-[var(--duration-fast)] ease-[var(--ease-out)]',
                'aria-[current=true]:shadow-hard-sm',
                focusRing,
              )}
            >
              <ProductPhoto path={image.path} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** s-cta: quantidade, total e «Adicionar ao carrinho». Esgotado, só o botão desativado. */
function BuyBar({ product }: { product: ProductDetail }) {
  const [rawQty, setQty] = useState(1);
  const soldOut = product.stock <= 0;
  // Um refetch pode baixar o stock abaixo da quantidade escolhida.
  const qty = Math.min(rawQty, Math.max(1, product.stock));
  const stepper = cn(
    'flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-ink',
    'touch-manipulation [-webkit-tap-highlight-color:transparent] active:not-disabled:bg-brand-tint',
    'disabled:cursor-not-allowed disabled:text-line-muted',
    focusRing,
  );
  return (
    <div className="flex flex-col gap-2.5 border-t-2 border-ink bg-surface px-5 pt-3.5 pb-[max(--spacing(4.5),env(safe-area-inset-bottom))]">
      {!soldOut && (
        <div className="flex items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Quantidade"
            className="inline-flex items-center rounded-md border-2 border-ink bg-surface"
          >
            <button
              type="button"
              aria-label="Diminuir quantidade"
              disabled={qty <= 1}
              onClick={() => setQty(Math.max(1, qty - 1))}
              className={stepper}
            >
              <Minus aria-hidden="true" className="size-4.5" />
            </button>
            <output
              aria-live="polite"
              className="min-w-7 text-center font-display text-base font-bold"
            >
              <span className="sr-only">Quantidade: </span>
              {qty}
            </output>
            <button
              type="button"
              aria-label="Aumentar quantidade"
              disabled={qty >= product.stock}
              onClick={() => setQty(Math.min(product.stock, qty + 1))}
              className={stepper}
            >
              <Plus aria-hidden="true" className="size-4.5" />
            </button>
          </div>
          <span data-testid="cta-total" className="font-display text-title font-bold">
            <span className="sr-only">Total: </span>
            {formatKz(product.priceKz * qty)}
          </span>
        </div>
      )}
      <Button className="w-full" disabled={soldOut} onClick={comingSoon}>
        {soldOut ? 'Esgotado' : 'Adicionar ao carrinho'}
      </Button>
    </div>
  );
}

function ProductView({ product }: { product: ProductDetail }) {
  const descriptionId = useId();
  const stock = stockLabel(product.stock);
  const soldOut = stock.kind === 'soldout';
  return (
    <>
      <Photos product={product} />
      <div className="flex flex-col gap-2">
        {(product.categoryName || isNew(product.createdAt)) && (
          <div className="flex flex-wrap items-center gap-2">
            {product.categoryName && (
              <span data-tag="neutral" className={tagClass.neutral}>
                {product.categoryName}
              </span>
            )}
            {/* No cabeçalho do produto, o «Novo» fica direito, como no canvas. */}
            {isNew(product.createdAt) && <span className={cn(tagClass.new, 'rotate-0')}>Novo</span>}
          </div>
        )}
        <h1 className="m-0 font-display text-[26px] leading-[30px] font-bold wrap-break-word hyphens-auto">
          {product.name}
        </h1>
        <p
          data-testid="product-price"
          className={cn(
            'm-0 font-display text-[32px] leading-[34px] font-bold tracking-[-0.02em]',
            soldOut ? 'text-ink-muted' : 'text-ink',
          )}
        >
          {formatKz(product.priceKz)}
        </p>
        <p data-testid="product-stock" className="m-0">
          {stock.kind === null ? (
            <span className="font-body text-caption font-medium text-ink-muted">
              {product.stock} {product.stock === 1 ? 'disponível' : 'disponíveis'}
            </span>
          ) : (
            <span className={stock.kind === 'soldout' ? tagClass.soldout : tagClass.waiting}>
              {stock.text}
            </span>
          )}
        </p>
      </div>

      <StoreLink
        store={{ name: product.storeName, slug: product.storeSlug }}
        meta={storeLine(product)}
      />

      {product.description && (
        <section aria-labelledby={descriptionId} className="flex flex-col gap-1.5">
          <h2
            id={descriptionId}
            className="m-0 font-display text-label font-bold tracking-[0.08em] text-ink uppercase"
          >
            Descrição
          </h2>
          <p className="m-0 font-body text-body wrap-break-word whitespace-pre-line">
            {product.description}
          </p>
        </section>
      )}

      <div className="flex items-start gap-2.5 rounded-md border-2 border-ink bg-info-tint px-3.5 py-3 font-body text-[14px] leading-5">
        <MapPin aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
        <p className="m-0">{DELIVERY_NOTICE}</p>
      </div>

      <ReportLink kind="produto" />
    </>
  );
}

export function ProductPage() {
  const { id = '' } = useParams();
  const product = useProduct(id);
  const notFound = product.isError && isNotFound(product.error);
  useDocumentTitle(product.data?.name ?? (notFound ? 'Não encontrado' : undefined));

  const [attempt, setAttempt] = useState(0);
  function retry() {
    setAttempt((a) => a + 1);
    void product.refetch();
  }

  const data = product.data;
  return (
    <PageShell
      // Sem navegação inferior em nenhum estado: o rodapé não salta entre carregar e carregado.
      footer={data ? <BuyBar key={data.id} product={data} /> : undefined}
      header={<AppHeader start={<BackButton />} actions={<CartButton />} />}
      className="gap-4.5"
    >
      {product.isPending && (
        <CatalogSkeleton
          key={attempt}
          variant="section"
          label="A carregar produto…"
          onRetry={retry}
        />
      )}
      {notFound && <NotFoundState text="Este produto não existe ou já não está disponível." />}
      {product.isError && !notFound && (
        <LoadError error={product.error} retrying={product.isFetching} onRetry={retry} />
      )}
      {data && <ProductView key={data.id} product={data} />}
    </PageShell>
  );
}
