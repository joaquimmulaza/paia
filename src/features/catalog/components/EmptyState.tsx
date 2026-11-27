// Design system: Estado vazio (s-empty).
import { Search, type LucideIcon } from 'lucide-react';
import { useId, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  text: string;
  /** Uma ação que tira a pessoa do vazio (por exemplo «Procurar em tudo»). */
  action?: ReactNode;
  /** Ícone na caixa brand-tint. Por omissão, a lupa. */
  icon?: LucideIcon;
  /** Para a página levar o foco ao título (por exemplo, depois de alargar a pesquisa). */
  titleRef?: Ref<HTMLHeadingElement>;
  /** h1 quando o estado vazio é o ecrã inteiro (por exemplo, não encontrado). */
  headingLevel?: 'h1' | 'h2';
  className?: string;
};

export function EmptyState({
  title,
  text,
  action,
  icon: Icon = Search,
  titleRef,
  headingLevel = 'h2',
  className,
}: EmptyStateProps) {
  const titleId = useId();
  const Heading = headingLevel;
  return (
    <section
      role="status"
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border-2 border-ink bg-surface px-4 py-7 text-center text-ink',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-lg border-2 border-ink bg-brand-tint"
      >
        <Icon className="size-8" />
      </span>
      <Heading
        id={titleId}
        ref={titleRef}
        // Focável só por código, sem anel: o foco serve para o leitor de ecrã ler o título.
        tabIndex={titleRef ? -1 : undefined}
        className="m-0 font-display text-title font-bold wrap-break-word outline-none"
      >
        {title}
      </Heading>
      <p className="m-0 font-body text-body">{text}</p>
      {action}
    </section>
  );
}
