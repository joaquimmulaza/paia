import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { ProfilePage } from '@/features/auth/ProfilePage';
import { SignInPage } from '@/features/auth/SignInPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { HomePage } from '@/features/catalog/HomePage';
import { StoresPage } from '@/features/catalog/StoresPage';
import { RequireAuth, RequireGuest } from './guards';
import { NotFoundPage } from './NotFoundPage';
import { PlaceholderPage } from './PlaceholderPage';
import { routerFuture } from './router-future';

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/explorar', element: <PlaceholderPage active="explorar" /> },
  { path: '/lojas', element: <StoresPage /> },
  { path: '/pedidos', element: <PlaceholderPage active="pedidos" /> },
  {
    path: '/entrar',
    element: (
      <RequireGuest>
        <SignInPage />
      </RequireGuest>
    ),
  },
  {
    path: '/criar-conta',
    element: (
      <RequireGuest>
        <SignUpPage />
      </RequireGuest>
    ),
  },
  {
    path: '/perfil',
    element: (
      <RequireAuth>
        <ProfilePage />
      </RequireAuth>
    ),
  },
  { path: '*', element: <NotFoundPage /> },
];

export function createAppRouter() {
  return createBrowserRouter(routes, { future: routerFuture });
}
