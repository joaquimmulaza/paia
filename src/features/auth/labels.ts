import type { Affiliation } from './schemas';

/** Rótulos do vínculo à UGS, partilhados pelo registo e pelo perfil. */
export const AFFILIATION_LABEL: Record<Affiliation, string> = {
  student: 'Estudante',
  teacher: 'Professor',
  staff: 'Funcionário ou colaborador',
};
