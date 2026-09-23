import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { aguardarModeloRenderizado, capturarSePossivel } from './util';
import type { ManifestoPartes } from '../src/lib/manifesto';

const CORACAO = 'FMA7088';
const VENTRICULO_ESQUERDO = 'FMA7101';

test('abre as partes do coração, seleciona um ventrículo, explode dentro do órgão, volta pelo caminho e desfaz', async ({ page }, info) => {
  test.skip(info.project.use.viewport!.width < 500, 'no celular a lista fica abaixo do palco; coberto no desktop e tablet');
  const raiz = dirname(info.config.configFile ?? join(process.cwd(), 'playwright.config.ts'));
  const json = JSON.parse(readFileSync(join(raiz, 'public/models/partes', `${CORACAO}.json`), 'utf8')) as ManifestoPartes;
  const n = json.partes.length;
  const ventriculo = json.partes.find((p) => p.fmaId === VENTRICULO_ESQUERDO);
  expect(ventriculo, 'o coração precisa ter o ventrículo esquerdo como parte (partes.csv)').toBeDefined();

  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '241');
  await aguardarModeloRenderizado(page);

  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('coração');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Coração\b/ }).click();
  await expect(cena).toHaveAttribute('data-selecionada', CORACAO);
  await page.getByRole('button', { name: `Ver partes (${n})` }).click();
  await expect(cena).toHaveAttribute('data-detalhe', CORACAO);
  await expect(cena).toHaveAttribute('data-visiveis', String(240 + n));
  await expect(cena).toHaveAttribute('data-selecionada', '');
  await expect(page.getByRole('navigation', { name: 'Caminho' })).toContainText('Coração');
  await capturarSePossivel(page, join(process.env.HOME ?? '', 'Desktop', `corpo3d-detalhe-coracao-${info.project.name}.png`));

  // a lista ganha o grupo "Partes de Coração"; escolher o ventrículo seleciona e enquadra
  await page.getByRole('listbox', { name: 'Peças' }).getByRole('option', { name: ventriculo!.nomePt, exact: true }).click();
  await expect(cena).toHaveAttribute('data-selecionada', VENTRICULO_ESQUERDO);
  await expect(page.getByTestId('painel-peca')).toContainText(ventriculo!.nomePt);

  // explosão move a parte a partir do centro do coração
  await page.getByLabel('Explosão').fill('0.5');
  await expect(cena).toHaveAttribute('data-explosao', '0.5');
  await expect.poll(async () => page.evaluate((id) => {
    const cena = (window as unknown as { __cena?: { getObjectByName(n: string): { position: { length(): number } } | undefined } }).__cena;
    return cena?.getObjectByName(id)?.position.length() ?? 0;
  }, VENTRICULO_ESQUERDO)).toBeGreaterThan(0.02);
  await page.getByRole('button', { name: 'Remontar tudo' }).click();

  // acessibilidade com detalhe aberto
  const axe = await new AxeBuilder({ page }).exclude('canvas').analyze(); // mesmo recorte do acessibilidade.spec: o canvas WebGL não é conteúdo
  expect(axe.violations).toEqual([]);

  // caminho: "Corpo" fecha tudo; desfazer reabre
  await page.getByRole('navigation', { name: 'Caminho' }).getByRole('button', { name: 'Corpo' }).click();
  await expect(cena).toHaveAttribute('data-detalhe', '');
  await expect(cena).toHaveAttribute('data-visiveis', '241');
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(cena).toHaveAttribute('data-detalhe', CORACAO);
  await expect(cena).toHaveAttribute('data-visiveis', String(240 + n));
});

test('Esc com detalhe aberto e nada selecionado fecha um nível', async ({ page }, info) => {
  test.skip(info.project.use.viewport!.width < 500, 'coberto no desktop e tablet');
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '241');
  await aguardarModeloRenderizado(page);
  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('coração');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Coração\b/ }).click();
  await page.getByRole('button', { name: /^Ver partes/ }).click();
  await expect(cena).toHaveAttribute('data-detalhe', CORACAO);
  await page.keyboard.press('Escape');
  await expect(cena).toHaveAttribute('data-detalhe', '');
});
