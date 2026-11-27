// Design system: Etiqueta de estado (p-tag), selos de loja do canvas X01.
import { Megaphone, ShieldCheck } from 'lucide-react';
import { tagClass } from './tag-styles';

/** Selo de promoção paga. Não é uma verificação: sem verde e sem escudo. */
export function PromotedTag({ isPromoted }: { isPromoted: boolean }) {
  if (!isPromoted) return null;
  return (
    <span className={tagClass.promoted}>
      <Megaphone aria-hidden="true" className="size-3.5" />
      Promovida
    </span>
  );
}

/** Selo de verificação: a equipa do PAIÁ aprovou a loja (p-tag--done). */
export function ApprovedStoreTag() {
  return (
    <span className={tagClass.done}>
      <ShieldCheck aria-hidden="true" className="size-3.5" />
      Loja aprovada
    </span>
  );
}
