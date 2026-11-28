// Ecrãs V05 · Produtos e V05b · estados: separadores com contagens, vazio, sem resultados no
// filtro, a carregar, erro e o produto ocultado pela administração (só o selo e o motivo).
import { ImageIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/features/catalog/components/EmptyState';
import { LoadError } from '@/features/catalog/components/LoadError';
import { ProductPhoto } from '@/features/catalog/components/ProductPhoto';
import { tagClass } from '@/features/catalog/components/tag-styles';
import { useLoadMoreFocus } from '@/features/catalog/use-load-more-focus';
import { MESSAGES } from '@/lib/errors';
import { formatKz } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn, focusRing } from '@/lib/utils';
import { useApprovedStore } from './components/approved-store';
import { BackLink } from './components/seller-ui';
import {
  FILTER_EMPTY,
  FILTER_LABEL,
  FILTER_PARAM,
  FILTERS,
  filterFromParam,
  productState,
  type ProductState,
} from './product-filters';
import { useMyProductCounts, useMyProducts } from './queries';
import type { MyProduct, ProductFilter } from './types';

const header = (
  <AppHeader
    start={<BackLink to="/vender/loja" label="Voltar ao painel" />}
    title="Produtos"
    actions={
      <Button asChild variant="primary" size="sm">
        <Link to="/vender/produtos/novo">Novo</Link>
      </Button>
    }
  />
);

export function ProductsPage() {
  useDocumentTitle('Produtos');
  const { store, gate } = useApprovedStore(header);
  if (!store) return gate;
  return (
    <PageShell nav="perfil" header={header} className="gap-3.5">
      <ProductList storeId={store.id} />
    </PageShell>
  );
}

const chipClass = cn(
  'inline-flex min-h-11 flex-none items-center rounded-md border border-ink bg-surface px-3.5',
  'font-display text-label font-bold tracking-[0.04em] whitespace-nowrap text-ink uppercase',
  'cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'aria-pressed:bg-ink aria-pressed:text-on-ink not-aria-pressed:active:bg-brand-tint',
  focusRing,
);
const listClass =
  'm-0 flex list-none flex-col overflow-hidden rounded-md border border-ink bg-surface p-0';

function ProductList({ storeId }: { storeId: string }) {
  const [params, setParams] = useSearchParams();
  const filter = filterFromParam(params.get('filtro'));
  const counts = useMyProductCounts(storeId);
  const products = useMyProducts(storeId, filter);
  const items = products.data?.pages.flatMap((p) => p.items) ?? [];

  const listRef = useRef<HTMLUListElement>(null);
  const markLoadMore = useLoadMoreFocus(
    listRef,
    items.length,
    filter,
    products.isFetchNextPageError,
  );
  function loadMore() {
    markLoadMore();
    void products.fetchNextPage();
  }

  // Remonta o esqueleto a cada nova tentativa (o leitor de ecrã volta a ouvir o estado).
  const [attempt, setAttempt] = useState(0);
  function retry() {
    setAttempt((a) => a + 1);
    void products.refetch();
  }

  function choose(next: ProductFilter) {
    setParams(next === 'all' ? {} : { filtro: FILTER_PARAM[next] });
  }

  const noProducts =
    counts.data?.all === 0 || (filter === 'all' && products.isSuccess && items.length === 0);

  if (noProducts) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="Ainda não tens produtos"
        text="Junta fotos, preço e stock. Ficam logo visíveis na tua loja."
        action={
          <Button asChild variant="primary">
            <Link to="/vender/produtos/novo">Publicar produto</Link>
          </Button>
        }
      />
    );
  }

  const loadError =
    products.error instanceof Error && products.error.message !== MESSAGES.generic
      ? products.error
      : new Error(MESSAGES.productsLoadFailed);

  return (
    <>
      <div
        role="group"
        aria-label="Filtrar produtos"
        className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pt-0.5 pb-2 [scrollbar-width:none]"
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={f === filter}
            onClick={() => choose(f)}
            className={chipClass}
          >
            {counts.data ? `${FILTER_LABEL[f]} · ${counts.data[f]}` : FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {products.isPending && (
        <div key={attempt} role="status" className="flex flex-col gap-2">
          <span className="sr-only">A carregar os produtos…</span>
          {[0, 1, 2].map((i) => (
            <span key={i} aria-hidden="true" className="block h-15 rounded-sm bg-brand-tint" />
          ))}
        </div>
      )}

      {products.isSuccess && items.length === 0 && filter !== 'all' && (
        <div role="status" className={listClass}>
          <p className="m-0 px-3.5 py-4.5 font-body text-caption font-medium text-ink">
            {FILTER_EMPTY[filter]}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <ul ref={listRef} aria-label="Produtos" className={listClass}>
          {items.map((p) => (
            <li key={p.id} className="border-t border-line-muted first:border-t-0">
              <ProductRow product={p} />
            </li>
          ))}
        </ul>
      )}

      {products.isError && (
        <LoadError error={loadError} retrying={products.isFetching} onRetry={retry} />
      )}

      {products.hasNextPage && !products.isFetchNextPageError && (
        <Button
          variant="secondary"
          className="self-center"
          loading={products.isFetchingNextPage}
          onClick={loadMore}
        >
          Carregar mais
        </Button>
      )}

      <p className="m-0 font-body text-small font-medium text-ink-muted">
        Oculto: só tu vês. Esgotado: aparece na loja, mas ninguém o pode pedir até repores o stock.
      </p>
    </>
  );
}

const TAG: Record<ProductState, { label: string; className: string }> = {
  published: { label: 'Publicado', className: tagClass.done },
  sold_out: { label: 'Esgotado', className: tagClass.soldout },
  hidden: { label: 'Oculto', className: tagClass.neutral },
  moderated: { label: 'Ocultado', className: tagClass.cancelled },
};

function ProductRow({ product: p }: { product: MyProduct }) {
  const state = productState(p);
  const tag = TAG[state];
  const meta =
    state === 'moderated'
      ? `Ocultado pela equipa${p.moderationReason ? `: ${p.moderationReason}` : ''}`
      : `${formatKz(p.priceKz)} · ${p.stock} em stock`;
  return (
    <Link
      to={`/vender/produtos/${p.id}`}
      className={cn(
        'flex min-h-[60px] items-center gap-3 px-3.5 py-2.5 text-ink no-underline',
        'touch-manipulation [-webkit-tap-highlight-color:transparent] active:bg-brand-tint',
        focusRing,
        '-outline-offset-[3px]',
      )}
    >
      <span className="block size-12 flex-none overflow-hidden rounded-md border-2 border-ink">
        <ProductPhoto path={p.mainImagePath} alt="" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-body text-[15px] leading-5 font-bold">{p.name}</span>{' '}
        <span className="font-body text-small font-medium break-words text-ink-muted">{meta}</span>
      </span>{' '}
      <span className={cn(tag.className, 'flex-none')}>{tag.label}</span>
    </Link>
  );
}
