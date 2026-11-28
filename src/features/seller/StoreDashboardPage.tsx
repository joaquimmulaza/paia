// Ecrã V04b · Painel de uma loja nova. Os números vêm de get_my_store; os pedidos e as
// avaliações do V04 entram no F3 e no F4 («Pedidos recebidos» fica «Disponível em breve»).
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { COMING_SOON_TEXT, comingSoon } from '@/components/paia/ComingSoon';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn, focusRing } from '@/lib/utils';
import { useApprovedStore } from './components/approved-store';
import { BackLink, h2Class } from './components/seller-ui';
import { StoreTag } from './components/StoreTag';
import { FILTER_PARAM } from './product-filters';

const back = <BackLink to="/perfil" label="Voltar ao perfil" />;

const statClass = cn(
  'flex flex-col gap-0.5 rounded-md border border-ink bg-surface px-3.5 py-3 text-ink no-underline',
  'touch-manipulation [-webkit-tap-highlight-color:transparent] active:bg-brand-tint',
  focusRing,
);
const rowClass = cn(
  'flex min-h-[60px] items-center gap-3 border-t border-line-muted px-3.5 py-2.5 text-left text-ink no-underline first:border-t-0',
  'touch-manipulation [-webkit-tap-highlight-color:transparent]',
  focusRing,
  '-outline-offset-[3px]',
);
const rowTitleClass = 'm-0 font-body text-[15px] leading-5 font-bold';

export function StoreDashboardPage() {
  const { store, gate } = useApprovedStore(<AppHeader start={back} title="A minha loja" />);
  useDocumentTitle(store?.name ?? 'A minha loja');
  if (!store) return gate;

  const stats = [
    { value: store.publishedProductsCount, label: 'Publicados', filter: 'published' },
    { value: store.soldOutProductsCount, label: 'Esgotados', filter: 'sold_out' },
    { value: store.hiddenProductsCount, label: 'Ocultos', filter: 'hidden' },
  ] as const;

  return (
    <PageShell
      nav="perfil"
      header={<AppHeader start={back} title={store.name} actions={<StoreTag kind="approved" />} />}
      className="gap-4.5"
    >
      {store.publishedProductsCount === 0 && (
        <section
          aria-labelledby="primeiro-produto"
          className="flex flex-col gap-2.5 rounded-lg border-2 border-ink bg-brand-tint p-4 text-ink shadow-hard"
        >
          <h2 id="primeiro-produto" className={h2Class}>
            Publica o primeiro produto
          </h2>
          <p className="m-0 font-body text-caption font-medium">
            A tua loja já aparece em «Lojas». Sem produtos, os compradores ainda não têm nada para
            ver.
          </p>
          <Button asChild variant="primary" className="w-full">
            <Link to="/vender/produtos/novo">Publicar produto</Link>
          </Button>
        </section>
      )}

      <ul className="m-0 grid list-none grid-cols-3 gap-2.5 p-0">
        {stats.map((s) => (
          <li key={s.filter} className="flex min-w-0">
            <Link
              to={`/vender/produtos?filtro=${FILTER_PARAM[s.filter]}`}
              className={cn(statClass, 'w-full')}
            >
              <b className="block font-display text-[26px] leading-[30px] font-bold">{s.value}</b>{' '}
              <span className="block font-body text-caption font-medium text-ink-muted">
                {s.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <nav
        aria-label="Gerir loja"
        className="flex flex-col overflow-hidden rounded-md border border-ink bg-surface"
      >
        <NavRow to="/vender/produtos">Produtos</NavRow>
        <NavRow to="/vender/loja/editar">Editar loja</NavRow>
        <NavRow to={`/loja/${store.slug}`}>Ver a loja como comprador</NavRow>
        {/* Fase seguinte (F3): fica à vista, desativado, com o mesmo aviso do F1. */}
        <button
          type="button"
          aria-disabled="true"
          onClick={comingSoon}
          className={cn(rowClass, 'w-full cursor-not-allowed bg-transparent text-ink-muted')}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={rowTitleClass}>Pedidos recebidos</span>{' '}
            <span className="font-body text-small font-medium">{COMING_SOON_TEXT}</span>
          </span>
        </button>
      </nav>
    </PageShell>
  );
}

function NavRow({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className={cn(rowClass, 'active:bg-brand-tint')}>
      <span className={cn(rowTitleClass, 'min-w-0 flex-1 truncate')}>{children}</span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
    </Link>
  );
}
