// Validação do formulário de destaques, antes de chamar a API. A base volta a validar
// tudo (INVALID_POSITION, INVALID_TEXT, INVALID_PERIOD): isto é só para avisar cedo,
// junto ao campo.
import { MESSAGES } from '@/lib/errors';

export const NOTE_MAX = 280;

export interface FeatureDraft {
  storeId: string | null;
  position: number;
  /** ISO com fuso, ou null. */
  startsAt: string | null;
  endsAt: string | null;
  note: string;
}

export type FeatureErrors = Partial<Record<'store' | 'position' | 'note' | 'endsAt', string>>;

/** O comprimento que a base vai guardar: sem os espaços das pontas. */
export function noteLength(note: string): number {
  return note.trim().length;
}

export function validateFeature(d: FeatureDraft): FeatureErrors {
  const errors: FeatureErrors = {};
  if (!d.storeId) errors.store = 'Escolhe uma loja da lista.';
  if (!Number.isInteger(d.position) || d.position < 0) errors.position = MESSAGES.invalidPosition;
  if (noteLength(d.note) > NOTE_MAX) errors.note = `A nota pode ter até ${NOTE_MAX} caracteres.`;
  if (d.startsAt && d.endsAt && new Date(d.endsAt).getTime() <= new Date(d.startsAt).getTime()) {
    errors.endsAt = MESSAGES.invalidPeriod;
  }
  return errors;
}
