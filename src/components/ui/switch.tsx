// Design system: Interruptor (d-switch), modo denso da administração.
//
// Pista de 48 × 28 px com contorno ink e um polegar ink de 18 px. Ligado: pista
// em brand com o polegar ink (nunca branco sobre brand). O ::after alarga a zona
// tocável para 44 px sem mexer no desenho. O Radix dá `role="switch"` e `aria-checked`.
import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn, focusRing } from '@/lib/utils';

// forwardRef: em React 18 o `ref` não chega a um componente de função sem ele.
const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      data-slot="switch"
      className={cn(
        'peer relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-ink bg-surface',
        'cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent]',
        'after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2',
        'transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
        'data-[state=checked]:bg-brand',
        'disabled:cursor-not-allowed disabled:border-dashed disabled:border-line-muted disabled:bg-paper',
        'aria-busy:cursor-progress',
        focusRing,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-[18px] translate-x-[3px] rounded-full bg-ink',
          'transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'data-[state=checked]:translate-x-[23px]',
        )}
      />
    </SwitchPrimitive.Root>
  );
});

export { Switch };
