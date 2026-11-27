// Design system: Botão de ícone (s-iconbtn), as notificações do cabeçalho.
import { Bell } from 'lucide-react';
import { comingSoon } from '@/components/paia/ComingSoon';
import { iconButtonClass } from './icon-button';

/** Sem contador nesta fase: as notificações chegam em F3. */
export function NotificationsButton() {
  return (
    <button
      type="button"
      aria-label="Notificações"
      onClick={comingSoon}
      className={iconButtonClass('surface')}
    >
      <Bell aria-hidden="true" className="size-6" />
    </button>
  );
}
