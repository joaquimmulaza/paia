import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { routerFuture, routerProviderFuture } from '@/app/router-future';

/** Monta as rotas num router de memória, com os mesmos future flags da aplicação. */
export function renderRoutes(routes: RouteObject[], initialEntry: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
    future: routerFuture,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={routerProviderFuture} />
    </QueryClientProvider>,
  );
  return { router, queryClient, ...view };
}
