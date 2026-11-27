// Datas do formulário de destaques. O <input type="datetime-local"> não tem fuso:
// o valor é lido como hora de Luanda (UTC+1, sem hora de verão) e enviado em ISO com
// o fuso, para a base guardar o instante certo seja qual for o fuso do browser.

const LUANDA_OFFSET_MS = 60 * 60 * 1000;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** «2026-12-01T10:00» → «2026-12-01T10:00:00+01:00». Vazio ou inválido → null. */
export function toLuandaIso(local: string): string | null {
  const m = LOCAL.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00'] = m;
  const parts = [y, mo, d, h, mi, s].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const [year, month, day, hour, minute, second] = parts;
  // Confirma que a data existe (sem 30 de fevereiro, sem 25 horas).
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day ||
    utc.getUTCHours() !== hour ||
    utc.getUTCMinutes() !== minute ||
    utc.getUTCSeconds() !== second
  ) {
    return null;
  }
  return `${y}-${mo}-${d}T${h}:${mi}:${s}+01:00`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** O inverso, para editar: um instante ISO → «AAAA-MM-DDTHH:mm» em hora de Luanda. Null ou inválido → ''. */
export function toLuandaLocal(iso: string | null): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const t = new Date(time + LUANDA_OFFSET_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}
