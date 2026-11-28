// A01: «conta criada há 3 semanas». Os dias contam-se pelo calendário de Luanda
// (UTC+1, sem hora de verão), não por blocos de 24 horas.

const DAY_MS = 86_400_000;
const LUANDA_OFFSET_MS = 60 * 60 * 1000;

/** Número do dia de calendário em Luanda (dias desde 1970-01-01). */
function luandaDay(time: number): number {
  return Math.floor((time + LUANDA_OFFSET_MS) / DAY_MS);
}

/** Há quanto tempo a conta foi criada: hoje, em dias (até 6) ou em semanas completas. */
export function accountAgeLabel(createdIso: string, now: Date = new Date()): string {
  const days = Math.max(0, luandaDay(now.getTime()) - luandaDay(new Date(createdIso).getTime()));
  if (!Number.isFinite(days) || days === 0) return 'conta criada hoje';
  if (days < 7) return days === 1 ? 'conta criada há 1 dia' : `conta criada há ${days} dias`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'conta criada há 1 semana' : `conta criada há ${weeks} semanas`;
}
