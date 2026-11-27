import { describe, expect, it } from 'vitest';
import { storeInitials } from '@/features/catalog/components/store-text';

describe('storeInitials', () => {
  it('ignora os conectores', () => {
    expect(storeInitials('Doces da Ana')).toBe('DA');
    expect(storeInitials('Salgados do Bloco')).toBe('SB');
  });

  it('não parte pares substitutos nem emoji', () => {
    expect(storeInitials('🍰 Doces')).toBe('🍰D');
    expect(storeInitials('Bolos 𝒜na')).toBe('B𝒜');
  });

  it('uma só palavra dá uma inicial', () => {
    expect(storeInitials('Mimos')).toBe('M');
  });
});
