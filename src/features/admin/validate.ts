// Validação do formulário de destaques, antes de chamar a API. A base volta a validar
// tudo (INVALID_POSITION, INVALID_TEXT, INVALID_PERIOD): isto é só para avisar cedo,
// junto ao campo.
import { MESSAGES } from '@/lib/errors';
import { toLuandaIso } from './dates';

export const NOTE_MAX = 280;
const INVALID_DATE = 'Indica uma data e hora válidas.';

export interface FeatureDraft {
  storeId: string | null;
  position: number;
  /** Valores dos campos datetime-local, tal como estão (hora de Luanda). */
  start: string;
  end: string;
  note: string;
}

export type FeatureErrors = Partial<
  Record<'store' | 'position' | 'note' | 'start' | 'end', string>
>;

/** O comprimento que a base vai guardar: sem os espaços das pontas. */
export function noteLength(note: string): number {
  return note.trim().length;
}

/** Os campos de data em ISO com o fuso de Luanda; vazio ou ilegível dá null. */
export function parseFeatureDates(d: Pick<FeatureDraft, 'start' | 'end'>) {
  return { startsAt: toLuandaIso(d.start), endsAt: toLuandaIso(d.end) };
}

export function validateFeature(d: FeatureDraft): FeatureErrors {
  const errors: FeatureErrors = {};
  const { startsAt, endsAt } = parseFeatureDates(d);
  if (!d.storeId) errors.store = 'Escolhe uma loja da lista.';
  if (!Number.isInteger(d.position) || d.position < 0) errors.position = MESSAGES.invalidPosition;
  // Um campo preenchido que não se consegue ler não é ignorado: seria um destaque sem limite.
  if (d.start.trim() !== '' && !startsAt) errors.start = INVALID_DATE;
  if (d.end.trim() !== '' && !endsAt) errors.end = INVALID_DATE;
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    errors.end = MESSAGES.invalidPeriod;
  }
  if (noteLength(d.note) > NOTE_MAX) errors.note = `A nota pode ter até ${NOTE_MAX} caracteres.`;
  return errors;
}
