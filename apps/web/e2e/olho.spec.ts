import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { aguardarModeloRenderizado } from './util';

/** Janela central de 240×240 px: conta pixels escuros (pupila/íris) e claros (esclera). */
function contarTons(captura: Buffer): { escuros: number; claros: number } {
  const png = PNG.sync.read(captura);
  const cx = png.width >> 1,
    cy = png.height >> 1;
  let escuros = 0,
    claros = 0;
  for (let y = cy - 120; y < cy + 120; y++)
    for (let x = cx - 120; x < cx + 120; x++) {
      const i = (png.width * y + x) * 4;
      const l = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
      if (l < 60) escuros++;
      if (l > 170) claros++;
    }
  return { escuros, claros };
}

test('os dois olhos são peças selecionáveis e o close do rosto mostra íris escura com esclera clara', async ({
  page,
}, testInfo) => {
  // A janela de 240 px não cabe no celular (320×640) e lá o olho enquadrado é menor que ela.
  test.skip(testInfo.project.use.viewport!.width < 500, 'janela de 240 px maior que o enquadramento no celular');
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '241');
  await aguardarModeloRenderizado(page);

  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('olho esquerdo');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Globo ocular esquerdo/ }).click();
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA12515');
  await expect(cena).toHaveAttribute('data-camera', 'livre'); // enquadrou o olho

  const { escuros, claros } = contarTons(await page.screenshot({ path: testInfo.outputPath('olho-close.png') }));
  expect(escuros).toBeGreaterThan(300);
  expect(claros).toBeGreaterThan(2000);

  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('olho direito');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Globo ocular direito/ }).click();
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA12514');
});
