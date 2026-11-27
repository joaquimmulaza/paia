// Apoio aos testes ponta a ponta: axe com as regras WCAG do projeto e SQL no Supabase local.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

/** 0 violações do axe (WCAG 2.0 A e AA, WCAG 2.2 AA), com a lista legível quando falha. */
export async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} [${v.impact ?? 'sem impacto'}]: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, `Violações do axe em ${page.url()}`).toEqual([]);
}

/**
 * Corre SQL na base local (contentor supabase_db_paia) e devolve o resultado sem cabeçalhos.
 * Só para preparar e limpar dados de teste locais; nunca aponta para o remoto.
 */
export function localSql(sql: string): string {
  return execFileSync(
    'docker',
    ['exec', 'supabase_db_paia', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtAc', sql],
    { encoding: 'utf8' },
  ).trim();
}
