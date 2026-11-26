/** Comportamentos do React Router 7, já ligados (e sem avisos nos testes). */
export const routerFuture = {
  v7_relativeSplatPath: true,
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_skipActionErrorRevalidation: true,
} as const;

export const routerProviderFuture = { v7_startTransition: true } as const;
