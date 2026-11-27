// Ecrãs C02 · Explorar e K07 · Explorar sem resultados.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn, focusRing } from '@/lib/utils';
import { CartButton } from './components/CartButton';
import { CatalogSkeleton } from './components/CatalogSkeleton';
import { CategoryChips } from './components/CategoryChips';
import { EmptyState } from './components/EmptyState';
import { LoadError } from './components/LoadError';
import { ProductCard } from './components/ProductCard';
import { SearchField } from './components/SearchField';
import { StoreLink } from './components/StoreLink';
import { useCategories, useProducts, useStores } from './queries';
import { parseExploreParams, toExploreSearch, type ExploreParams } from './search-params';
import type { ProductSort } from './types';
import { useLoadMoreFocus } from './use-load-more-focus';
import { useSearchText } from './use-search-text';

const MAX_STORES = 3;

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'preco-asc', label: 'Preço mais baixo' },
  { value: 'preco-desc', label: 'Preço mais alto' },
];

/** «4 produtos», «1 produto», «24+ produtos». */
function productCount(n: number, more: boolean) {
  return `${n}${more ? '+' : ''} ${n === 1 && !more ? 'produto' : 'produtos'}`;
}

/** Título de secção (p-kicker), com uma lista de StoreLink. */
function StoreList({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <h2
        id={id}
        className="m-0 font-display text-label font-bold tracking-[0.08em] text-ink uppercase"
      >
        {title}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">{children}</ul>
    </section>
  );
}

/** Lojas cujo nome corresponde à pesquisa (só com q). Secundária: sem esqueleto nem erro próprios. */
function MatchingStores({ q, categorySlug }: { q: string; categorySlug?: string }) {
  const stores = useStores({ q, categorySlug });
  const list = (stores.data ?? []).slice(0, MAX_STORES);
  if (list.length === 0) return null;
  return (
    <StoreList title="Lojas">
      {list.map((store) => (
        <li key={store.id}>
          <StoreLink store={store} />
        </li>
      ))}
    </StoreList>
  );
}

/** K07: lojas da categoria escolhida, sem repetir as que já aparecem em «Lojas». */
function SuggestedStores({ q, categorySlug }: { q: string; categorySlug: string }) {
  const stores = useStores({ categorySlug });
  const matching = useStores({ q: q || undefined, categorySlug });
  const shown = new Set(q ? (matching.data ?? []).slice(0, MAX_STORES).map((s) => s.id) : []);
  const list = (stores.data ?? []).filter((s) => !shown.has(s.id)).slice(0, MAX_STORES);
  if (list.length === 0) return null;
  return (
    <StoreList title="Talvez te interesse">
      {list.map((store) => (
        <li key={store.id}>
          <StoreLink store={store} />
        </li>
      ))}
    </StoreList>
  );
}

export function ExplorePage() {
  useDocumentTitle('Explorar');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const params = parseExploreParams(searchParams);
  const { q, categoria, ordem } = params;
  const [text, setText] = useSearchText();

  // Categoria e ordem entram no histórico: o Voltar repõe a pesquisa anterior.
  function go(patch: Partial<ExploreParams>) {
    navigate({ search: toExploreSearch({ ...params, ...patch }) });
  }

  const categories = useCategories();
  const categoryName = categoria
    ? categories.data?.find((c) => c.slug === categoria)?.name
    : undefined;

  const products = useProducts({
    q: q || undefined,
    categorySlug: categoria ?? undefined,
    sort: ordem,
  });
  const items = products.data?.pages.flatMap((p) => p.items) ?? [];
  // Com categoria, a contagem e o título esperam pelo nome dela: anunciar o texto sem ele e
  // logo a seguir com ele faria o leitor de ecrã ler duas vezes.
  const waitingName = Boolean(categoria) && categories.isPending;
  const ready = products.isSuccess && !waitingName;
  const empty = ready && items.length === 0;
  const holding = products.isSuccess && items.length === 0 && waitingName;
  const searchKey = `${q}|${categoria ?? ''}|${ordem}`;

  const [attempt, setAttempt] = useState(0);
  function retry() {
    setAttempt((a) => a + 1);
    void products.refetch();
  }

  // «Ver mais produtos»: quando os novos itens chegam, o foco passa para o primeiro deles.
  const listRef = useRef<HTMLUListElement>(null);
  const markLoadMore = useLoadMoreFocus(
    listRef,
    items.length,
    searchKey,
    products.isFetchNextPageError,
  );
  function loadMore() {
    markLoadMore();
    void products.fetchNextPage();
  }

  // «Procurar em tudo»: o botão desaparece, por isso o foco passa para o resultado da pesquisa
  // alargada (a contagem ou, se continuar vazia, o título do estado vazio). Sem novo anúncio:
  // a contagem já é a região status.
  const statusRef = useRef<HTMLParagraphElement>(null);
  const emptyTitleRef = useRef<HTMLHeadingElement>(null);
  const [widenedKey, setWidenedKey] = useState<string | null>(null);
  function searchEverywhere() {
    setWidenedKey(`${q}||${ordem}`);
    go({ categoria: null });
  }
  useEffect(() => {
    if (widenedKey === null || widenedKey !== searchKey || !ready) return;
    setWidenedKey(null);
    (empty ? emptyTitleRef.current : statusRef.current)?.focus();
  }, [widenedKey, searchKey, ready, empty]);

  const sortId = useId();
  const where = `${q ? ` para «${q}»` : ''}${categoryName ? ` em ${categoryName}` : ''}`;

  return (
    <PageShell
      nav="explorar"
      header={<AppHeader title="Explorar" actions={<CartButton />} />}
      className="gap-4.5"
    >
      <SearchField
        label="Pesquisar produtos e lojas"
        placeholder="Bolos, salgados, acessórios…"
        value={text}
        onChange={setText}
      />

      <CategoryChips
        aria-label="Filtrar por categoria"
        categories={categories.data ?? []}
        value={categoria}
        onChange={(slug) => go({ categoria: slug })}
      />

      {/* Fica montado enquanto carrega: o select não perde o foco ao mudar a ordem. */}
      {!empty && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p
            ref={statusRef}
            role="status"
            tabIndex={-1}
            className="m-0 font-body text-caption font-medium text-ink-muted outline-none"
          >
            {ready && (
              <>
                <strong className="text-ink">
                  {productCount(items.length, products.hasNextPage)}
                </strong>
                {where}
              </>
            )}
          </p>
          <div className="flex items-center gap-1.5">
            <label htmlFor={sortId} className="font-body text-caption font-medium text-ink-muted">
              Ordenar
            </label>
            <select
              id={sortId}
              value={ordem}
              onChange={(event) => go({ ordem: event.target.value as ProductSort })}
              className={cn(
                // 16 px para o iPhone não ampliar o ecrã ao abrir.
                'min-h-11 cursor-pointer rounded-md border-2 border-ink bg-surface px-2.5 py-2 font-body text-base text-ink',
                'touch-manipulation',
                focusRing,
              )}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {(products.isPending || holding) && (
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

      {empty &&
        (q ? (
          <EmptyState
            titleRef={emptyTitleRef}
            title={`Nada para «${q}»${categoryName ? ` em ${categoryName}` : ''}`}
            text={
              categoria
                ? 'Experimenta outra palavra ou procura em todas as categorias.'
                : 'Experimenta outra palavra.'
            }
            action={
              categoria ? (
                <Button variant="secondary" onClick={searchEverywhere}>
                  Procurar em tudo
                </Button>
              ) : undefined
            }
          />
        ) : categoria ? (
          <EmptyState
            titleRef={emptyTitleRef}
            title={
              categoryName ? `Ainda não há produtos em ${categoryName}.` : 'Ainda não há produtos.'
            }
            text="Procura em todas as categorias."
            action={
              <Button variant="secondary" onClick={searchEverywhere}>
                Procurar em tudo
              </Button>
            }
          />
        ) : (
          <EmptyState
            titleRef={emptyTitleRef}
            title="Ainda não há produtos."
            text="Quando as lojas publicarem produtos, aparecem aqui."
          />
        ))}

      {items.length > 0 && (
        <ul ref={listRef} className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-4.5 p-0">
          {items.map((product) => (
            <li key={product.id} className="flex min-w-0">
              <ProductCard product={product} showStore />
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

      {q && <MatchingStores q={q} categorySlug={categoria ?? undefined} />}
      {empty && categoria && <SuggestedStores q={q} categorySlug={categoria} />}
    </PageShell>
  );
}
