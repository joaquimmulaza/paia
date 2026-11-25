import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado');

createRoot(root).render(
  <StrictMode>
    <h1>PAIÁ</h1>
  </StrictMode>,
);
