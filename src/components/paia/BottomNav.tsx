// Design system: NavegacaoInferior (p-nav, p-tab). Ícones equivalentes aos de C01.
import { House, ReceiptText, Search, Store, User, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, focusRing } from '@/lib/utils';

export type BottomNavTab = 'inicio' | 'explorar' | 'lojas' | 'pedidos' | 'perfil';

const TABS: ReadonlyArray<{ id: BottomNavTab; label: string; to: string; icon: LucideIcon }> = [
  { id: 'inicio', label: 'Início', to: '/', icon: House },
  { id: 'explorar', label: 'Explorar', to: '/explorar', icon: Search },
  { id: 'lojas', label: 'Lojas', to: '/lojas', icon: Store },
  { id: 'pedidos', label: 'Pedidos', to: '/pedidos', icon: ReceiptText },
  { id: 'perfil', label: 'Perfil', to: '/perfil', icon: User },
];

export function BottomNav({ active }: { active: BottomNavTab }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="grid w-full grid-cols-5 gap-0.5 rounded-lg border-2 border-ink bg-surface p-1.5 shadow-hard"
    >
      {TABS.map(({ id, label, to, icon: Icon }) => {
        const current = id === active;
        return (
          <Link
            key={id}
            to={to}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'group relative flex min-h-14 flex-col items-center justify-center gap-0.75 rounded-md py-1',
              'font-display text-tag font-bold tracking-[0.04em] text-ink uppercase no-underline',
              'touch-manipulation [-webkit-tap-highlight-color:transparent]',
              focusRing,
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex h-7.5 w-12 items-center justify-center rounded-sm border-2',
                'transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
                current
                  ? 'border-ink bg-brand'
                  : 'border-transparent group-hover:border-ink group-hover:bg-paper group-active:border-ink group-active:bg-brand-tint group-active:duration-0',
              )}
            >
              <Icon className="size-6" strokeWidth={2} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
