// Apoio aos testes ponta a ponta: axe com as regras WCAG do projeto e SQL no Supabase local.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';

/** 0 violações do axe (WCAG 2.0 A e AA, WCAG 2.2 AA), com a lista legível quando falha. */
export async function expectNoAxeViolations(page: Page) {
  // Espera que os avisos (sonner) saiam do ecrã: um aviso a desvanecer-se tem um contraste
  // intermédio e dava um falso positivo.
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 });
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

/** Um PNG válido de 8x8 píxeis, gerado aqui com Buffer (sem ficheiros nem fotos reais). */
export function tinyPng(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = (crcTable[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const size = 8;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bits por canal
  header[9] = 2; // RGB
  // Cada linha: filtro 0 + 8 píxeis RGB (um amarelo liso).
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0xe0)]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
