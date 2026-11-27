// Design system: Esqueleto de carregamento (s-skel), ecrã S04.
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const SLOW_AFTER_MS = 10_000;

type CatalogSkeletonProps = {
  /** O que está a carregar, só para leitores de ecrã («A carregar produtos…»). */
  label: string;
  onRetry: () => void;
  /** `page` (S04) imita o ecrã inteiro; `section` só os cartões, para uma secção de um ecrã já desenhado. */
  variant?: 'page' | 'section';
};

const block = 'rounded-sm bg-brand-tint';

function CardBlock() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border-2 border-ink bg-surface">
      <div className="aspect-square bg-brand-tint" />
      <div className="flex flex-col gap-2 p-3">
        <div className={`${block} h-3.5`} />
        <div className={`${block} h-3.5 w-3/5`} />
      </div>
    </div>
  );
}

/**
 * Blocos estáticos (não piscam nem se movem). Ao fim de 10 s, «Está a demorar.» e «Tentar outra vez».
 * O temporizador só arranca ao montar: em cada nova tentativa, o pai deve remontá-lo
 * (por exemplo com `key={tentativa}`) para os 10 s recomeçarem.
 */
export function CatalogSkeleton({ label, onRetry, variant = 'page' }: CatalogSkeletonProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    // Quando aparece a mensagem, a região deixa de estar ocupada para o botão ser lido.
    <div aria-busy={!slow} className="flex flex-col gap-5">
      <div role="status">
        <span className="sr-only">{label}</span>
        {slow && <p className="m-0 font-body text-body font-bold text-ink">Está a demorar.</p>}
      </div>
      {slow && (
        <Button variant="secondary" className="self-start" onClick={onRetry}>
          Tentar outra vez
        </Button>
      )}
      <div aria-hidden="true" className="flex flex-col gap-5">
        {variant === 'page' && (
          <>
            <div className={`${block} h-9.5 w-4/5`} />
            <div className="h-[52px] rounded-md border-2 border-ink bg-surface" />
            <div className="flex gap-2">
              <div className={`${block} h-11 w-18`} />
              <div className={`${block} h-11 w-22.5`} />
              <div className={`${block} h-11 w-24`} />
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4.5">
          <CardBlock />
          <CardBlock />
        </div>
      </div>
    </div>
  );
}
