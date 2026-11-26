import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BottomNav } from '@/components/paia/BottomNav';
import { renderRoutes } from '../utils/renderRoutes';

function mount(active: 'inicio' | 'explorar' | 'lojas' | 'pedidos' | 'perfil') {
  return renderRoutes([{ path: '/', element: <BottomNav active={active} /> }], '/');
}

describe('BottomNav', () => {
  it('tem os 5 separadores de C01, na ordem, com destinos', () => {
    mount('inicio');
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Início',
      'Explorar',
      'Lojas',
      'Pedidos',
      'Perfil',
    ]);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/',
      '/explorar',
      '/lojas',
      '/pedidos',
      '/perfil',
    ]);
  });

  it('marca só o separador ativo com aria-current="page"', () => {
    mount('pedidos');
    const current = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Pedidos');
  });
});
