// Design system: Estado vazio (s-empty).
import { Search, type LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  text: string;
  /** Uma ação que tira a pessoa do vazio (por exemplo «Procurar em tudo»). */
  action?: ReactNode;
  /** Ícone na caixa brand-tint. Por omissão, a lupa. */
  icon?: LucideIcon;
  className?: string;
};

export function EmptyState({
  title,
  text,
  action,
  icon: Icon = Search,
  className,
}: EmptyStateProps) {
  const titleId = useId();
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
      <h2 id={titleId} className="m-0 font-display text-title font-bold wrap-break-word">
        {title}
      </h2>
      <p className="m-0 font-body text-body">{text}</p>
      {action}
    </section>
  );
}
