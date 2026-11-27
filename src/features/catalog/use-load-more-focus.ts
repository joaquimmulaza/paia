import { useEffect, useRef, type RefObject } from 'react';

/**
 * «Ver mais produtos»: quando os novos itens chegam, o foco passa para a ligação do primeiro deles.
 * O pedido fica preso à pesquisa (`key`) em que foi feito: se falha ou a pesquisa muda, esquece-se.
 * Devolve a função a chamar antes de pedir a página seguinte.
 */
export function useLoadMoreFocus(
  listRef: RefObject<HTMLUListElement | null>,
  count: number,
  key: string,
  failed: boolean,
) {
  const target = useRef<{ index: number; key: string } | null>(null);

  useEffect(() => {
    if (failed) target.current = null;
  }, [failed]);

  useEffect(() => {
    const t = target.current;
    if (!t) return;
    if (t.key !== key) {
      target.current = null;
      return;
    }
    if (count <= t.index) return;
    target.current = null;
    listRef.current?.children[t.index]?.querySelector('a')?.focus();
  }, [listRef, count, key]);

  return () => {
    target.current = { index: count, key };
  };
}
