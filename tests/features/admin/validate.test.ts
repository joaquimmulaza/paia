import { describe, expect, it } from 'vitest';
import { NOTE_MAX, noteLength, validateFeature } from '@/features/admin/validate';

const ok = { storeId: 's1', position: 0, startsAt: null, endsAt: null, note: '' };

describe('validateFeature', () => {
  it('sem erros devolve um objeto vazio', () => {
    expect(validateFeature(ok)).toEqual({});
  });

  it('pede uma loja', () => {
    expect(validateFeature({ ...ok, storeId: null }).store).toBe('Escolhe uma loja da lista.');
  });

  it('a posição tem de ser um inteiro de 0 ou mais', () => {
    expect(validateFeature({ ...ok, position: -1 }).position).toBe('A ordem tem de ser 0 ou mais.');
    expect(validateFeature({ ...ok, position: 1.5 }).position).toBe(
      'A ordem tem de ser 0 ou mais.',
    );
    expect(validateFeature({ ...ok, position: 0 }).position).toBeUndefined();
  });

  it('a nota conta sem os espaços das pontas e aceita até 280', () => {
    expect(NOTE_MAX).toBe(280);
    expect(noteLength(`  ${'x'.repeat(280)}  `)).toBe(280);
    expect(validateFeature({ ...ok, note: `  ${'x'.repeat(280)}  ` }).note).toBeUndefined();
    expect(validateFeature({ ...ok, note: 'x'.repeat(281) }).note).toBe(
      'A nota pode ter até 280 caracteres.',
    );
  });

  it('o fim tem de ser depois do início (igual também falha)', () => {
    const start = '2026-12-02T10:00:00+01:00';
    expect(
      validateFeature({ ...ok, startsAt: start, endsAt: '2026-12-01T10:00:00+01:00' }).endsAt,
    ).toBe('A data de fim tem de ser depois da data de início.');
    expect(validateFeature({ ...ok, startsAt: start, endsAt: start }).endsAt).toBe(
      'A data de fim tem de ser depois da data de início.',
    );
    expect(
      validateFeature({ ...ok, startsAt: start, endsAt: '2026-12-03T10:00:00+01:00' }).endsAt,
    ).toBeUndefined();
    expect(validateFeature({ ...ok, endsAt: start }).endsAt).toBeUndefined();
  });
});
