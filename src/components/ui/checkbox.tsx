// Design system: Campo, caixa de seleção (sem cartão próprio no Cartaz; segue p-choice e as regras de Forma).
import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { CheckIcon } from 'lucide-react';
import { cn, focusRing } from '@/lib/utils';

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // A caixa tem 22 px; o ::after alarga a zona tocável para 44 px sem mexer no desenho.
        'peer relative flex size-[22px] shrink-0 items-center justify-center rounded-sm border-2 border-ink bg-surface text-on-ink',
        'cursor-pointer after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2',
        'transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
        'data-[state=checked]:bg-ink',
        'aria-invalid:border-danger aria-invalid:bg-danger-tint',
        'disabled:cursor-not-allowed disabled:border-dashed disabled:border-line-muted disabled:bg-paper',
        focusRing,
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center"
      >
        <CheckIcon aria-hidden="true" strokeWidth={3} className="size-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
