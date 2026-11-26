// Página provisória da F0 para Início, Explorar, Lojas e Pedidos.
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import type { BottomNavTab } from '@/components/paia/BottomNav';
import { useDocumentTitle } from '@/lib/use-document-title';

export function PlaceholderPage({ active }: { active: BottomNavTab }) {
  useDocumentTitle();
  return (
    <PageShell header={<AppHeader logo />} nav={active}>
      <h1 className="m-0 font-display text-display-xl font-bold text-ink uppercase">
        Catálogo em construção
      </h1>
    </PageShell>
  );
}
