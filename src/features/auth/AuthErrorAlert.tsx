// Ecrãs: aviso de erro (p-notice em danger-tint). Mostra só mensagens já traduzidas.
import { CircleAlert } from 'lucide-react';
import { MESSAGES } from '@/lib/errors';

export function AuthErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border-2 border-ink bg-danger-tint px-3.5 py-3 font-body text-body text-ink"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
      <p className="m-0">{message}</p>
    </div>
  );
}

/** Mensagem de um erro lançado pela api (já em PT-AO); nunca texto técnico. */
export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : MESSAGES.generic;
}
