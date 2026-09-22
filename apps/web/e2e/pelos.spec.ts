import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { PNG } from 'pngjs';
import { copyFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { aguardarModeloRenderizado } from './util';
import { enquadrar } from '../src/lib/estado/geometria';
import type { Manifesto } from '../src/lib/manifesto';

/**
 * Close do olho esquerdo: a câmera é a que `enquadrar(FMA12515)` calcula (0,3 m à frente do
 * centro do globo, olhando para ele) — lida do manifesto real e da mesma função que o app usa, para
 * o teste não repetir a conta à mão. FOV vertical de 40° (`Cena.tsx`, prop `camera` do Canvas).
 * Cada faixa é um ponto do mundo sobre a pele (y, z em metros) projetado em linhas da captura;
 * a coluna é o centro do canvas (olho e sobrancelha estão em x = 0,0291, o eixo da câmera).
 */
const FOV_RAD = (40 * Math.PI) / 180;
interface Faixa { y: number; z: number; meiaAlturaM: number }
const FAIXAS: Record<'sobrancelha' | 'testa' | 'couroCabeludo', Faixa> = {
  sobrancelha: { y: 1.54, z: 0.178, meiaAlturaM: 0.004 },   // 2,2 cm acima do olho, sobre a arcada
  testa: { y: 1.568, z: 0.185, meiaAlturaM: 0.006 },        // entre a sobrancelha e a linha do cabelo (1,588)
  couroCabeludo: { y: 1.605, z: 0.16, meiaAlturaM: 0.006 }, // 1,7 cm acima da linha do cabelo, testa já inclinando para trás
};
const LARGURA_JANELA_PX = 60;
const CONTRASTE_MINIMO = 25;       // unidades de luminância (0–255)
const PELE_ILUMINADA_MINIMO = 100; // controle: a testa está iluminada, não está tudo escuro
/** Fundo do canvas é #101214 (luminância ≈ 18): uma faixa escura tem de estar acima disto para ser pelo, não vazio. */
const FUNDO_MAXIMO = 40;

interface Caixa { x: number; y: number; width: number; height: number }
interface Camera { y: number; z: number }

/** Câmera do close, pelo manifesto e pela mesma `enquadrar` do app. `raizDoApp` = pasta do playwright.config. */
function cameraDoClose(raizDoApp: string): Camera {
  const manifesto = JSON.parse(readFileSync(join(raizDoApp, 'public/models/manifest.json'), 'utf8')) as Manifesto;
  const globo = manifesto.pecas.find((p) => p.fmaId === 'FMA12515');
  if (!globo) throw new Error('FMA12515 (globo ocular esquerdo) não está no manifesto');
  const { pos } = enquadrar(globo);
  return { y: pos[1], z: pos[2] };
}

/** Linha da captura onde cai o ponto (y, z) do mundo, na coluna do eixo da câmera. */
function linhaDe(yM: number, zM: number, canvas: Caixa, camera: Camera): number {
  const profundidade = camera.z - zM;
  const pxPorM = canvas.height / (2 * profundidade * Math.tan(FOV_RAD / 2));
  return Math.round(canvas.y + canvas.height / 2 - (yM - camera.y) * pxPorM);
}

/** Luminância média da janela [x0,x1)×[y0,y1) recortada à caixa do canvas; NaN se não sobrar pixel (janela fora = falha, não zero). */
function luminanciaMedia(png: PNG, x0: number, y0: number, x1: number, y1: number, canvas: Caixa): number {
  const xa = Math.max(x0, Math.ceil(canvas.x), 0), xb = Math.min(x1, Math.floor(canvas.x + canvas.width), png.width);
  const ya = Math.max(y0, Math.ceil(canvas.y), 0), yb = Math.min(y1, Math.floor(canvas.y + canvas.height), png.height);
  let soma = 0, n = 0;
  for (let y = ya; y < yb; y++)
    for (let x = xa; x < xb; x++) {
      const i = (png.width * y + x) * 4;
      soma += (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
      n++;
    }
  return n ? soma / n : NaN;
}

function medirFaixa(png: PNG, faixa: Faixa, canvas: Caixa, camera: Camera): number {
  const cx = Math.round(canvas.x + canvas.width / 2);
  const topo = linhaDe(faixa.y + faixa.meiaAlturaM, faixa.z, canvas, camera);
  const base = linhaDe(faixa.y - faixa.meiaAlturaM, faixa.z, canvas, camera);
  return luminanciaMedia(png, cx - LARGURA_JANELA_PX / 2, topo, cx + LARGURA_JANELA_PX / 2, base, canvas);
}

/** Captura para o relatório e uma cópia na Mesa (capturas em pastas temporárias são ilegíveis para revisão). */
async function capturar(page: Page, info: TestInfo, nome: string): Promise<PNG> {
  const caminho = info.outputPath(`${nome}.png`);
  const buf = await page.screenshot({ path: caminho });
  try { copyFileSync(caminho, join(homedir(), 'Desktop', `corpo3d-pelos-${nome}-${info.project.name}.png`)); } catch { /* Mesa opcional */ }
  return PNG.sync.read(buf);
}

test('no close do olho, sobrancelha e couro cabeludo são mais escuros que a testa', async ({ page }, info) => {
  test.skip(info.project.use.viewport!.width < 500, 'no celular o close não cabe as três faixas');
  // `config.rootDir` é a pasta dos testes (e2e), não a do app: a raiz do app é a pasta do arquivo de configuração
  const camera = cameraDoClose(dirname(info.config.configFile ?? join(process.cwd(), 'playwright.config.ts')));
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '241');
  await aguardarModeloRenderizado(page);

  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('olho esquerdo');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Globo ocular esquerdo/ }).click();
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA12515');
  await expect(cena).toHaveAttribute('data-camera', 'livre');
  // frameloop="demand": garante dois quadros depois da câmera mudar antes de medir
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

  const canvas = await page.locator('canvas').first().boundingBox();
  expect(canvas).not.toBeNull();
  // as três faixas têm de caber inteiras no canvas; se não cabem, câmera/FOV/layout mudaram e a medição seria de outra coisa
  for (const faixa of Object.values(FAIXAS)) {
    expect(linhaDe(faixa.y + faixa.meiaAlturaM, faixa.z, canvas!, camera), 'faixa acima do topo do canvas').toBeGreaterThanOrEqual(canvas!.y);
    expect(linhaDe(faixa.y - faixa.meiaAlturaM, faixa.z, canvas!, camera), 'faixa abaixo da base do canvas').toBeLessThanOrEqual(canvas!.y + canvas!.height);
  }
  const png = await capturar(page, info, 'olho-close');
  const testa = medirFaixa(png, FAIXAS.testa, canvas!, camera);
  const sobrancelha = medirFaixa(png, FAIXAS.sobrancelha, canvas!, camera);
  const couro = medirFaixa(png, FAIXAS.couroCabeludo, canvas!, camera);
  info.annotations.push({ type: 'luminância', description: `testa ${testa.toFixed(0)} · sobrancelha ${sobrancelha.toFixed(0)} · couro ${couro.toFixed(0)}` });

  expect(testa, 'controle: a testa está iluminada').toBeGreaterThan(PELE_ILUMINADA_MINIMO);
  expect(sobrancelha, 'controle: a faixa da sobrancelha mediu pele, não o fundo').toBeGreaterThan(FUNDO_MAXIMO);
  expect(couro, 'controle: a faixa do couro cabeludo mediu pele, não o fundo').toBeGreaterThan(FUNDO_MAXIMO);
  expect(sobrancelha, 'sobrancelha mais escura que a testa').toBeLessThan(testa - CONTRASTE_MINIMO);
  expect(couro, 'couro cabeludo mais escuro que a testa').toBeLessThan(testa - CONTRASTE_MINIMO);
});
