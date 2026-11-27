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

/**
 * Põe os destaques no estado do seed, para o teste poder correr outra vez sem `db:reset`:
 * Salgados do Bloco sem destaque e Gelados Fresquinhos em destaque, a seguir aos outros.
 */
function resetFeatures() {
  localSql(`
    delete from public.store_features where source = 'admin' and store_id = '${SALGADOS}';
    insert into public.store_features (store_id, source, position, is_active)
    select '${GELADOS}', 'admin', (select coalesce(max(position), -1) + 1 from public.store_features), true
    where not exists (
      select 1 from public.store_features
      where store_id = '${GELADOS}' and source = 'admin' and is_active
    );
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
  resetFeatures();
});

test.afterAll(() => {
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

  // Subir até à posição 0 (a primeira linha da lista).
  const up = list.getByRole('button', { name: 'Subir Salgados do Bloco' });
  const firstRow = list.getByRole('row').nth(1);
  for (let i = 0; i < 10; i++) {
    if ((await up.getAttribute('aria-disabled')) === 'true') break;
    const reordered = page.waitForResponse(
      (r) => r.url().includes('/rpc/admin_reorder_store_features') && r.ok(),
    );
    await up.click();
    await reordered;
  }
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
