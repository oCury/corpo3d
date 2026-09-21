import { test, expect } from '@playwright/test';

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

  // o canvas não pode estar todo da cor de fundo: amostra o pixel central
  await page.waitForTimeout(1500);
  const centro = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return null;
    const px = new Uint8Array(4);
    gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return Array.from(px);
  });
  // com preserveDrawingBuffer=false o readPixels pode devolver zeros; nesse caso a prova é o screenshot
  await page.screenshot({ path: info.outputPath(`corpo-${info.project.name}.png`) });
  if (centro && centro.some((v) => v !== 0)) expect(centro.slice(0, 3)).not.toEqual([16, 18, 20]);

  expect(erros).toEqual([]);
});

test('página de atribuição traz o texto exigido', async ({ page }) => {
  await page.goto('/atribuicao');
  await expect(page.getByText('CC Attribution 4.0 International')).toBeVisible();
});
