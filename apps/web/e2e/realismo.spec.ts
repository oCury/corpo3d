import { test, expect, type Locator } from '@playwright/test';
import { PNG } from 'pngjs';
import { join } from 'node:path';
import { aguardarModeloRenderizado, capturarSePossivel } from './util';

const FUNDO = [16, 18, 20];
/** Pixel escuro cujos 8 vizinhos são claros: é o "pontinho" da normal virada, não sombra (spec pele-realismo §9). */
const LUM_PONTO_ESCURO = 95;
const LUM_VIZINHO_CLARO = 130;
const MAX_PONTOS_ISOLADOS = 20;
/** Oclusão de contato: escurece o percentil 5 do corpo em ≥ 8 níveis e o percentil 95 em ≤ 3. */
const QUEDA_MINIMA_P5 = 8;
const QUEDA_MAXIMA_P95 = 3;

interface Analise { pontosIsolados: number; p5: number; p95: number; corpo: number }

function analisar(png: Buffer): Analise {
  const img = PNG.sync.read(png);
  const { width: w, height: h, data } = img;
  const lum = new Float32Array(w * h);
  const ehCorpo = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    ehCorpo[i] = Math.abs(r - FUNDO[0]) + Math.abs(g - FUNDO[1]) + Math.abs(b - FUNDO[2]) > 30 ? 1 : 0;
  }
  let pontosIsolados = 0;
  const lums: number[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!ehCorpo[i]) continue;
    lums.push(lum[i]);
    if (lum[i] >= LUM_PONTO_ESCURO) continue;
    let claros = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && lum[i + dy * w + dx] > LUM_VIZINHO_CLARO) claros++;
    if (claros === 8) pontosIsolados++;
  }
  lums.sort((a, b) => a - b);
  const p = (q: number) => lums[Math.floor(q * (lums.length - 1))] ?? 0;
  return { pontosIsolados, p5: p(0.05), p95: p(0.95), corpo: lums.length };
}

/** Chromium sem cabeça às vezes recusa a captura num quadro pesado: repete até conseguir. */
async function capturar(alvo: Locator): Promise<Buffer> {
  let ultimo: unknown;
  for (let i = 0; i < 5; i++) { try { return await alvo.screenshot(); } catch (e) { ultimo = e; await new Promise((r) => setTimeout(r, 100)); } }
  throw ultimo;
}

const doisQuadros = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

test('pele sem pontos escuros isolados; a oclusão cozida escurece só as dobras', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'palco pequeno demais para a estatística de pixels');
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '241');
  await aguardarModeloRenderizado(page);
  await expect(cena).toHaveAttribute('data-camera', 'frente');

  const ligada = analisar(await capturar(cena));
  expect(ligada.corpo).toBeGreaterThan(20_000);
  expect(ligada.pontosIsolados, `pontos escuros isolados no corpo (p5 ${ligada.p5.toFixed(0)}, p95 ${ligada.p95.toFixed(0)})`).toBeLessThanOrEqual(MAX_PONTOS_ISOLADOS);
  await capturarSePossivel(cena, join(process.env.HOME ?? '', 'Desktop', `corpo3d-realismo-frente-${info.project.name}.png`));

  // desliga a oclusão pelo gancho de desenvolvimento e espera dois quadros (frameloop="demand": invalidate → rAF)
  await page.evaluate(() => (window as unknown as { __oclusao: (v: number) => void }).__oclusao(0));
  await page.evaluate(doisQuadros);
  const desligada = analisar(await capturar(cena));
  await page.evaluate(() => (window as unknown as { __oclusao: (v: number) => void }).__oclusao(1));

  expect(desligada.p5 - ligada.p5, `p5 ligada ${ligada.p5.toFixed(1)} × desligada ${desligada.p5.toFixed(1)}`).toBeGreaterThanOrEqual(QUEDA_MINIMA_P5);
  expect(desligada.p95 - ligada.p95, `p95 ligada ${ligada.p95.toFixed(1)} × desligada ${desligada.p95.toFixed(1)}`).toBeLessThanOrEqual(QUEDA_MAXIMA_P95);
});
