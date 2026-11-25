export interface DesignToken {
  name: string;
  value: string;
  usage?: string;
}

export interface TokenFamily {
  tokens: DesignToken[];
}

export interface DesignTokens {
  color: TokenFamily;
  spacing: TokenFamily;
  radius: TokenFamily;
  borderWidth: TokenFamily;
  shadow: TokenFamily;
  interaction: TokenFamily;
  duration: TokenFamily;
  easing: TokenFamily;
  type: { families: { display: string; body: string } };
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

// Ordem das famílias = ordem no ficheiro tokens.json.
const FAMILIES = [
  'color',
  'spacing',
  'radius',
  'borderWidth',
  'shadow',
  'interaction',
  'duration',
  'easing',
] as const;

function declaration(name: string, value: string): string {
  if (!NAME_RE.test(name)) throw new Error('INVALID_TOKEN_NAME');
  return `  --${name}: ${value};`;
}

export function tokensToCss(tokens: DesignTokens): string {
  const lines: string[] = [];
  for (const family of FAMILIES) {
    for (const token of tokens[family].tokens) {
      lines.push(declaration(token.name, token.value));
    }
  }
  lines.push(declaration('font-display', tokens.type.families.display));
  lines.push(declaration('font-body', tokens.type.families.body));
  return `:root {\n${lines.join('\n')}\n}\n`;
}
