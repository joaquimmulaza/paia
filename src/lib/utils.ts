import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// O tema do Cartaz tem nomes próprios (shadow-hard, text-label…). Sem os registar,
// o tailwind-merge não sabe que `shadow-hard` e `shadow-none` são a mesma propriedade.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ['hard', 'hard-brand', 'hard-sm', 'hard-hover', 'hard-brand-hover'],
      text: ['label', 'body', 'caption', 'display-xl', 'title', 'price', 'tag', 'body-lg', 'small'],
      font: ['display', 'body'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Anel de foco do Cartaz: só com teclado, 3 px a 2 px do elemento.
 * A cor vem de `--ring-color`, que o app.css muda dentro de `[data-surface=ink]`
 * e `[data-surface=brand]`; fora deles usa `--focus-ring`.
 */
export const focusRing =
  'outline-hidden focus-visible:outline-solid focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-[color:var(--ring-color,var(--focus-ring))]';
