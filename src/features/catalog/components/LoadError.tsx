// Ecrãs: aviso de erro (p-notice em danger-tint) com «Tentar outra vez», ecrã S04.
import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MESSAGES } from '@/lib/errors';

type LoadErrorProps = {
  error: unknown;
  onRetry: () => void;
  /** Enquanto volta a pedir, o botão mostra o indicador. */
  retrying?: boolean;
};

/** Mostra só mensagens já traduzidas pela api; qualquer outra coisa vira a mensagem genérica. */
export function LoadError({ error, onRetry, retrying = false }: LoadErrorProps) {
  const message = error instanceof Error && error.message ? error.message : MESSAGES.generic;
  return (
    <div className="flex flex-col items-start gap-3">
      <div
        role="alert"
        className="flex w-full items-start gap-2.5 rounded-md border-2 border-ink bg-danger-tint px-3.5 py-3 font-body text-body text-ink"
      >
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
        <p className="m-0">{message}</p>
      </div>
      <Button variant="secondary" size="sm" loading={retrying} onClick={onRetry}>
        Tentar outra vez
      </Button>
    </div>
  );
}
