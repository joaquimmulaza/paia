const NBSP = ' ';

/** Kz inteiros positivos, agrupados de 3 em 3 com espaço duro (o Intl em `pt` não agrupa 4 dígitos). */
export function formatKz(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`formatKz: valor inválido (${String(value)})`);
  }
  const grouped = String(value).replace(/\B(?=(\d{3})+$)/g, NBSP);
  return `${grouped}${NBSP}Kz`;
}

const dateTimeFormat = new Intl.DateTimeFormat('pt-AO', {
  timeZone: 'Africa/Luanda',
  dateStyle: 'short',
  timeStyle: 'short',
});

/** Data e hora em Africa/Luanda. Lança RangeError se `iso` não for uma data válida. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`formatDateTime: data inválida (${iso})`);
  }
  return dateTimeFormat.format(date);
}
