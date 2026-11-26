import { describe, expect, it } from 'vitest';
import { formatDateTime, formatKz } from '@/lib/format';

describe('formatKz', () => {
  it.each([
    [500, '500 Kz'],
    [1500, '1 500 Kz'],
    [15000, '15 000 Kz'],
    [1234567, '1 234 567 Kz'],
  ])('formata %d', (value, expected) => {
    expect(formatKz(value)).toBe(expected);
  });

  it.each([0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'recusa %s com RangeError',
    (value) => {
      expect(() => formatKz(value)).toThrow(RangeError);
    },
  );
});

describe('formatDateTime', () => {
  it('mostra a hora de Luanda (UTC+1), não a UTC', () => {
    const out = formatDateTime('2026-11-25T09:30:00Z');
    expect(out).toMatch(/25\/11\/(20)?26/);
    expect(out).toContain('10:30');
  });

  it('muda de dia segundo Luanda', () => {
    const out = formatDateTime('2026-11-25T23:30:00Z');
    expect(out).toMatch(/26\/11\/(20)?26/);
    expect(out).toContain('00:30');
  });

  it('recusa datas inválidas com RangeError', () => {
    expect(() => formatDateTime('não é data')).toThrow(RangeError);
  });
});
