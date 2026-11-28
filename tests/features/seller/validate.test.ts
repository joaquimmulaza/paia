import { describe, expect, it } from 'vitest';
import { charCount, parseWhole, validateProduct, validateStore } from '@/features/seller/validate';
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

describe('validateProduct', () => {
  const ok = {
    name: 'Pudim',
    description: '',
    categoryId: 'c1',
    price: '900',
    stock: '0',
    publish: true,
  };

  it('aceita stock 0 e o preço com espaços de milhares', () => {
    expect(validateProduct(ok)).toEqual({});
    expect(validateProduct({ ...ok, price: '10 000 000' })).toEqual({});
    expect(parseWhole('1 500')).toBe(1500);
  });

  it.each(['0', '', '1,5', '1.5', '-3', 'abc'])('o preço «%s» é recusado', (price) => {
    expect(validateProduct({ ...ok, price }).price).toBe(MESSAGES.productPriceInvalid);
  });

  it('acima de 10 000 000 Kz tem a sua mensagem', () => {
    expect(validateProduct({ ...ok, price: '10000001' }).price).toBe(MESSAGES.productPriceTooHigh);
  });

  it.each(['', '-1', '2.5', '10000'])('o stock «%s» é recusado', (stock) => {
    expect(validateProduct({ ...ok, stock }).stock).toBe(MESSAGES.productStockInvalid);
  });

  it('o nome em branco e a categoria em falta', () => {
    expect(validateProduct({ ...ok, name: '  ', categoryId: '' })).toEqual({
      name: MESSAGES.productNameRequired,
      categoryId: MESSAGES.categoryNotFound,
    });
  });
});
