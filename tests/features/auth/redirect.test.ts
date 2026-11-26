import { describe, expect, it } from 'vitest';
import { safeRedirect } from '@/features/auth/redirect';

describe('safeRedirect', () => {
  it.each([
    ['/pedidos', '/pedidos'],
    ['/explorar?q=bolo#topo', '/explorar?q=bolo#topo'],
    ['/perfil', '/perfil'],
  ])('aceita o caminho relativo %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });

  it.each([
    [null],
    [''],
    ['//evil.com'],
    ['//evil.com/perfil'],
    ['/\\evil.com'],
    ['\\\\evil.com'],
    ['/\t/evil.com'],
    ['/\n/evil.com'],
    ['https://evil.com'],
    ['javascript:alert(1)'],
    ['perfil'],
    ['%2F%2Fevil.com'],
  ])('recusa %j e devolve /perfil', (input) => {
    expect(safeRedirect(input)).toBe('/perfil');
  });

  it('não volta para as páginas de entrada e de criação de conta', () => {
    expect(safeRedirect('/entrar')).toBe('/perfil');
    expect(safeRedirect('/criar-conta?x=1')).toBe('/perfil');
  });
});
