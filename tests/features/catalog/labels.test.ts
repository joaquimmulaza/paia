import { describe, expect, it, vi } from 'vitest';

const getPublicUrl = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn(() => ({ getPublicUrl })));
vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from } } }));

import { isNew, publicImageUrl, stockLabel } from '@/features/catalog/labels';

describe('stockLabel', () => {
  it('0 é esgotado', () => {
    expect(stockLabel(0)).toEqual({ kind: 'soldout', text: 'Esgotado' });
  });
  it.each([
    [1, 'Últimas 1'],
    [3, 'Últimas 3'],
  ])('%i é «últimas»', (stock, text) => {
    expect(stockLabel(stock)).toEqual({ kind: 'last', text });
  });
  it('4 ou mais não tem etiqueta', () => {
    expect(stockLabel(4)).toEqual({ kind: null, text: null });
    expect(stockLabel(9999)).toEqual({ kind: null, text: null });
  });
});

describe('isNew', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  it('6 dias e 23 horas é novo', () => {
    expect(isNew('2026-11-19T13:00:00Z', now)).toBe(true);
  });
  it('7 dias e 1 minuto não é novo', () => {
    expect(isNew('2026-11-19T11:59:00Z', now)).toBe(false);
  });
});

describe('publicImageUrl', () => {
  it('pede o URL público ao bucket certo', () => {
    getPublicUrl.mockReturnValue({ data: { publicUrl: 'http://x/y.jpg' } });
    expect(publicImageUrl('product-media', 'a/b.jpg')).toBe('http://x/y.jpg');
    expect(from).toHaveBeenCalledWith('product-media');
    expect(getPublicUrl).toHaveBeenCalledWith('a/b.jpg');
  });
});
