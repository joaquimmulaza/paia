import { describe, expect, it } from 'vitest';
import { charCount, validateStore } from '@/features/seller/validate';
import { MESSAGES } from '@/lib/errors';

const empty = { name: '', description: '', categoryId: '', logoPath: null, coverPath: null };

describe('validateStore', () => {
  it('o rascunho só exige nome e categoria', () => {
    expect(validateStore(empty, 'draft')).toEqual({
      name: MESSAGES.storeNameRequired,
      categoryId: MESSAGES.storeCategoryRequired,
    });
  });

  it('para enviar, também a descrição e o logótipo; espaços não contam', () => {
    expect(validateStore({ ...empty, name: '  ', description: ' ' }, 'submit')).toEqual({
      name: MESSAGES.storeNameRequired,
      categoryId: MESSAGES.storeCategoryRequired,
      description: MESSAGES.storeDescriptionRequired,
      logoPath: MESSAGES.storeLogoRequired,
    });
  });

  it('completo, não tem erros', () => {
    const ok = { name: 'A', description: 'B', categoryId: 'c', logoPath: 'p', coverPath: null };
    expect(validateStore(ok, 'submit')).toEqual({});
  });

  it('conta caracteres como a base (um emoji é um)', () => {
    expect(charCount('Pão 🍞')).toBe(5);
  });

  it('o resumo usa o singular com 1 campo', () => {
    expect(MESSAGES.missingFields(1)).toBe('Falta preencher 1 campo. Corrige-o e envia outra vez.');
    expect(MESSAGES.missingFields(2)).toBe(
      'Falta preencher 2 campos. Corrige-os e envia outra vez.',
    );
  });
});
