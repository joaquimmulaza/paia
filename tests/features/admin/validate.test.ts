import { describe, expect, it } from 'vitest';
import {
  NOTE_MAX,
  noteLength,
  parseFeatureDates,
  validateFeature,
} from '@/features/admin/validate';

const ok = { storeId: 's1', position: 0, start: '', end: '', note: '' };

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

  it('sem posição (nula) é válido: a base põe o destaque no fim', () => {
    expect(validateFeature({ ...ok, position: null })).toEqual({});
  });

  it('a nota conta como a base: espaços seguidos valem um, invisíveis não contam', () => {
    expect(noteLength('a  \n\n  b')).toBe(3);
    expect(noteLength('a\u200bb\u00adc\ufeff')).toBe(3);
    expect(noteLength('a\u00a0\u00a0b')).toBe(3);
  });

  it('a nota conta pontos de código, como char_length (um emoji vale um)', () => {
    expect(noteLength('😀'.repeat(280))).toBe(280);
    expect(validateFeature({ ...ok, note: '😀'.repeat(280) }).note).toBeUndefined();
    expect(validateFeature({ ...ok, note: `${'x '.repeat(200)}\n\n${'y'.repeat(79)}` }).note).toBe(
      'A nota pode ter até 280 caracteres.',
    );
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
    const start = '2026-12-02T10:00';
    expect(validateFeature({ ...ok, start, end: '2026-12-01T10:00' }).end).toBe(
      'A data de fim tem de ser depois da data de início.',
    );
    expect(validateFeature({ ...ok, start, end: start }).end).toBe(
      'A data de fim tem de ser depois da data de início.',
    );
    expect(validateFeature({ ...ok, start, end: '2026-12-03T10:00' }).end).toBeUndefined();
    expect(validateFeature({ ...ok, end: start }).end).toBeUndefined();
  });

  it('uma data preenchida que não se consegue ler dá erro no campo, em vez de ser ignorada', () => {
    const e = validateFeature({ ...ok, start: '2026-02-30T10:00', end: 'lixo' });
    expect(e.start).toBe('Indica uma data e hora válidas.');
    expect(e.end).toBe('Indica uma data e hora válidas.');
    expect(validateFeature({ ...ok, start: '   ' }).start).toBeUndefined();
  });

  it('converte as datas lidas para ISO de Luanda', () => {
    expect(parseFeatureDates({ start: '2026-12-01T10:00', end: '' })).toEqual({
      startsAt: '2026-12-01T10:00:00+01:00',
      endsAt: null,
    });
  });
});
