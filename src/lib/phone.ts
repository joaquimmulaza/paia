/** Normaliza para `9XXXXXXXX` (aceita +244 ou 00244). Devolve null se não for válido. */
export function normalizePhone(input: string): string | null {
  const stripped = input.replace(/[\s.\-()]/g, '');
  const national = stripped.replace(/^(?:\+244|00244)/, '');
  return /^9[0-9]{8}$/.test(national) ? national : null;
}
