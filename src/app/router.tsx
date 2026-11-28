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
import { ProductFormPage } from '@/features/seller/ProductFormPage';
import { ProductsPage } from '@/features/seller/ProductsPage';
import { SellPage } from '@/features/seller/SellPage';
import { StoreDashboardPage } from '@/features/seller/StoreDashboardPage';
import { StoreEditPage } from '@/features/seller/StoreEditPage';
import { StoreRequestPage } from '@/features/seller/StoreRequestPage';
import { StoreRequestViewPage } from '@/features/seller/StoreRequestViewPage';
import { StoreStatusPage } from '@/features/seller/StoreStatusPage';
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
  // Candidatura da loja (V01–V03b), painel da loja aprovada (V04b, V02c) e produtos (V05–V06b).
  {
    path: '/vender',
    element: (
      <RequireAuth>
        <SellPage />
      </RequireAuth>
    ),
  },
  {
    path: '/vender/pedido',
    element: (
      <RequireAuth>
        <StoreRequestPage />
      </RequireAuth>
    ),
  },
  {
    path: '/vender/estado',
    element: (
      <RequireAuth>
        <StoreStatusPage />
      </RequireAuth>
    ),
  },
  {
    path: '/vender/pedido/ver',
    element: (
      <RequireAuth>
        <StoreRequestViewPage />
      </RequireAuth>
    ),
  },
  {
    path: '/vender/loja',
    element: (
      <RequireAuth>
        <StoreDashboardPage />
      </RequireAuth>
    ),
  },
  {
    path: '/vender/loja/editar',
    element: (
      <RequireAuth>
        <StoreEditPage />
      </RequireAuth>
    ),
  },
  {
    path: '/vender/produtos',
    element: (
      <RequireAuth>
        <ProductsPage />
      </RequireAuth>
    ),
  },
  {
    path: '/vender/produtos/novo',
    element: (
      <RequireAuth>
        <ProductFormPage />
      </RequireAuth>
    ),
  },
  {
    path: '/vender/produtos/:id',
    element: (
      <RequireAuth>
        <ProductFormPage />
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
