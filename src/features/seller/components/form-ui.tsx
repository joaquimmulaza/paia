// Peças dos formulários do vendedor (V02, V02c, V06): campo (p-field), erro do campo
// (p-field__error), área de texto e a lista de categorias (p-input).
import { ChevronDown, CircleAlert } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import type { Category } from '@/features/catalog/types';
import { cn, focusRing } from '@/lib/utils';

export const fieldClass = 'flex flex-col gap-1.5';
export const hintClass = 'm-0 font-body text-caption font-medium text-ink-muted';
export const controlClass = cn(
  'w-full min-w-0 rounded-md border-2 border-ink bg-surface px-4 py-3 font-body text-base text-ink',
  'placeholder:text-ink-muted placeholder:opacity-100',
  'transition-[border-color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'aria-invalid:border-danger aria-invalid:bg-danger-tint',
  focusRing,
);

/** Junta os ids de `aria-describedby`, sem os vazios. */
export function describe(...list: Array<string | false | null | undefined>): string | undefined {
  return cn(...list) || undefined;
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className="m-0 flex items-start gap-1.5 font-body text-caption font-medium text-danger"
    >
      <CircleAlert aria-hidden="true" className="size-[18px] shrink-0" />
      <span>{children}</span>
    </p>
  );
}

type CategorySelectProps = {
  id: string;
  selectRef: RefObject<HTMLSelectElement>;
  categories: Category[] | undefined;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy: string | undefined;
};

export function CategorySelect({
  id,
  selectRef,
  categories,
  value,
  onChange,
  invalid,
  describedBy,
}: CategorySelectProps) {
  return (
    <div className="relative">
      <select
        ref={selectRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(controlClass, 'min-h-[52px] cursor-pointer appearance-none pr-11')}
      >
        <option value="" disabled>
          {categories ? 'Escolhe uma categoria' : 'A carregar as categorias…'}
        </option>
        {categories?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-ink"
      />
    </div>
  );
}
