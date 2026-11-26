import { useEffect } from 'react';

/** Título do separador do browser: «<página> · PAIÁ», ou só «PAIÁ». */
export function useDocumentTitle(page?: string) {
  useEffect(() => {
    document.title = page ? `${page} · PAIÁ` : 'PAIÁ';
  }, [page]);
}
