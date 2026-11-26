import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Dados ilustrativos: domínio fictício e telefone de exemplo. Email único por execução.
const student = {
  fullName: 'Aluno de Teste',
  email: `aluno+${Date.now()}@exemplo.test`,
  phone: '923456789',
  password: 'palavra-passe-de-teste',
};

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} [${v.impact ?? 'sem impacto'}]: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, `Violações do axe em ${page.url()}`).toEqual([]);
  expect(violations).toHaveLength(0);
}

async function signIn(page: Page, password: string) {
  await page.getByLabel('Email').fill(student.email);
  await page.getByLabel('Palavra-passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test.describe.configure({ mode: 'serial' });

test('regista um estudante, termina sessão e volta a entrar', async ({ page }) => {
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { name: /Entra no/ })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto('/criar-conta');
  await expect(page.getByRole('heading', { name: 'Dados académicos' })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel('Nome completo').fill(student.fullName);
  await page.getByLabel('Email').fill(student.email);
  await page.getByLabel('Telefone').fill(student.phone);
  await page.getByLabel('Palavra-passe').fill(student.password);
  await page.getByRole('radio', { name: 'Estudante' }).check();
  await page.getByLabel('Curso').fill('Engenharia Informática');
  await page.getByLabel('Ano curricular').fill('2.º ano');
  await page.getByLabel('Turno').fill('Manhã');
  await page.getByLabel('Turma').fill('A');
  await page.getByRole('checkbox', { name: /Aceito os Termos/ }).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page).toHaveURL(/\/perfil$/);
  const account = page.getByRole('region', { name: 'A tua conta' });
  await expect(account.getByText(student.fullName)).toBeVisible();
  await expect(account.getByText('Estudante')).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Terminar sessão', exact: true }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  await signIn(page, 'palavra-passe-errada');
  await expect(page.getByText('Email ou palavra-passe errados.')).toBeVisible();
  await expect(page).toHaveURL(/\/entrar$/);

  await signIn(page, student.password);
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(
    page.getByRole('region', { name: 'A tua conta' }).getByText(student.fullName),
  ).toBeVisible();
});
