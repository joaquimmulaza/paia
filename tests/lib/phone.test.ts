import { describe, expect, it } from 'vitest';
import { normalizePhone } from '@/lib/phone';

describe('normalizePhone', () => {
  it.each([
    ['912 345 678', '912345678'],
    ['+244 912345678', '912345678'],
    ['00244912345678', '912345678'],
    ['(912) 345-678', '912345678'],
    ['912.345.678', '912345678'],
  ])('aceita %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ['812345678', 'não começa por 9'],
    ['91234567', '8 dígitos'],
    ['912 34 56', '8 dígitos com espaços'],
    ['9123456789', '10 dígitos'],
    ['+244 812345678', 'prefixo ok mas não começa por 9'],
    ['abc912345678', 'letras'],
    ['', 'vazio'],
  ])('recusa %s (%s)', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
