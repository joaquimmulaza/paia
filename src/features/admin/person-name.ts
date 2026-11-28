// Nomes de pessoas na administração, como no A01: «Ana P.» (o primeiro nome e a inicial
// do último apelido). O aviso de aprovação usa o primeiro nome por inteiro.

function words(fullName: string): string[] {
  return fullName.trim().split(/\s+/u).filter(Boolean);
}

/** O primeiro nome; vazio se não houver nome. */
export function firstName(fullName: string): string {
  return words(fullName)[0] ?? '';
}

/** «Ana Paula da Silva» → «Ana S.». Um nome só fica como está; um apelido já abreviado («J.») fica igual. */
export function shortPersonName(fullName: string): string {
  const list = words(fullName);
  const first = list[0];
  if (first === undefined) return '';
  const last = list.length > 1 ? list[list.length - 1] : undefined;
  if (last === undefined) return first;
  // Array.from: a inicial é o primeiro carácter inteiro, mesmo fora do plano básico.
  const initial = (Array.from(last.normalize('NFC'))[0] ?? '').toLocaleUpperCase('pt');
  return `${first} ${initial}.`;
}
