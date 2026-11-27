// Design system: Botão de ícone dos ecrãs (s-iconbtn e s-iconbtn--ink).
import { cn, focusRing } from '@/lib/utils';

/** 44 × 44, contorno ink, sem sombra: ao premir muda de fundo, não se desloca. */
export function iconButtonClass(tone: 'surface' | 'ink') {
  return cn(
    'relative inline-flex size-11 flex-none items-center justify-center rounded-md border-2 border-ink',
    'cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent]',
    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
    tone === 'ink' ? 'bg-ink text-on-ink' : 'bg-surface text-ink',
    'active:bg-brand-tint active:text-ink',
    focusRing,
  );
}
