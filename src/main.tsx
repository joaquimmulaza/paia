import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Providers } from './app/providers';
import { createAppRouter } from './app/router';
import { routerProviderFuture } from './app/router-future';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado');

const router = createAppRouter();

createRoot(root).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} future={routerProviderFuture} />
    </Providers>
  </StrictMode>,
);
