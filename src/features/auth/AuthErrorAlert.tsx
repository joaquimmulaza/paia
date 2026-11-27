// Ecrãs: aviso de erro (p-notice em danger-tint). Mostra só mensagens já traduzidas.
import { CircleAlert, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MESSAGES } from '@/lib/errors';

type Props = {
  message: string | null;
  /** «warning» (s-notice--warn): não é uma falha, por exemplo uma lista que já foi reposta. */
  tone?: 'danger' | 'warning';
};

export function AuthErrorAlert({ message, tone = 'danger' }: Props) {
  if (!message) return null;
  const warning = tone === 'warning';
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-md border-2 border-ink px-3.5 py-3 font-body text-body text-ink',
        warning ? 'max-w-[720px] bg-warning-tint' : 'bg-danger-tint',
      )}
    >
      {warning ? (
        <RefreshCw aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink" />
      ) : (
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
      )}
      <p className="m-0">{message}</p>
    </div>
  );
}

/** Mensagem de um erro lançado pela api (já em PT-AO); nunca texto técnico. */
export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : MESSAGES.generic;
}
