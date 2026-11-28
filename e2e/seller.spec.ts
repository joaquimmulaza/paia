// F2 · Vender ponta a ponta: a estudante pede a loja, o admin aprova, a estudante publica um
// produto com foto e o comprador (sem sessão) vê-o em /explorar e em /produto/:id.
// Corre contra o Supabase local; as contas e a loja são criadas aqui e removidas no fim.
import { randomUUID } from 'node:crypto';
import { devices, expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, localSql, tinyPng } from './support';

const STORE_NAME = 'Loja Teste E2E';
const stamp = Date.now();
const PRODUCT_NAME = `Bolo E2E ${stamp}`;

// Contas novas em cada execução. As palavras-passe são geradas aqui e nunca ficam num ficheiro.
const student = { email: `vendedora+${stamp}@exemplo.test`, password: randomUUID() };
const admin = { email: `admin-vender+${stamp}@exemplo.test`, password: randomUUID() };

const contextOptions = {
  ...devices['Pixel 7'],
  baseURL: 'http://localhost:5173',
  locale: 'pt-AO',
};

test.describe.configure({ mode: 'serial' });

function cleanup() {
  // A loja de teste (e o que depende dela) e a promoção do admin. Os ficheiros do Storage
  // ficam até ao próximo `npm run db:reset`.
  localSql(`
    delete from public.product_images
     where product_id in (select p.id from public.products p join public.stores s on s.id = p.store_id
                           where s.name = '${STORE_NAME}');
    delete from public.products
     where store_id in (select id from public.stores where name = '${STORE_NAME}');
    delete from public.store_decisions
     where store_id in (select id from public.stores where name = '${STORE_NAME}');
    delete from public.stores where name = '${STORE_NAME}';
    delete from public.admin_users
     where user_id in (select id from auth.users where email = '${admin.email}');
  `);
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

async function signUp(
  page: Page,
  who: { email: string; password: string },
  kind: 'student' | 'staff',
) {
  await page.goto('/criar-conta');
  await page
    .getByLabel('Nome completo')
    .fill(kind === 'student' ? 'Vendedora de Teste' : 'Equipa de Teste');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Telefone').fill('923456781');
  await page.getByLabel('Palavra-passe').fill(who.password);
  if (kind === 'student') {
    await page.getByRole('radio', { name: 'Estudante' }).check();
    await page.getByLabel('Curso').fill('Curso de Teste');
    await page.getByLabel('Ano curricular').fill('2.º ano');
    await page.getByLabel('Turno').fill('Manhã');
    await page.getByLabel('Turma').fill('A');
  } else {
    await page.getByRole('radio', { name: 'Funcionário ou colaborador' }).check();
  }
  await page.getByRole('checkbox', { name: /Aceito os Termos/ }).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/perfil$/);
}

const photo = () => ({ name: 'foto.png', mimeType: 'image/png', buffer: tinyPng() });

test('pedir loja, aprovar, publicar produto e vê-lo no catálogo', async ({ page, browser }) => {
  // 1. A estudante pede a loja, com logótipo.
  await signUp(page, student, 'student');
  await page.goto('/vender');
  await expect(
    page.getByRole('heading', { level: 1, name: /Vende à tua comunidade/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Pedir a minha loja' }).click();
  await expect(page).toHaveURL(/\/vender\/pedido$/);

  await page.getByLabel('Nome da loja').fill(STORE_NAME);
  await page.getByLabel('Descrição').fill('Bolos e doces feitos para o teste ponta a ponta.');
  await page.getByLabel('Categoria principal').selectOption({ label: 'Doces' });
  // O primeiro input de ficheiro é o do logótipo (o da capa vem depois).
  await page.locator('input[type="file"]').first().setInputFiles(photo());
  await expect(page.getByRole('button', { name: 'Trocar' }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expectNoAxeViolations(page); // V02

  await page.getByRole('button', { name: 'Enviar para análise' }).click();
  await expect(page).toHaveURL(/\/vender\/estado$/);
  await expect(page.getByText('Recebemos o teu pedido')).toBeVisible();
  await expectNoAxeViolations(page); // V03

  // 2. O admin aprova em /admin/candidaturas (outra sessão).
  const adminContext = await browser.newContext(contextOptions);
  try {
    const adminPage = await adminContext.newPage();
    await signUp(adminPage, admin, 'staff');
    const promoted = localSql(`
      insert into public.admin_users (user_id)
      select id from auth.users where email = '${admin.email}'
      returning user_id
    `);
    expect(promoted).toMatch(/^[0-9a-f-]{36}$/);

    await adminPage.goto('/admin/candidaturas');
    await expect(
      adminPage.getByRole('heading', { level: 1, name: 'Candidaturas de lojas' }),
    ).toBeVisible();
    await adminPage.getByRole('button', { name: STORE_NAME }).click();
    const detail = adminPage.getByRole('region', { name: STORE_NAME });
    await expect(detail.getByRole('button', { name: 'Aprovar loja' })).toBeVisible();
    await expectNoAxeViolations(adminPage); // A01
    await detail.getByRole('button', { name: 'Aprovar loja' }).click();
    await expect(adminPage.getByRole('button', { name: STORE_NAME })).toHaveCount(0);
  } finally {
    await adminContext.close();
  }
  expect(localSql(`select status from public.stores where name = '${STORE_NAME}'`)).toBe(
    'approved',
  );

  // 3. A estudante vê a loja aprovada e publica um produto com 1 foto.
  await page.goto('/vender/loja');
  await expect(page.getByRole('heading', { name: STORE_NAME })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Publica o primeiro produto' })).toBeVisible();
  await expectNoAxeViolations(page); // V04b

  await page.goto('/vender/produtos/novo');
  await page.getByLabel('Nome', { exact: true }).fill(PRODUCT_NAME);
  await page.getByLabel('Descrição').fill('Bolo de teste, feito no próprio dia.');
  await page.getByLabel('Categoria', { exact: true }).selectOption({ label: 'Doces' });
  await page.getByLabel('Preço (Kz)').fill('1500');
  await page.getByLabel('Stock').fill('5');
  await page.locator('input[type="file"]').setInputFiles(photo());
  await expect(page.getByRole('button', { name: 'Remover foto 1' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('Não enviada')).toHaveCount(0);
  await expectNoAxeViolations(page); // V06

  await page.getByRole('button', { name: 'Publicar produto' }).click();
  await expect(page).toHaveURL(/\/vender\/produtos$/);
  await expect(page.getByText(PRODUCT_NAME).first()).toBeVisible();

  // 4. O comprador (sem sessão) vê o produto no catálogo.
  const buyerContext = await browser.newContext(contextOptions);
  try {
    const buyer = await buyerContext.newPage();
    await buyer.goto('/explorar');
    await buyer.getByLabel('Pesquisar produtos e lojas').fill(PRODUCT_NAME);
    const link = buyer.getByRole('link', { name: new RegExp(PRODUCT_NAME) });
    await expect(link).toBeVisible();
    await link.click();
    await expect(buyer).toHaveURL(/\/produto\/[0-9a-f-]{36}$/);
    await expect(buyer.getByRole('heading', { level: 1, name: PRODUCT_NAME })).toBeVisible();
    await expect(buyer.getByTestId('product-price')).toContainText(/1\D*500\s*Kz/);
    await expect(buyer.getByRole('link', { name: new RegExp(STORE_NAME) })).toBeVisible();
  } finally {
    await buyerContext.close();
  }
});
