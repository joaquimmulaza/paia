// Validação do formulário de destaques, antes de chamar a API. A base volta a validar
// tudo (INVALID_POSITION, INVALID_TEXT, INVALID_PERIOD): isto é só para avisar cedo,
// junto ao campo.
import { MESSAGES } from '@/lib/errors';
import { toLuandaIso } from './dates';

export const NOTE_MAX = 280;
const INVALID_DATE = 'Indica uma data e hora válidas.';

export interface FeatureDraft {
  storeId: string | null;
  /** Nula: a base põe o destaque no fim da ordem dos ativos. */
  position: number | null;
  /** Valores dos campos datetime-local, tal como estão (hora de Luanda). */
  start: string;
  end: string;
  note: string;
}

export type FeatureErrors = Partial<
  Record<'store' | 'position' | 'note' | 'start' | 'end', string>
>;

// Os mesmos caracteres invisíveis que private.normalize_text (migração F0) apaga.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u2060\u00AD\u061C\u180E]/g;
// Só os espaços ASCII e o NBSP: a base junta pelo menos estes ([[:space:]] e NBSP). Se juntar
// mais algum, conta menos do que aqui, e o cliente fica igual ou mais exigente, nunca menos.
const SPACES = /[\t\n\v\f\r \u00A0]+/g;

/**
 * O comprimento que a base vai guardar (char_length depois de private.normalize_text): sem
 * invisíveis, espaços seguidos como um só, sem as pontas, e contado em pontos de código.
 */
export function noteLength(note: string): number {
  return Array.from(note.replace(INVISIBLE, '').replace(SPACES, ' ').trim()).length;
}

/** Os campos de data em ISO com o fuso de Luanda; vazio ou ilegível dá null. */
export function parseFeatureDates(d: Pick<FeatureDraft, 'start' | 'end'>) {
  return { startsAt: toLuandaIso(d.start), endsAt: toLuandaIso(d.end) };
}

export function validateFeature(d: FeatureDraft): FeatureErrors {
  const errors: FeatureErrors = {};
  const { startsAt, endsAt } = parseFeatureDates(d);
  if (!d.storeId) errors.store = 'Escolhe uma loja da lista.';
  if (d.position !== null && (!Number.isInteger(d.position) || d.position < 0))
    errors.position = MESSAGES.invalidPosition;
  // Um campo preenchido que não se consegue ler não é ignorado: seria um destaque sem limite.
  if (d.start.trim() !== '' && !startsAt) errors.start = INVALID_DATE;
  if (d.end.trim() !== '' && !endsAt) errors.end = INVALID_DATE;
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    errors.end = MESSAGES.invalidPeriod;
  }
  if (noteLength(d.note) > NOTE_MAX) errors.note = `A nota pode ter até ${NOTE_MAX} caracteres.`;
  return errors;
}
