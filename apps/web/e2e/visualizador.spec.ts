import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

const FUNDO = [16, 18, 20]; // #101214, a cor de fundo do canvas

/** Fração dos pixels de uma janela central que NÃO são a cor de fundo. */
function fracaoNaoFundo(png: Buffer, lado = 200): number {
  const img = PNG.sync.read(png);
  const x0 = Math.floor(img.width / 2 - lado / 2), y0 = Math.floor(img.height / 2 - lado / 2);
  let diferentes = 0, total = 0;
  for (let y = y0; y < y0 + lado; y++) for (let x = x0; x < x0 + lado; x++) {
    const i = (img.width * y + x) * 4;
    const d = Math.abs(img.data[i] - FUNDO[0]) + Math.abs(img.data[i + 1] - FUNDO[1]) + Math.abs(img.data[i + 2] - FUNDO[2]);
    total++; if (d > 30) diferentes++;
  }
  return diferentes / total;
}

test('abre o manifesto, carrega as 251 peças sem erro de console e renderiza pixels', async ({ page }, info) => {
  const erros: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(e.message));
  const respostas: number[] = [];
  page.on('response', (r) => { if (r.url().includes('/models/') && r.url().endsWith('.glb')) respostas.push(r.status()); });

  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toBeVisible();
  await expect(cena).toHaveAttribute('data-pecas', '251');
  await expect(page.locator('canvas')).toBeVisible();

  // espera os GLBs chegarem (251 requisições OK)
  await expect.poll(() => respostas.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(251);
  expect(respostas.filter((s) => s !== 200 && s !== 304)).toEqual([]);

  // o canvas não pode estar todo da cor de fundo: decodifica a captura e amostra uma janela central
  await page.waitForTimeout(1500);
  const captura = await page.screenshot({ path: info.outputPath(`corpo-${info.project.name}.png`) });
  const lado = Math.min(200, Math.floor(Math.min(page.viewportSize()!.width, page.viewportSize()!.height) / 3));
  const fracao = fracaoNaoFundo(captura, lado);
  expect(fracao, `janela central ${lado}px: ${(fracao * 100).toFixed(1)}% de pixels não são fundo`).toBeGreaterThan(0.2);

  expect(erros).toEqual([]);
});

test('página de atribuição traz o texto exigido', async ({ page }) => {
  await page.goto('/atribuicao');
  await expect(page.getByText('CC Attribution 4.0 International')).toBeVisible();
});
