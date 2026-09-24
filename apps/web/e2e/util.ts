import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { PNG } from 'pngjs';

const FUNDO = [16, 18, 20]; // #101214, a cor de fundo do canvas

/** Fração dos pixels de uma janela central de 200px que NÃO são o fundo. */
function fracaoNaoFundo(png: Buffer): number {
  const img = PNG.sync.read(png);
  const lado = 200;
  const x0 = Math.floor(img.width / 2 - lado / 2), y0 = Math.floor(img.height / 2 - lado / 2);
  let diferentes = 0, total = 0;
  for (let y = y0; y < y0 + lado; y++) for (let x = x0; x < x0 + lado; x++) {
    const i = (img.width * y + x) * 4;
    const d = Math.abs(img.data[i] - FUNDO[0]) + Math.abs(img.data[i + 1] - FUNDO[1]) + Math.abs(img.data[i + 2] - FUNDO[2]);
    total++; if (d > 30) diferentes++;
  }
  return diferentes / total;
}

/**
 * `abrir()`/`page.goto('/')` só garante que o manifesto (metadados) carregou — os 241 GLBs ainda
 * estão chegando de forma assíncrona (Suspense) e o canvas só assume o tamanho final e ganha
 * malhas clicáveis depois disso. Sem esta espera, um clique/arrasto no canvas logo após abrir a
 * página não acerta nada (raycast vazio): é uma corrida, não uma questão de posição do gesto.
 * `alvo` (opcional) restringe a medição a um elemento — o palco, por exemplo: no tablet empilhado o
 * centro da página não é o centro do canvas, e depois de um `enquadrar` o modelo está no centro do canvas.
 */
export async function aguardarModeloRenderizado(page: Page, alvo: Locator | Page = page) {
  await expect.poll(async () => {
    // Chromium sem cabeça às vezes recusa a captura no meio de um quadro WebGL pesado
    // ("Unable to capture screenshot"): é "ainda não pronto", não falha do teste — o poll repete.
    try { return fracaoNaoFundo(await alvo.screenshot()); } catch { return 0; }
  }, { timeout: 60_000 }).toBeGreaterThan(0.2);
}

/** Captura para arquivo só como artefato de inspeção: uma recusa do Chromium não deve reprovar o teste. */
export async function capturarSePossivel(alvo: Page | Locator, path: string) {
  try { await alvo.screenshot({ path }); } catch { /* artefato opcional */ }
}
