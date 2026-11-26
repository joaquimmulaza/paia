// Design system: Campo (p-input).
import * as React from 'react';
import { cn, focusRing } from '@/lib/utils';

// forwardRef: em React 18 o `ref` não chega a um componente de função sem ele.
const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<'input'>>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          // 16 px dentro do campo para o iPhone não ampliar o ecrã.
          'w-full min-w-0 min-h-[52px] px-4 py-3 border-2 border-ink rounded-md bg-surface text-ink font-body text-base',
          'placeholder:text-ink-muted placeholder:opacity-100',
          'transition-[border-color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          focusRing,
          'aria-invalid:border-danger aria-invalid:bg-danger-tint',
          'disabled:cursor-not-allowed disabled:border-dashed disabled:border-line-muted disabled:bg-paper disabled:text-ink-muted',
          className,
        )}
        {...props}
      />
    );
  },
);

export { Input };
