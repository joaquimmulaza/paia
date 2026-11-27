// Design system: TalaoAviso (p-notice), variante «Disponível em breve» do canvas X01.
import { createElement } from 'react';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';

export const COMING_SOON_TEXT = 'Disponível em breve';

/**
 * Aviso das ações de fases seguintes (carrinho, adicionar, notificações, denúncias).
 * Fica 4 s no topo e é anunciado pela região `aria-live` do Toaster. O `id` fixo
 * evita empilhar avisos iguais quando se toca várias vezes.
 */
export function comingSoon() {
  toast(COMING_SOON_TEXT, {
    id: 'coming-soon',
    duration: 4000,
    icon: createElement(Clock, { 'aria-hidden': true, className: 'size-4.5' }),
    // X01: texto em peso 500, não o negrito dos títulos dos outros avisos.
    classNames: { title: 'font-medium!' },
  });
}
