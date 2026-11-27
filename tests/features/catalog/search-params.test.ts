import { describe, expect, it } from 'vitest';
import { parseExploreParams, toExploreSearch } from '@/features/catalog/search-params';

describe('parseExploreParams', () => {
  it('apara q e volta a «recentes» com ordem desconhecida', () => {
    expect(parseExploreParams(new URLSearchParams('?q=%20bolo%20&ordem=x'))).toEqual({
      q: 'bolo',
      categoria: null,
      ordem: 'recentes',
    });
  });
  it('corta q a 80 caracteres', () => {
    const sp = new URLSearchParams({ q: 'a'.repeat(200) });
    expect(parseExploreParams(sp).q).toHaveLength(80);
  });
  it('aceita categoria e ordens válidas', () => {
    expect(parseExploreParams(new URLSearchParams('categoria=bolos&ordem=preco-asc'))).toEqual({
      q: '',
      categoria: 'bolos',
      ordem: 'preco-asc',
    });
  });
});

describe('toExploreSearch', () => {
  it('omite os valores por omissão', () => {
    expect(toExploreSearch({ q: '', categoria: null, ordem: 'recentes' })).toBe('');
  });
  it('inclui o que foi escolhido, com escape', () => {
    expect(toExploreSearch({ q: 'pão & bolo', categoria: 'bolos', ordem: 'preco-desc' })).toBe(
      '?q=p%C3%A3o+%26+bolo&categoria=bolos&ordem=preco-desc',
    );
  });
});
