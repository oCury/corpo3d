import { test, expect, type Page } from '@playwright/test';

async function abrir(page: Page) {
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '251');
  await expect(cena).toHaveAttribute('data-visiveis', '251');
  return cena;
}

test('camadas: opacidade 0 desmonta as peças do sistema; 1 remonta', async ({ page }) => {
  const cena = await abrir(page);
  await page.getByLabel('Pele').fill('0');
  await expect(cena).toHaveAttribute('data-visiveis', '250');
  await page.getByLabel('Músculos').fill('0');
  await expect(cena).toHaveAttribute('data-visiveis', '196');      // 250 - 54 músculos
  await page.getByLabel('Pele').fill('1');
  await expect(cena).toHaveAttribute('data-visiveis', '197');
});

test('explosão, remontar tudo e desfazer/refazer', async ({ page }) => {
  const cena = await abrir(page);
  await page.getByLabel('Explosão').fill('0.5');
  await expect(cena).toHaveAttribute('data-explosao', '0.5');
  await page.getByRole('button', { name: 'Remontar tudo' }).click();
  await expect(cena).toHaveAttribute('data-explosao', '0');
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(cena).toHaveAttribute('data-explosao', '0.5');
  await page.getByRole('button', { name: 'Refazer' }).click();
  await expect(cena).toHaveAttribute('data-explosao', '0');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(cena).toHaveAttribute('data-explosao', '0.5');
});

test('presets de câmera', async ({ page }) => {
  const cena = await abrir(page);
  await expect(cena).toHaveAttribute('data-camera', 'frente');
  await page.getByRole('button', { name: 'Costas' }).click();
  await expect(cena).toHaveAttribute('data-camera', 'costas');
  await page.getByRole('button', { name: 'Superior' }).click();
  await expect(cena).toHaveAttribute('data-camera', 'superior');
  await page.getByRole('button', { name: 'Recentrar' }).click();
  await expect(cena).toHaveAttribute('data-camera', 'frente');
});
