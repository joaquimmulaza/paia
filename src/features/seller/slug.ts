/**
 * Pré-visualização do endereço da loja: o mesmo algoritmo de `private.store_slug_base`
 * (sem acentos, minúsculas, tudo o que não é a-z0-9 vira «-», no máximo 40 caracteres, sem «-»
 * nas pontas). Devolve '' quando a base tem menos de 3 caracteres: a base atribui então
 * `loja-xxxx` ao acaso, e a interface mostra `loja-…`.
 */
export function storeSlugPreview(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return base.length < 3 ? '' : base;
}
