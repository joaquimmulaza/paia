// Ecrãs: Estado vazio (s-empty) para um produto ou loja que não existe ou está escondido.
import { SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MESSAGES } from '@/lib/errors';
import { EmptyState } from './EmptyState';

/** A api traduz «não existe» (e «não é público») para esta mensagem. */
export function isNotFound(error: unknown): boolean {
  return error instanceof Error && error.message === MESSAGES.notFound;
}

export function NotFoundState({ text }: { text: string }) {
  return (
    <EmptyState
      headingLevel="h1"
      icon={SearchX}
      title={MESSAGES.notFound}
      text={text}
      action={
        <Button asChild variant="secondary">
          <Link to="/explorar">Voltar a explorar</Link>
        </Button>
      }
    />
  );
}
