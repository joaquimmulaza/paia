// Ecrãs: s-iconbtn (botão Voltar) de C03 e C04.
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { iconButtonClass } from './icon-button';

// Acoplamento: `idx` é um detalhe interno do react-router 6; se mudar, `hasHistory` passa a dar
// sempre falso e o Voltar vai sempre para `fallback`. Os testes simulam-no com `replaceState`.
/** O BrowserRouter guarda em `history.state.idx` a posição na pilha; 0 é a primeira página aberta. */
function hasHistory(): boolean {
  const state: unknown = window.history.state;
  const idx =
    state && typeof state === 'object' && 'idx' in state ? (state as { idx: unknown }).idx : 0;
  return typeof idx === 'number' && idx > 0;
}

/** Volta à página anterior; aberto por ligação direta, vai para `fallback`. */
export function BackButton({ fallback = '/explorar' }: { fallback?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label="Voltar"
      onClick={() => (hasHistory() ? navigate(-1) : navigate(fallback, { replace: true }))}
      className={iconButtonClass('surface')}
    >
      <ChevronLeft aria-hidden="true" className="size-6" />
    </button>
  );
}
