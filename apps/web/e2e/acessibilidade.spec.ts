import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('busca por nome seleciona e foca a peça', async ({ page }) => {
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '251');
  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('figado');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Fígado/ }).click();
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA7197');
  await expect(cena).toHaveAttribute('data-camera', 'livre');
  await expect(page.getByTestId('painel-peca').getByRole('heading', { level: 2 })).toHaveText('fígado');
});

test('lista de peças: teclado seleciona (Enter) e desmonta/encaixa (Espaço)', async ({ page }) => {
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '251');
  const item = page.getByRole('listbox', { name: 'Peças' }).getByRole('option', { name: /^Coração$/ });
  await item.focus();
  await page.keyboard.press('Enter');
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA7088');
  await page.keyboard.press('Space');
  await expect(cena).toHaveAttribute('data-soltas', '1');
  await page.keyboard.press('Space');
  await expect(cena).toHaveAttribute('data-soltas', '0');
});

test('sem violações sérias do axe nos painéis', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('cena')).toHaveAttribute('data-pecas', '251');
  const r = await new AxeBuilder({ page }).exclude('canvas').analyze();
  const serias = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serias.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});
