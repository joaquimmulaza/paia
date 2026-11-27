// Ecrã C04 · Página da loja.
import { useId, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/use-document-title';
import { ApprovedStoreTag } from './components/PromotedTag';
import { BackButton } from './components/BackButton';
import { CartButton } from './components/CartButton';
import { CatalogSkeleton } from './components/CatalogSkeleton';
import { CategoryChips } from './components/CategoryChips';
import { EmptyState } from './components/EmptyState';
import { LoadError } from './components/LoadError';
import { isNotFound, NotFoundState } from './components/NotFoundState';
import { ProductCard } from './components/ProductCard';
import { ReportLink } from './components/ReportLink';
import { formatRating, ratingCount, storeInitials } from './components/store-text';
import { publicImageUrl } from './labels';
import { useProducts, useStore } from './queries';
import type { StoreDetail } from './types';
import { useLoadMoreFocus } from './use-load-more-focus';

/** s-mark--lg: o logótipo da loja ou, sem ele, as iniciais. */
function StoreMark({ store }: { store: StoreDetail }) {
  const box =
    'flex size-18 flex-none items-center justify-center overflow-hidden rounded-lg border-2 border-ink bg-brand';
  if (store.logoPath) {
    return (
      <span className={box}>
        <img
          src={publicImageUrl('store-media', store.logoPath)}
          alt=""
          className="block size-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} font-display text-[28px] leading-none font-bold text-ink`}
    >
      {storeInitials(store.name)}
    </span>
  );
}

function StoreHeader({ store }: { store: StoreDetail }) {
  const rating = store.rating && store.rating.count > 0 ? store.rating : null;
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3.5 rounded-lg border-2 border-ink bg-surface p-4 shadow-hard"
    >
      <div className="flex items-start gap-3.5">
        <StoreMark store={store} />
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <h1
            id={titleId}
            className="m-0 font-display text-[28px] leading-[30px] font-bold wrap-break-word hyphens-auto"
          >
            {store.name}
          </h1>
          <ApprovedStoreTag />
        </div>
      </div>
      {store.description && (
        <p className="m-0 font-body text-body wrap-break-word whitespace-pre-line">
          {store.description}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {rating && (
          <span data-testid="store-rating" className="font-display text-body font-bold">
            {formatRating(rating.avg)}{' '}
            <span className="font-body text-caption font-medium text-ink-muted">
              · {ratingCount(rating.count)}
            </span>
          </span>
        )}
        <span className="font-body text-caption font-medium text-ink-muted">
          {store.productCount} {store.productCount === 1 ? 'produto' : 'produtos'}
        </span>
      </div>
    </section>
  );
}

function StoreProducts({ store }: { store: StoreDetail }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requested = searchParams.get('categoria');
  // Um slug que a loja não tem vale «Tudo».
  const categoria =
    requested && store.productCategories.some((c) => c.slug === requested) ? requested : null;
  const products = useProducts({
    storeSlug: store.slug,
    categorySlug: categoria ?? undefined,
    sort: 'recentes',
  });
  const items = products.data?.pages.flatMap((p) => p.items) ?? [];

  // A categoria entra no histórico: o Voltar repõe o filtro anterior.
  function choose(slug: string | null) {
    navigate({ search: slug ? `?${new URLSearchParams({ categoria: slug })}` : '' });
  }

  const [attempt, setAttempt] = useState(0);
  function retry() {
    setAttempt((a) => a + 1);
    void products.refetch();
  }

  const listRef = useRef<HTMLUListElement>(null);
  const markLoadMore = useLoadMoreFocus(
    listRef,
    items.length,
    categoria ?? '',
    products.isFetchNextPageError,
  );
  function loadMore() {
    markLoadMore();
    void products.fetchNextPage();
  }

  return (
    <>
      {store.productCategories.length > 0 && (
        <CategoryChips
          aria-label="Filtrar produtos da loja"
          categories={store.productCategories.map((c) => ({ id: c.slug, ...c }))}
          value={categoria}
          onChange={choose}
        />
      )}

      <section aria-label="Produtos" className="flex flex-col gap-5">
        {products.isPending && (
          <CatalogSkeleton
            key={attempt}
            variant="section"
            label="A carregar produtos…"
            onRetry={retry}
          />
        )}
        {products.isError && (
          <LoadError error={products.error} retrying={products.isFetching} onRetry={retry} />
        )}
        {products.isSuccess && items.length === 0 && (
          <EmptyState
            title="Ainda não há produtos."
            text="Quando a loja publicar produtos, aparecem aqui."
          />
        )}
        {items.length > 0 && (
          <ul ref={listRef} className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-4.5 p-0">
            {items.map((product) => (
              <li key={product.id} className="flex min-w-0">
                <ProductCard product={product} showStore={false} />
              </li>
            ))}
          </ul>
        )}
        {products.hasNextPage && (
          <Button
            variant="secondary"
            className="self-center"
            loading={products.isFetchingNextPage}
            onClick={loadMore}
          >
            Ver mais produtos
          </Button>
        )}
      </section>
    </>
  );
}

export function StorePage() {
  const { slug = '' } = useParams();
  const store = useStore(slug);
  const notFound = store.isError && isNotFound(store.error);
  useDocumentTitle(store.data?.name ?? (notFound ? 'Não encontrado' : undefined));

  const [attempt, setAttempt] = useState(0);
  function retry() {
    setAttempt((a) => a + 1);
    void store.refetch();
  }

  const data = store.data;
  return (
    <PageShell
      nav="lojas"
      header={<AppHeader start={<BackButton />} actions={<CartButton />} />}
      className="gap-5"
    >
      {store.isPending && (
        <CatalogSkeleton key={attempt} variant="section" label="A carregar loja…" onRetry={retry} />
      )}
      {notFound && <NotFoundState text="Esta loja não existe ou já não está disponível." />}
      {store.isError && !notFound && (
        <LoadError error={store.error} retrying={store.isFetching} onRetry={retry} />
      )}
      {data && (
        <>
          <StoreHeader store={data} />
          <StoreProducts store={data} />
          {/* Avaliações (C04): só aparecem quando existem. As linhas de avaliação chegam em F4,
              e até lá a secção fica de fora, mesmo com `rating`. */}
          <ReportLink kind="loja" />
        </>
      )}
    </PageShell>
  );
}
