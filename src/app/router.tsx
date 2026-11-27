import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { FeaturesPage } from '@/features/admin/FeaturesPage';
import { RequireAdmin } from '@/features/admin/RequireAdmin';
import { ProfilePage } from '@/features/auth/ProfilePage';
import { SignInPage } from '@/features/auth/SignInPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { ExplorePage } from '@/features/catalog/ExplorePage';
import { HomePage } from '@/features/catalog/HomePage';
import { ProductPage } from '@/features/catalog/ProductPage';
import { StorePage } from '@/features/catalog/StorePage';
import { StoresPage } from '@/features/catalog/StoresPage';
import { RequireAuth, RequireGuest } from './guards';
import { NotFoundPage } from './NotFoundPage';
import { PlaceholderPage } from './PlaceholderPage';
import { routerFuture } from './router-future';

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/explorar', element: <ExplorePage /> },
  { path: '/lojas', element: <StoresPage /> },
  { path: '/produto/:id', element: <ProductPage /> },
  { path: '/loja/:slug', element: <StorePage /> },
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
  { path: '/admin', element: <Navigate to="/admin/destaques" replace /> },
  {
    path: '/admin/destaques',
    element: (
      <RequireAuth>
        <RequireAdmin>
          <FeaturesPage />
        </RequireAdmin>
      </RequireAuth>
    ),
  },
  { path: '*', element: <NotFoundPage /> },
];

export function createAppRouter() {
  return createBrowserRouter(routes, { future: routerFuture });
}
