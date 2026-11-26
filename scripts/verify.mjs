// Verificação local completa (sem CI remoto). Corre os passos por ordem e pára no primeiro erro.
// Não arranca o Supabase: se a stack local estiver parada, `db:reset` falha com a mensagem da CLI.
import { spawnSync } from 'node:child_process';

const steps = ['lint', 'format:check', 'typecheck', 'test', 'db:reset', 'db:test', 'build', 'e2e'];

for (const [index, step] of steps.entries()) {
  console.log(`\n▶ [${index + 1}/${steps.length}] npm run ${step}`);
  const started = Date.now();
  const { status, error } = spawnSync(`npm run ${step}`, { stdio: 'inherit', shell: true });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (error || status !== 0) {
    console.error(`\n✖ ${step} falhou (${seconds} s). Verificação interrompida.`);
    process.exit(status || 1);
  }
  console.log(`✔ ${step} (${seconds} s)`);
}

console.log(`\n✔ Verificação completa: ${steps.length} passos sem erros.`);
