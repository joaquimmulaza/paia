// Catálogo sem sessão, com os dados ilustrativos do seed (aplicado pelo `db:reset` do verify).
// Não depende dos destaques: o admin-features.spec muda-os (os ficheiros correm um de cada vez).
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, localSql } from './support';

// O seed não fixa os ids dos produtos: lê-se o do produto por publicar na base local.
function unpublishedProductId(): string {
  const row = localSql(
    "select id || ' ' || is_published from public.products where name = 'Coxinhas de frango (4)'",
  );
  expect(row, 'o seed tem «Coxinhas de frango (4)» por publicar').toMatch(/^[0-9a-f-]{36} false$/);
  return row.split(' ')[0] as string;
}

test('o Início mostra as novidades da comunidade', async ({ page }) => {
  await page.goto('/');
  const news = page.getByRole('region', { name: 'Novidades na comunidade' });
  await expect(news).toBeVisible();
  await expect(news.getByRole('article').first()).toBeVisible();
});

test('pesquisa sem acentos, abre o produto e a loja', async ({ page }) => {
  await page.goto('/explorar');
  await page.getByLabel('Pesquisar produtos e lojas').fill('pasteis');
  const product = page.getByRole('link', { name: 'Pastéis de carne (3)' });
  await expect(product).toBeVisible();

  await product.click();
  await expect(page).toHaveURL(/\/produto\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pastéis de carne (3)' })).toBeVisible();
  await expect(page.getByTestId('product-price')).toHaveText('500 Kz');
  await expect(page.getByText(/^Loja aprovada pelo PAIÁ/)).toBeVisible();

  await page.getByRole('link', { name: /Salgados do Bloco/ }).click();
  await expect(page).toHaveURL(/\/loja\/salgados-do-bloco$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Salgados do Bloco' })).toBeVisible();
});

test('uma pesquisa sem resultados numa categoria diz o que não encontrou', async ({ page }) => {
  await page.goto('/explorar');
  const categories = page.getByRole('group', { name: 'Filtrar por categoria' });
  await categories.getByRole('button', { name: 'Salgados' }).click();
  await page.getByLabel('Pesquisar produtos e lojas').fill('pizza');
  await expect(page.getByText('Nada para «pizza» em Salgados')).toBeVisible();
});

test('um produto por publicar, aberto pela URL, não aparece', async ({ page }) => {
  await page.goto(`/produto/${unpublishedProductId()}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Não encontrámos o que procuras.' }),
  ).toBeVisible();
  await expect(page.getByText('Coxinhas de frango (4)')).toHaveCount(0);
});

test.describe('acessibilidade (axe)', () => {
  const pages: { url: string; ready: string }[] = [
    { url: '/', ready: 'Novidades na comunidade' },
    { url: '/explorar?q=bolo', ready: 'Fatia de bolo de chocolate' },
    { url: '/explorar?q=pizza&categoria=salgados', ready: 'Nada para «pizza» em Salgados' },
    { url: '/lojas', ready: 'Doces da Ana' },
    { url: '/loja/doces-da-ana', ready: 'Fatia de bolo de chocolate' },
  ];

  for (const { url, ready } of pages) {
    test(`0 violações em ${url}`, async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText(ready).first()).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }

  test('0 violações em /produto/<id>', async ({ page }) => {
    await page.goto('/explorar?q=pasteis');
    await page.getByRole('link', { name: 'Pastéis de carne (3)' }).click();
    await expect(page.getByTestId('product-price')).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
