const FALLBACK = '/perfil';
const BASE = 'http://paia.invalid';
/** Voltar a estas rotas depois de entrar seria um ciclo. */
const AUTH_PAGES = new Set(['/entrar', '/criar-conta']);

/**
 * Destino depois de entrar, a partir de `?voltar=`. Só aceita caminhos relativos desta
 * aplicação (começam por `/`, não por `//` nem `/\`, sem caracteres de controlo) e
 * confirma com o parser de URL que a origem não muda. Tudo o resto vai para /perfil.
 */
export function safeRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return FALLBACK;
  // Os browsers tratam `\` como `/` e ignoram tabs e mudanças de linha em URLs.
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return FALLBACK;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return FALLBACK;
  }
  if (url.origin !== BASE || AUTH_PAGES.has(url.pathname)) return FALLBACK;
  return `${url.pathname}${url.search}${url.hash}`;
}
