import { describe, expect, it } from 'vitest';
import { toLuandaIso, toLuandaLocal } from '@/features/admin/dates';

describe('toLuandaIso', () => {
  it('lê o valor do datetime-local como hora de Luanda (+01:00)', () => {
    expect(toLuandaIso('2026-12-01T10:00')).toBe('2026-12-01T10:00:00+01:00');
  });

  it('mantém os segundos quando o campo os traz', () => {
    expect(toLuandaIso('2026-12-01T10:00:30')).toBe('2026-12-01T10:00:30+01:00');
  });

  it('é o mesmo instante que 09:00 UTC', () => {
    const iso = toLuandaIso('2026-12-01T10:00');
    expect(new Date(iso ?? '').toISOString()).toBe('2026-12-01T09:00:00.000Z');
  });

  it.each(['', '   ', 'lixo', '2026-13-01T10:00', '2026-02-30T10:00', '2026-12-01T25:00'])(
    '«%s» dá null',
    (value) => {
      expect(toLuandaIso(value)).toBeNull();
    },
  );
});

describe('toLuandaLocal', () => {
  it('mostra um instante UTC na hora de Luanda, no formato do datetime-local', () => {
    expect(toLuandaLocal('2026-12-01T09:00:00Z')).toBe('2026-12-01T10:00');
  });

  it('muda de dia e de ano quando é preciso', () => {
    expect(toLuandaLocal('2026-12-31T23:30:00+00:00')).toBe('2027-01-01T00:30');
  });

  it('null ou uma data inválida dão texto vazio', () => {
    expect(toLuandaLocal(null)).toBe('');
    expect(toLuandaLocal('lixo')).toBe('');
  });

  it('é o inverso de toLuandaIso', () => {
    expect(toLuandaLocal(toLuandaIso('2026-06-15T08:45'))).toBe('2026-06-15T08:45');
  });
});
