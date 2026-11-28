import { describe, expect, it } from 'vitest';
import { storeSlugPreview } from '@/features/seller/slug';

describe('storeSlugPreview (o mesmo algoritmo de store_slug_base)', () => {
  it('tira acentos e símbolos e junta com hífen', () => {
    expect(storeSlugPreview('Pão & Café')).toBe('pao-cafe');
  });

  it('corta a base em 40 caracteres', () => {
    expect(storeSlugPreview('a'.repeat(60))).toBe('a'.repeat(40));
  });

  it('não deixa hífen no fim depois do corte', () => {
    const name = `${'a'.repeat(39)} b`;
    expect(storeSlugPreview(name)).toBe('a'.repeat(39));
  });

  it('devolve vazio quando a base tem menos de 3 caracteres', () => {
    expect(storeSlugPreview('☆☆')).toBe('');
    expect(storeSlugPreview('Ab')).toBe('');
    expect(storeSlugPreview('')).toBe('');
  });
});
