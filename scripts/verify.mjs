// Verificação local completa (sem CI remoto). Corre os passos por ordem e pára no primeiro erro.
// Não arranca o Supabase: se a stack local estiver parada, `db:reset` falha com a mensagem da CLI.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// Pré-verificação: o `.env.local` tem de existir e ter as variáveis (os valores nunca são mostrados).
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
if (!existsSync('.env.local')) {
  console.error('✖ Falta o ficheiro .env.local. Copia o .env.example e preenche-o (ver README).');
  process.exit(1);
}
const envFile = readFileSync('.env.local', 'utf8');
const envLines = envFile.split('\n').map((line) => line.trim());
const hasValue = (name) =>
  envLines.some((line) => line.startsWith(`${name}=`) && line.slice(name.length + 1).trim() !== '');
const missing = REQUIRED_ENV.filter((name) => !hasValue(name));
if (missing.length > 0) {
  console.error(`✖ O .env.local não tem estas variáveis (ou estão vazias): ${missing.join(', ')}.`);
  process.exit(1);
}

const steps = [
  'npm run lint',
  'npm run format:check',
  // Os tokens gerados têm de coincidir com o que está no repositório.
  'npm run tokens:sync && git diff --exit-code -- src/styles/tokens.css',
  'npm run typecheck',
  'npm run test',
  'npm run db:reset',
  // Os tipos gerados da base de dados local têm de coincidir com src/types/database.ts.
  'npm run db:types && git diff --exit-code -- src/types/database.ts',
  'npm run db:test',
  'npm run build',
  'npm run e2e',
];

for (const [index, step] of steps.entries()) {
  console.log(`\n▶ [${index + 1}/${steps.length}] ${step}`);
  const started = Date.now();
  const { status, error } = spawnSync(step, { stdio: 'inherit', shell: true });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (error || status !== 0) {
    console.error(`\n✖ ${step} falhou (${seconds} s). Verificação interrompida.`);
    process.exit(status || 1);
  }
  console.log(`✔ ${step} (${seconds} s)`);
}

console.log(`\n✔ Verificação completa: ${steps.length} passos sem erros.`);
