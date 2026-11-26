// Design system: Campo, escolha (p-choice); variante card = ModalidadeEntrega (p-mode).
//
// Cada item é o próprio cartão: o botão `role="radio"` do Radix ocupa a caixa toda, por isso
// tocar em qualquer parte escolhe a opção, o anel de foco aparece no cartão e o alvo
// tem pelo menos 44 px. As setas mudam a escolha e o Tab entra e sai do grupo.
// A variante `card` (título + descrição) é uma prop do RadioGroupItem, para manter
// uma só peça na API: `<RadioGroupItem variant="card" title="…" description="…" />`.
import * as React from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn, focusRing } from '@/lib/utils';

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('grid w-full gap-2', className)}
      {...props}
    />
  );
}

const itemBase = [
  'w-full min-h-11 border-2 border-ink rounded-md bg-surface text-left text-ink',
  'cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent]',
  'transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'data-[state=checked]:bg-brand-tint',
  'disabled:cursor-not-allowed disabled:border-dashed disabled:border-line-muted disabled:bg-paper disabled:text-ink-muted',
  focusRing,
];

/** O ponto: preenchido em ink quando a opção está escolhida. */
function Dot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface',
        className,
      )}
    >
      <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-ink" />
    </span>
  );
}

type ItemPrimitiveProps = Omit<React.ComponentProps<typeof RadioGroupPrimitive.Item>, 'title'>;

type RadioGroupItemProps =
  | (ItemPrimitiveProps & { variant?: 'default'; title?: never; description?: never })
  | (Omit<ItemPrimitiveProps, 'children'> & {
      variant: 'card';
      title: React.ReactNode;
      description?: React.ReactNode;
    });

function RadioGroupItem(props: RadioGroupItemProps) {
  const id = React.useId();

  if (props.variant === 'card') {
    const { className, title, description, variant: _variant, ...rest } = props;
    void _variant;
    const titleId = `${id}-title`;
    const descriptionId = description ? `${id}-description` : undefined;
    return (
      <RadioGroupPrimitive.Item
        data-slot="radio-group-item"
        data-variant="card"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          itemBase,
          'grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 px-3.5 py-3 font-body',
          className,
        )}
        {...rest}
      >
        <Dot className="row-span-2 mt-0.5" />
        <span id={titleId} className="text-body font-bold">
          {title}
        </span>
        {description && (
          <span id={descriptionId} className="text-caption font-medium text-ink-muted">
            {description}
          </span>
        )}
      </RadioGroupPrimitive.Item>
    );
  }

  const { className, children, variant: _variant, ...rest } = props;
  void _variant;
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        itemBase,
        'flex items-center gap-2.5 px-3.5 py-2.5 font-body text-body data-[state=checked]:font-bold',
        className,
      )}
      {...rest}
    >
      <Dot />
      <span>{children}</span>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
export type { RadioGroupItemProps };
