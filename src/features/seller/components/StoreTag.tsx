// Design system: Etiqueta de estado (p-tag) para o estado da loja do vendedor (K03c, V03, V03b).
import { tagClass } from '@/features/catalog/components/tag-styles';
import type { MyStoreKind } from '../types';

type StoreKind = Exclude<MyStoreKind, 'none'>;

const TAG: Record<StoreKind, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: tagClass.neutral },
  pending: { label: 'Em análise', className: tagClass.waiting },
  rejected: { label: 'Recusada', className: tagClass.cancelled },
  approved: { label: 'Aprovada', className: tagClass.done },
  suspended: { label: 'Suspensa', className: tagClass.cancelled },
};

export function StoreTag({ kind }: { kind: StoreKind }) {
  const { label, className } = TAG[kind];
  return <span className={className}>{label}</span>;
}
