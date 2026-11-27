// Design system: Pesquisa (p-search, p-input--search).
import { Search } from 'lucide-react';
import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SearchFieldProps = {
  /** Nome do campo, só para leitores de ecrã. */
  label: string;
  placeholder: string;
  value: string;
  /** Recebe cada mudança, sem atraso: o debounce fica nas páginas. */
  onChange: (value: string) => void;
  className?: string;
};

export function SearchField({ label, placeholder, value, onChange, className }: SearchFieldProps) {
  const id = useId();
  return (
    <div className={cn('relative w-full', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-3.5 left-3.5 size-6 text-ink"
      />
      {/* O único campo com sombra sólida. O type="search" traz o botão de limpar nativo. */}
      <Input
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-11.5 shadow-hard"
      />
    </div>
  );
}
