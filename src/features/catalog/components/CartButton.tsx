// Design system: Botão de ícone (s-iconbtn--ink), o carrinho do cabeçalho.
import { ShoppingCart } from 'lucide-react';
import { comingSoon } from '@/components/paia/ComingSoon';
import { iconButtonClass } from './icon-button';

/** Sem contador nesta fase: o carrinho chega em F3. */
export function CartButton() {
  return (
    <button
      type="button"
      aria-label="Carrinho"
      onClick={comingSoon}
      className={iconButtonClass('ink')}
    >
      <ShoppingCart aria-hidden="true" className="size-6" />
    </button>
  );
}
