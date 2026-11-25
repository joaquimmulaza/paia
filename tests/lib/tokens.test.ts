import { describe, expect, it } from 'vitest';
import { tokensToCss, type DesignTokens } from '@/lib/tokens';

import tokensJson from '../../design/tokens.json?raw';

const tokens = JSON.parse(tokensJson) as DesignTokens;

describe('tokensToCss', () => {
  const css = tokensToCss(tokens);

  it.each([
    '--ink: #022147;',
    '--brand: #FE5B03;',
    '--focus-ring: #1F5FBF;',
    '--radius-md: 12px;',
    '--shadow-hard: 4px 4px 0 #022147;',
    '--duration-fast: 120ms;',
    '--font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;',
  ])('contém %s', (line) => {
    expect(css).toContain(line);
  });

  it('abre :root e termina com nova linha', () => {
    expect(css.startsWith(':root {\n  --')).toBe(true);
    expect(css.endsWith('\n}\n')).toBe(true);
  });

  it('põe as fontes no fim', () => {
    expect(css.indexOf('--font-display')).toBeGreaterThan(css.indexOf('--ease-in'));
  });

  it('devolve o mesmo texto de cada vez', () => {
    expect(tokensToCss(tokens)).toBe(tokensToCss(tokens));
  });

  it('recusa nomes de token inválidos', () => {
    const bad: DesignTokens = {
      ...tokens,
      color: { tokens: [{ name: 'x; } body { display:none', value: '#000' }] },
    };
    expect(() => tokensToCss(bad)).toThrow('INVALID_TOKEN_NAME');
  });
});
