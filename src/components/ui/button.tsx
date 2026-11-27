// Design system: Botao (p-btn), com o indicador de carregamento p-spinner.
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn, focusRing } from '@/lib/utils';

// Hover: o Tailwind v4 só gera `hover:` dentro de `@media (hover: hover)`, como pede o brand book.
const lift =
  'hover:not-disabled:-translate-x-[var(--hover-lift)] hover:not-disabled:-translate-y-[var(--hover-lift)]';
// Premido: entra em 0 ms e volta em duration-fast (a transição de base).
const press =
  'active:not-disabled:translate-x-[var(--press-offset)] active:not-disabled:translate-y-[var(--press-offset)] active:not-disabled:shadow-none active:not-disabled:duration-0';

const buttonVariantsBase = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap select-none',
    'border-2 border-ink rounded-md font-display font-bold text-base no-underline',
    'cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent]',
    'transition-[transform,box-shadow,background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
    focusRing,
    'aria-busy:cursor-progress aria-disabled:pointer-events-none',
    // Desativado (não a carregar): tracejado em line-muted, sem fundo e sem sombra.
    // `disabled:` serve o <button>; `aria-disabled:` serve o asChild (por exemplo um <a>).
    'disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:border-dashed disabled:not-aria-busy:border-line-muted disabled:not-aria-busy:bg-transparent disabled:not-aria-busy:text-line-muted disabled:not-aria-busy:shadow-none',
    'aria-disabled:not-aria-busy:border-dashed aria-disabled:not-aria-busy:border-line-muted aria-disabled:not-aria-busy:bg-transparent aria-disabled:not-aria-busy:text-line-muted aria-disabled:not-aria-busy:shadow-none',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6",
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-ink text-on-ink shadow-hard-brand hover:not-disabled:shadow-hard-brand-hover',
          lift,
          press,
        ],
        accent: ['bg-brand text-ink shadow-hard hover:not-disabled:shadow-hard-hover', lift, press],
        secondary: [
          'bg-surface text-ink shadow-hard hover:not-disabled:bg-brand-tint hover:not-disabled:shadow-hard-hover',
          lift,
          press,
        ],
        danger: [
          'bg-surface text-danger shadow-hard hover:not-disabled:bg-danger-tint hover:not-disabled:shadow-hard-hover',
          lift,
          press,
        ],
        icon: [
          'size-11 min-h-11 p-0 bg-brand text-ink shadow-hard-sm hover:not-disabled:shadow-hard-hover',
          lift,
          press,
        ],
        // Sem sombra, o link não se desloca: muda de cor quando premido.
        link: 'min-h-11 px-1 border-transparent bg-transparent text-brand-text shadow-none underline underline-offset-3 active:text-ink',
      },
      size: {
        default: 'min-h-[52px] px-5',
        sm: 'min-h-11 px-3.5',
      },
    },
    compoundVariants: [
      { variant: 'icon', size: ['default', 'sm'], className: 'min-h-11 px-0' },
      { variant: 'link', size: ['default', 'sm'], className: 'min-h-11 px-1' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

/** As classes do botão, já sem conflitos (passam pelo twMerge), para usar fora do <Button>. */
function buttonVariants(...args: Parameters<typeof buttonVariantsBase>) {
  return cn(buttonVariantsBase(...args));
}

type ButtonProps = React.ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof buttonVariantsBase> & {
    asChild?: boolean;
    /** Mostra o indicador, marca `aria-busy` e não aceita mais toques. O texto deve dizer o que acontece («A enviar…»). */
    loading?: boolean;
  };

function Spinner() {
  return (
    <span
      data-slot="spinner"
      aria-hidden="true"
      className="size-[18px] shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none motion-reduce:border-dotted motion-reduce:border-r-current"
    />
  );
}

// forwardRef: em React 18 o `ref` não chega a um componente de função sem ele (e o Radix
// precisa dele num Trigger com asChild, para devolver o foco ao fechar).
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'default',
    asChild = false,
    loading = false,
    disabled,
    children,
    ...props
  },
  ref,
) {
  const hasName = Boolean(props['aria-label'] || props['aria-labelledby']);

  React.useEffect(() => {
    if (import.meta.env.DEV && variant === 'icon' && !hasName) {
      console.warn('Button variant="icon" precisa de aria-label ou aria-labelledby.');
    }
  }, [variant, hasName]);

  const classes = buttonVariants({ variant, size, className });

  if (asChild) {
    // Um <a> não tem `disabled`: sai da ordem do Tab, fica aria-disabled e o clique
    // (o Enter num link também dispara click) é travado na fase de captura, antes do
    // onClick do filho, que o Slot chamaria primeiro.
    const inert = loading || disabled;
    const inertProps = inert
      ? {
          'aria-disabled': true,
          tabIndex: -1,
          onClickCapture: (event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
          },
        }
      : {};
    // O Slot exige um só filho: o indicador entra dentro dele através do Slottable.
    return (
      <Slot.Root
        ref={ref}
        data-slot="button"
        data-variant={variant}
        className={classes}
        aria-busy={loading || undefined}
        {...props}
        {...inertProps}
      >
        {loading && <Spinner />}
        <Slot.Slottable>{children}</Slot.Slottable>
      </Slot.Root>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      data-slot="button"
      data-variant={variant}
      className={classes}
      aria-busy={loading || undefined}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <Spinner />}
      {variant === 'icon' && loading ? null : children}
    </button>
  );
});

export { Button, buttonVariants };
export type { ButtonProps };
