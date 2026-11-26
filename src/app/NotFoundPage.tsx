// Rota desconhecida.
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/use-document-title';

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada');
  return (
    <PageShell header={<AppHeader logo />} className="gap-5">
      <h1 className="m-0 font-display text-display-xl font-bold text-ink uppercase">
        Página não encontrada
      </h1>
      <p className="m-0 font-body text-body-lg">
        Este endereço não existe no PAIÁ. Confirma a ligação ou volta ao início.
      </p>
      <Button asChild variant="primary" className="w-full">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </PageShell>
  );
}
