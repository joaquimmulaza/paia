// Design system: Filtros de categoria (s-chips, s-chip).
import { Link } from 'react-router-dom';
import { cn, focusRing } from '@/lib/utils';
import type { Category } from '../types';

type Common = {
  categories: Category[];
  /** Slug ativo; `null` é «Tudo». */
  value: string | null;
  'aria-label': string;
  /** Rótulo do primeiro chip. Por omissão, «Tudo». */
  allLabel?: string;
  className?: string;
};

type CategoryChipsProps = Common &
  (
    | { onChange: (slug: string | null) => void; hrefFor?: never }
    | { hrefFor: (slug: string | null) => string; onChange?: never }
  );

const chip = cn(
  'inline-flex min-h-11 flex-none items-center rounded-md border-2 border-ink bg-surface px-3.5',
  'font-display text-label font-bold tracking-[0.04em] whitespace-nowrap text-ink uppercase no-underline',
  'cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'aria-pressed:bg-ink aria-pressed:text-on-ink aria-[current=true]:bg-ink aria-[current=true]:text-on-ink',
  // Sem sombra, o chip não se desloca: muda de fundo quando premido.
  'not-aria-pressed:not-aria-[current=true]:active:bg-brand-tint',
  focusRing,
);

// A régua desliza na horizontal, de margem a margem do ecrã (as páginas têm 20 px de lado).
const row = '-mx-5 flex gap-2 overflow-x-auto px-5 pt-0.5 pb-2 [scrollbar-width:none]';

export function CategoryChips(props: CategoryChipsProps) {
  const { categories, value, allLabel = 'Tudo', className } = props;
  const items: { slug: string | null; name: string }[] = [
    { slug: null, name: allLabel },
    ...categories.map((c) => ({ slug: c.slug, name: c.name })),
  ];

  if (props.hrefFor) {
    const hrefFor = props.hrefFor;
    return (
      <nav aria-label={props['aria-label']} className={cn(row, className)}>
        {items.map((item) => (
          <Link
            key={item.slug ?? ''}
            to={hrefFor(item.slug)}
            aria-current={item.slug === value ? 'true' : undefined}
            className={chip}
          >
            {item.name}
          </Link>
        ))}
      </nav>
    );
  }

  const onChange = props.onChange;
  return (
    <div role="group" aria-label={props['aria-label']} className={cn(row, className)}>
      {items.map((item) => (
        <button
          key={item.slug ?? ''}
          type="button"
          aria-pressed={item.slug === value}
          onClick={() => onChange(item.slug)}
          className={chip}
        >
          {item.name}
        </button>
      ))}
    </div>
  );
}
