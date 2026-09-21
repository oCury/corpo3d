import { test, expect, type Page } from '@playwright/test';
import { aguardarModeloRenderizado, capturarSePossivel } from './util';

test.describe('arrasto', () => {
  test.skip(({ viewport }) => viewport!.width < 500, 'canvas estreito demais para o arrasto de 220 px');

  /** Deixa o esterno exposto e centralizado: pele e músculos a 0, busca "esterno", foca. */
  async function prepararEsterno(page: Page) {
    await page.goto('/');
    const cena = page.getByTestId('cena');
    await expect(cena).toHaveAttribute('data-pecas', '241');
    await aguardarModeloRenderizado(page);
    await page.getByLabel('Pele').fill('0');
    await page.getByLabel('Músculos').fill('0');
    await expect(cena).toHaveAttribute('data-visiveis', '186');
    await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('esterno');
    await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Esterno osso/ }).click();
    await expect(cena).toHaveAttribute('data-selecionada', 'FMA7485');
    await expect(cena).toHaveAttribute('data-historico', '2');
    const box = (await page.locator('canvas').boundingBox())!;
    return { cena, box, cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
  }

  test('arrastar para fora solta a peça (fantasma no lugar); arrastar de volta encaixa', async ({ page }) => {
    const { cena, cx, cy } = await prepararEsterno(page);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 220, cy - 40, { steps: 12 });
    await page.mouse.up();
    await expect(cena).toHaveAttribute('data-soltas', '1');
    await expect(cena).toHaveAttribute('data-historico', '3'); // pele, músculos, soltar
    await capturarSePossivel(page, test.info().outputPath('esterno-solto.png'));
    await page.mouse.move(cx + 220, cy - 40);
    await page.mouse.down();
    await page.mouse.move(cx, cy, { steps: 12 });
    await page.mouse.up();
    await expect(cena).toHaveAttribute('data-soltas', '0');
  });

  test('clique sem movimento seleciona, não solta', async ({ page }) => {
    const { cena } = await prepararEsterno(page);
    await page.getByRole('button', { name: 'Recentrar' }).click();
    await expect(cena).toHaveAttribute('data-camera', 'frente');
    await page.keyboard.press('Escape');
    await expect(cena).toHaveAttribute('data-selecionada', '');
    // No layout empilhado (<900px) o clique em "Recentrar" rola a página para trazer o botão à vista
    // (mesma armadilha documentada em interacao.spec.ts) — o canvas pode terminar acima da viewport
    // (y negativo). Rolar de volta e só então recalcular a caixa. "Recentrar" reaplica a câmera
    // inicial (mesma pos/alvo de CAMERA_INICIAL), e a fração 0.45 da altura é a mesma usada em
    // interacao.spec.ts para acertar o tronco nessa vista, comprovada nos três viewports.
    const canvas = page.locator('canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45); // tronco sem pele/músculos: costela, esterno ou órgão
    await expect(cena).not.toHaveAttribute('data-selecionada', '');
    await expect(cena).toHaveAttribute('data-soltas', '0');
  });

  test('com prefers-reduced-motion a explosão aplica a posição sem animar', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { cena } = await prepararEsterno(page);
    await page.getByLabel('Explosão').fill('1');
    await expect(cena).toHaveAttribute('data-explosao', '1');
    const lerZ = () => page.evaluate(() => {
      const g = (window as unknown as { __cena?: { getObjectByName(n: string): { position: { z: number } } | undefined } }).__cena;
      return g?.getObjectByName('FMA7485')?.position.z ?? null;
    });
    await expect.poll(lerZ, { timeout: 5_000 }).not.toBeNull();
    await expect.poll(lerZ, { timeout: 5_000 }).toBeCloseTo(0.24, 2);
  });
});
