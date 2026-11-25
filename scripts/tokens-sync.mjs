import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tokensToCss } from '../src/lib/tokens.ts';

const root = new URL('../', import.meta.url);
const tokens = JSON.parse(readFileSync(new URL('design/tokens.json', root), 'utf8'));
const header = '/* Gerado por npm run tokens:sync a partir de design/tokens.json. Não editar. */\n';

const out = fileURLToPath(new URL('src/styles/tokens.css', root));
writeFileSync(out, header + tokensToCss(tokens), 'utf8');
console.log(`tokens.css escrito em ${out}`);
