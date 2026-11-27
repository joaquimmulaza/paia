// A07 · Destaques ponta a ponta: um administrador remove e adiciona lojas em destaque, e o
// Início (C01) segue a lista. Corre contra o Supabase local, com os dados do seed.
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, localSql } from './support';

// Lojas do seed.
const SALGADOS = 'b0000000-0000-4000-8000-000000000002';
const GELADOS = 'b0000000-0000-4000-8000-000000000005';

// Conta nova em cada execução. A palavra-passe é gerada aqui e nunca fica num ficheiro.
const admin = {
  email: `admin+${Date.now()}@exemplo.test`,
  password: randomUUID(),
};

test.describe.configure({ mode: 'serial' });

/** Os destaques como estavam antes do teste (no `verify`, os do seed), linha a linha, em JSON. */
let featuresBefore = '[]';

function snapshotFeatures(): string {
  return localSql(`select coalesce(json_agg(f), '[]') from public.store_features f`);
}

/** Repõe exatamente as linhas guardadas: mesmos ids, ordem, períodos, autores e datas. */
function restoreFeatures(json: string) {
  const literal = json.replaceAll("'", "''");
  localSql(`
    begin;
    delete from public.store_features;
    insert into public.store_features
      select * from json_populate_recordset(null::public.store_features, '${literal}');
    commit;
  `);
}

async function signUp(page: Page) {
  await page.goto('/criar-conta');
  await page.getByLabel('Nome completo').fill('Administração de Teste');
  await page.getByLabel('Email').fill(admin.email);
  await page.getByLabel('Telefone').fill('923456780');
  await page.getByLabel('Palavra-passe').fill(admin.password);
  await page.getByRole('radio', { name: 'Funcionário ou colaborador' }).check();
  await page.getByRole('checkbox', { name: /Aceito os Termos/ }).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/perfil$/);
}

function communityStores(page: Page) {
  return page.getByRole('region', { name: 'Lojas da comunidade' });
}

test.beforeAll(() => {
  featuresBefore = snapshotFeatures();
  // O teste parte do estado do seed. Se uma execução anterior foi interrompida antes do
  // afterAll, corre `npm run db:reset`.
  const seedState = localSql(`
    select
      exists (select 1 from public.store_features where store_id = '${GELADOS}' and is_active)
      and not exists (select 1 from public.store_features where store_id = '${SALGADOS}')
  `);
  expect(seedState, 'destaques do seed (corre npm run db:reset)').toBe('t');
});

test.afterAll(() => {
  restoreFeatures(featuresBefore);
  localSql(
    `delete from public.admin_users where user_id = (select id from auth.users where email = '${admin.email}')`,
  );
});

test('remove e adiciona destaques, e o Início acompanha', async ({ page }) => {
  await signUp(page);
  const promoted = localSql(`
    insert into public.admin_users (user_id)
    select id from auth.users where email = '${admin.email}'
    returning user_id
  `);
  expect(promoted).toMatch(/^[0-9a-f-]{36}$/);

  // Antes: Gelados Fresquinhos está em «Lojas da comunidade».
  await page.goto('/');
  await expect(
    communityStores(page).getByRole('heading', { name: 'Gelados Fresquinhos' }),
  ).toBeVisible();

  await page.goto('/admin/destaques');
  await expect(page.getByRole('heading', { level: 1, name: 'Destaques' })).toBeVisible();
  const list = page.getByRole('region', { name: 'Lista de destaques' });
  await expect(list.getByRole('link', { name: 'Gelados Fresquinhos' })).toBeVisible();
  await expectNoAxeViolations(page);

  // Remover, depois de confirmar.
  await list.getByRole('button', { name: 'Remover Gelados Fresquinhos' }).click();
  const dialog = page.getByRole('alertdialog', {
    name: 'Remover destaque de Gelados Fresquinhos?',
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Remover destaque' }).click();
  await expect(dialog).toBeHidden();
  await expect(list.getByRole('link', { name: 'Gelados Fresquinhos' })).toHaveCount(0);

  // Adicionar Salgados do Bloco: entra no fim da lista.
  await page.getByRole('button', { name: 'Adicionar destaque' }).click();
  const form = page.getByRole('region', { name: 'Adicionar destaque' });
  await expect(form).toBeVisible();
  await form.getByLabel('Loja').fill('Salgados');
  await form.getByRole('radio', { name: 'Salgados do Bloco' }).check();
  await expectNoAxeViolations(page);
  await form.getByRole('button', { name: 'Guardar destaque' }).click();
  await expect(form).toBeHidden();
  await expect(list.getByRole('link', { name: 'Salgados do Bloco' })).toBeVisible();

  // Subir até à posição 0 (a primeira linha da lista). Cada «Subir» envia a ordem completa;
  // um clique enquanto a ordenação anterior corre é ignorado pela página, por isso o passo
  // repete-se até a primeira linha ser Salgados, sem nunca ler o estado sem esperar.
  const reorders = { started: 0, statuses: [] as number[] };
  const isReorder = (url: string) => url.includes('/rpc/admin_reorder_store_features');
  page.on('request', (r) => {
    if (isReorder(r.url())) reorders.started += 1;
  });
  page.on('response', (r) => {
    if (isReorder(r.url())) reorders.statuses.push(r.status());
  });
  const up = list.getByRole('button', { name: 'Subir Salgados do Bloco' });
  const firstRow = list.getByRole('row').nth(1);
  await expect(async () => {
    if (!(await firstRow.textContent())?.includes('Salgados do Bloco')) {
      await up.click({ timeout: 2_000 });
    }
    await expect(firstRow).toContainText('Salgados do Bloco', { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  // Todas as ordenações chegaram ao fim e nenhuma falhou (um erro da RPC aparece aqui).
  await expect.poll(() => reorders.statuses.length).toBe(reorders.started);
  expect(reorders.statuses.length).toBeGreaterThan(0);
  expect(reorders.statuses.filter((status) => status >= 300)).toEqual([]);
  await expect(firstRow.getByRole('link', { name: 'Salgados do Bloco' })).toBeVisible();
  await expect(up).toHaveAttribute('aria-disabled', 'true');
  await expectNoAxeViolations(page);

  // Depois: no Início, Salgados do Bloco aparece primeiro e Gelados Fresquinhos já não aparece.
  await page.goto('/');
  const stores = communityStores(page);
  await expect(stores.getByRole('heading', { level: 3 }).first()).toHaveText('Salgados do Bloco');
  await expect(stores.getByRole('heading', { name: 'Doces da Ana' })).toBeVisible();
  await expect(stores.getByRole('heading', { name: 'Gelados Fresquinhos' })).toHaveCount(0);
});
