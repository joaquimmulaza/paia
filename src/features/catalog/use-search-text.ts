import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { MAX_QUERY_LENGTH, parseExploreParams } from './search-params';

const SEARCH_DELAY_MS = 300;

/**
 * O texto do campo de pesquisa, ligado ao `q` do URL nos dois sentidos:
 * - depois de 300 ms sem escrever, o `q` passa para o URL, sem nova entrada no histórico;
 * - quando o `q` muda por outra via (Voltar, Avançar, uma ligação), o campo passa a mostrá-lo.
 */
export function useSearchText(): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const { q } = parseExploreParams(searchParams);
  const [text, setText] = useState(q);
  const debounced = useDebouncedValue(text, SEARCH_DELAY_MS);

  // O último q que o campo e o URL têm em comum: o que se escreveu ou o que veio do URL.
  const synced = useRef(q);
  const urlQ = useRef(q);
  urlQ.current = q;

  // URL → campo. Um q igual ao que se acabou de escrever não mexe no campo (manteria o
  // espaço no fim, por exemplo); qualquer outro vem de fora e substitui o texto.
  useEffect(() => {
    if (q === synced.current) return;
    synced.current = q;
    setText(q);
  }, [q]);

  // Campo → URL, só quando o valor com atraso muda e é diferente do que o URL já tem.
  // O setSearchParams muda a cada navegação: sem a guarda, um Voltar reescreveria o q antigo.
  const lastDebounced = useRef(debounced);
  useEffect(() => {
    if (debounced === lastDebounced.current) return;
    lastDebounced.current = debounced;
    const next = debounced.trim().slice(0, MAX_QUERY_LENGTH);
    if (next === urlQ.current) return;
    synced.current = next;
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (next) sp.set('q', next);
        else sp.delete('q');
        return sp;
      },
      { replace: true },
    );
  }, [debounced, setSearchParams]);

  return [text, setText];
}
