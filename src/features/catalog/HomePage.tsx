// Ecrã C01b · Início com lojas em destaque (aprovado pelo responsável).
import { Search } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { comingSoon } from '@/components/paia/ComingSoon';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn, focusRing } from '@/lib/utils';
import { CartButton } from './components/CartButton';
import { CatalogSkeleton } from './components/CatalogSkeleton';
import { CategoryChips } from './components/CategoryChips';
import { EmptyState } from './components/EmptyState';
import { LoadError } from './components/LoadError';
import { NotificationsButton } from './components/NotificationsButton';
import { ProductCard } from './components/ProductCard';
import { StoreCard } from './components/StoreCard';
import { StoreLink } from './components/StoreLink';
import { useCategories, useFeaturedStores, useProducts, useStores } from './queries';
import { toExploreSearch } from './search-params';

const NEWS_LIMIT = 6;
const FALLBACK_STORES = 3;

// s-hscroll: a fila desliza de margem a margem do ecrã (as páginas têm 20 px de lado).
const hscroll =
  '-mx-5 my-0 flex list-none overflow-x-auto px-5 pt-0.5 pb-2.5 [scrollbar-width:none]';

/** Título de secção (p-kicker) com a ligação «Ver …» à direita (s-sechead). */
function Section({
  title,
  link,
  children,
}: {
  title: string;
  link: { to: string; text: string };
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          id={id}
          className="m-0 font-display text-label font-bold tracking-[0.08em] text-ink uppercase"
        >
          {title}
        </h2>
        <Button asChild variant="link" size="sm">
          <Link to={link.to}>{link.text}</Link>
        </Button>
      </div>
      {children}
    </section>
  );
}

/** Pedido com esqueleto, erro e nova tentativa: o esqueleto remonta para os 10 s recomeçarem. */
function useRetry(refetch: () => unknown) {
  const [attempt, setAttempt] = useState(0);
  return {
    attempt,
    retry: () => {
      setAttempt((a) => a + 1);
      void refetch();
    },
  };
}

function FallbackStores() {
  const stores = useStores({});
  const { attempt, retry } = useRetry(stores.refetch);
  if (stores.isPending) {
    return (
      <CatalogSkeleton key={attempt} variant="section" label="A carregar lojas…" onRetry={retry} />
    );
  }
  if (stores.isError) {
    return <LoadError error={stores.error} retrying={stores.isFetching} onRetry={retry} />;
  }
  if (stores.data.length === 0) {
    return (
      <EmptyState
        title="Ainda não há lojas."
        text="Quando a equipa aprovar as primeiras lojas, aparecem aqui."
      />
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {stores.data.slice(0, FALLBACK_STORES).map((store) => (
        <li key={store.id}>
          <StoreLink store={store} />
        </li>
      ))}
    </ul>
  );
}

function CommunityStores() {
  const featured = useFeaturedStores();
  const { attempt, retry } = useRetry(featured.refetch);
  if (featured.isPending) {
    return (
      <CatalogSkeleton key={attempt} variant="section" label="A carregar lojas…" onRetry={retry} />
    );
  }
  if (featured.isError) {
    return <LoadError error={featured.error} retrying={featured.isFetching} onRetry={retry} />;
  }
  if (featured.data.length === 0) return <FallbackStores />;
  return (
    <ul className={cn(hscroll, 'gap-3.5')}>
      {featured.data.map((store) => (
        <li key={store.id} className="w-[300px] flex-none">
          <StoreCard store={store} variant="feature" className="h-full" />
        </li>
      ))}
    </ul>
  );
}

function News() {
  const products = useProducts({ sort: 'recentes', limit: NEWS_LIMIT });
  const { attempt, retry } = useRetry(products.refetch);
  if (products.isPending) {
    return (
      <CatalogSkeleton
        key={attempt}
        variant="section"
        label="A carregar produtos…"
        onRetry={retry}
      />
    );
  }
  if (products.isError) {
    return <LoadError error={products.error} retrying={products.isFetching} onRetry={retry} />;
  }
  // Só a primeira página: a lista completa fica no Explorar.
  const items = (products.data.pages[0]?.items ?? []).slice(0, NEWS_LIMIT);
  if (items.length === 0) {
    return (
      <EmptyState
        title="Ainda não há produtos."
        text="Quando as lojas publicarem produtos, aparecem aqui."
      />
    );
  }
  return (
    <ul className={cn(hscroll, 'gap-4')}>
      {items.map((product) => (
        <li key={product.id} className="flex w-[168px] flex-none">
          <ProductCard product={product} showStore />
        </li>
      ))}
    </ul>
  );
}

export function HomePage() {
  useDocumentTitle();
  const categories = useCategories();

  return (
    <PageShell
      nav="inicio"
      header={
        <AppHeader
          logo
          actions={
            <>
              <NotificationsButton />
              <CartButton />
            </>
          }
        />
      }
    >
      <h1 className="m-0 font-display text-display-xl font-bold text-ink uppercase">
        O que procuras{' '}
        <mark className="rounded-sm bg-brand px-1.5 text-ink [box-decoration-break:clone]">
          hoje?
        </mark>
      </h1>

      {/* Atalho para o Explorar, com o aspeto do campo de pesquisa (p-search). */}
      <Link
        to="/explorar"
        className={cn(
          'flex min-h-[52px] items-center gap-2.5 rounded-md border-2 border-ink bg-surface py-3 pr-4 pl-3.5 shadow-hard',
          'font-body text-base text-ink-muted no-underline',
          'touch-manipulation [-webkit-tap-highlight-color:transparent] active:bg-brand-tint',
          focusRing,
        )}
      >
        <Search aria-hidden="true" className="size-6 flex-none text-ink" />
        <span className="sr-only">Pesquisar: </span>
        Bolos, salgados, acessórios…
      </Link>

      {/* Sem categorias (a carregar ou com erro) fica só «Tudo», que já leva ao Explorar. */}
      <CategoryChips
        aria-label="Categorias"
        categories={categories.data ?? []}
        value={null}
        hrefFor={(slug) =>
          `/explorar${toExploreSearch({ q: '', categoria: slug, ordem: 'recentes' })}`
        }
      />

      <Section title="Lojas da comunidade" link={{ to: '/lojas', text: 'Ver todas' }}>
        <CommunityStores />
      </Section>

      <Section title="Novidades na comunidade" link={{ to: '/explorar', text: 'Ver tudo' }}>
        <News />
      </Section>

      <SellCard />
    </PageShell>
  );
}

function SellCard() {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-lg border-2 border-ink bg-brand-tint p-4 shadow-hard"
    >
      <h2 id={id} className="m-0 font-display text-title font-bold text-ink">
        Tens alguma coisa para vender?
      </h2>
      <p className="m-0 font-body text-body text-ink">
        Cria a tua loja no PAIÁ. A equipa analisa o pedido e avisa-te quando a loja estiver
        aprovada.
      </p>
      <Button variant="accent" className="self-start" onClick={comingSoon}>
        Quero vender
      </Button>
    </section>
  );
}
