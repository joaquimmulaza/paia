// Página provisória da F0 para Início, Explorar, Lojas e Pedidos.
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import type { BottomNavTab } from '@/components/paia/BottomNav';
import { useDocumentTitle } from '@/lib/use-document-title';

type PlaceholderTab = Exclude<BottomNavTab, 'perfil'>;

/** Título do separador do browser; o Início fica só «PAIÁ». */
const TITLES: Record<PlaceholderTab, string | undefined> = {
  inicio: undefined,
  explorar: 'Explorar',
  lojas: 'Lojas',
  pedidos: 'Pedidos',
};

export function PlaceholderPage({ active }: { active: PlaceholderTab }) {
  useDocumentTitle(TITLES[active]);
  return (
    <PageShell header={<AppHeader logo />} nav={active}>
      <h1 className="m-0 font-display text-display-xl font-bold text-ink uppercase">
        {active === 'inicio' ? 'Catálogo em construção' : 'Em construção'}
      </h1>
    </PageShell>
  );
}
