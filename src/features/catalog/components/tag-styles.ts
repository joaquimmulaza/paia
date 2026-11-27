// Design system: Etiqueta de estado (p-tag). Classes partilhadas pelas etiquetas do catálogo.
import { cn } from '@/lib/utils';

const base =
  'inline-flex items-center gap-1.5 min-h-6.5 px-2 py-0.75 border-2 border-current rounded-sm font-display text-tag font-bold uppercase whitespace-nowrap';

export const tagClass = {
  /** «Novo»: a única rotação permitida; sem rotação com movimento reduzido. */
  new: cn(base, 'border-ink bg-brand text-ink -rotate-4 motion-reduce:rotate-0'),
  waiting: cn(base, 'bg-warning-tint text-warning'),
  soldout: cn(base, 'border-ink bg-ink text-on-ink'),
  /** Categoria (p-tag--neutral): fundo surface, texto e contorno ink. */
  neutral: cn(base, 'border-ink bg-surface text-ink'),
  done: cn(base, 'bg-success-tint text-success'),
  /** p-tag--accepted: em info. */
  accepted: cn(base, 'bg-info-tint text-info'),
  /** «Promovida» (X01): fundo surface, texto e contorno ink. Nunca verde. */
  promoted: cn(base, 'border-ink bg-surface text-ink'),
};
