// Ecrã C05 · Lojas.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useDocumentTitle } from '@/lib/use-document-title';
import { CartButton } from './components/CartButton';
import { CatalogSkeleton } from './components/CatalogSkeleton';
import { CategoryChips } from './components/CategoryChips';
import { EmptyState } from './components/EmptyState';
import { LoadError } from './components/LoadError';
import { SearchField } from './components/SearchField';
import { StoreCard } from './components/StoreCard';
import { StoreLink } from './components/StoreLink';
import { useCategories, useStores } from './queries';
import { MAX_QUERY_LENGTH, parseExploreParams } from './search-params';

const SEARCH_DELAY_MS = 300;

export function StoresPage() {
  useDocumentTitle('Lojas');
  const [searchParams, setSearchParams] = useSearchParams();
  const { q, categoria } = parseExploreParams(searchParams);
  const [text, setText] = useState(q);
  const debounced = useDebouncedValue(text, SEARCH_DELAY_MS);

  // Depois da pausa, o q passa para o URL (sem nova entrada no histórico). Só quando o valor
  // com atraso muda: o setSearchParams muda a cada navegação e reescreveria um q já limpo.
  const pushed = useRef(debounced);
  useEffect(() => {
    if (pushed.current === debounced) return;
    pushed.current = debounced;
    const next = debounced.trim().slice(0, MAX_QUERY_LENGTH);
    setSearchParams(
      (prev) => {
        if ((prev.get('q') ?? '') === next) return prev;
        const sp = new URLSearchParams(prev);
        if (next) sp.set('q', next);
        else sp.delete('q');
        return sp;
      },
      { replace: true },
    );
  }, [debounced, setSearchParams]);

  function setCategory(slug: string | null) {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (slug) sp.set('categoria', slug);
        else sp.delete('categoria');
        return sp;
      },
      { replace: true },
    );
  }

  function clearSearch() {
    setText('');
    setSearchParams({}, { replace: true });
  }

  const categories = useCategories();
  const stores = useStores({ q: q || undefined, categorySlug: categoria ?? undefined });
  const [attempt, setAttempt] = useState(0);
  function retry() {
    setAttempt((a) => a + 1);
    void stores.refetch();
  }
  const filtered = Boolean(q || categoria);

  return (
    <PageShell
      nav="lojas"
      header={<AppHeader title="Lojas" actions={<CartButton />} />}
      className="gap-4.5"
    >
      <SearchField
        label="Pesquisar lojas"
        placeholder="Nome da loja"
        value={text}
        onChange={setText}
      />

      <CategoryChips
        aria-label="Filtrar por categoria"
        allLabel="Todas"
        categories={categories.data ?? []}
        value={categoria}
        onChange={setCategory}
      />

      <p className="m-0 font-body text-caption font-medium text-ink-muted">
        Só aparecem lojas aprovadas pela equipa do PAIÁ.
      </p>

      {stores.isPending && (
        <CatalogSkeleton
          key={attempt}
          variant="section"
          label="A carregar lojas…"
          onRetry={retry}
        />
      )}

      {stores.isError && (
        <LoadError error={stores.error} retrying={stores.isFetching} onRetry={retry} />
      )}

      {stores.isSuccess && stores.data.length === 0 && (
        <EmptyState
          title="Nenhuma loja encontrada."
          text={
            filtered
              ? 'Experimenta outro nome ou outra categoria.'
              : 'Quando a equipa aprovar as primeiras lojas, aparecem aqui.'
          }
          action={
            filtered ? (
              <Button variant="secondary" size="sm" onClick={clearSearch}>
                Limpar pesquisa
              </Button>
            ) : undefined
          }
        />
      )}

      {stores.isSuccess && stores.data.length > 0 && (
        <>
          <StoreCard store={stores.data[0]!} variant="feature" headingLevel="h2" />
          {stores.data.length > 1 && (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {stores.data.slice(1).map((store) => (
                <li key={store.id}>
                  <StoreLink store={store} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageShell>
  );
}
