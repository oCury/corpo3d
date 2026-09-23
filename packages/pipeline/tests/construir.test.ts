import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { construir } from '../src/construir';
import { vetorExplosaoPadrao } from '../src/manifesto';

const FX = join(__dirname, 'fixtures');

describe('construir', () => {
  it('gera um GLB por peça e um manifest.json coerente', async () => {
    const saida = mkdtempSync(join(tmpdir(), 'models-'));
    const manifesto = await construir({
      csv: join(FX, 'estruturas.csv'),
      elementParts: { partof: join(FX, 'partof_element_parts.txt'), isa: join(FX, 'isa_element_parts.txt') },
      dirObj: join(FX, 'obj'),
      dirSaida: saida,
    });
    expect(manifesto.versao).toBe(1);
    expect(manifesto.pecas).toHaveLength(4);
    const coracao = manifesto.pecas.find((p) => p.fmaId === 'FMA1')!;
    expect(coracao.glb).toBe('cardiovascular/FMA1.glb');
    expect(existsSync(join(saida, coracao.glb))).toBe(true);
    expect(coracao.sistema).toBe('cardiovascular');
    expect(coracao.nomePt).toBe('Coração');
    expect(coracao.bytes).toBeGreaterThan(0);
    expect(coracao.centro[1]).toBeCloseTo(1.2, 2);                      // z=1200 mm → y=1,2 m
    const cranio = manifesto.pecas.find((p) => p.fmaId === 'FMA3')!;
    expect(cranio.elementos).toBe(2);                                    // FJ20 excluído
    const biceps = manifesto.pecas.find((p) => p.fmaId === 'FMA5')!;
    expect(biceps.vetorExplosao).toEqual([0, 0, 1]);                     // veio do CSV
    expect(coracao.vetorExplosao.length).toBe(3);                        // calculado
    const lido = JSON.parse(readFileSync(join(saida, 'manifest.json'), 'utf8'));
    expect(lido.pecas.map((p: { fmaId: string }) => p.fmaId)).toEqual(['FMA1', 'FMA3', 'FMA4', 'FMA5']);
    expect(lido.bytesTotal).toBe(manifesto.pecas.reduce((a, p) => a + p.bytes, 0));
  });

  it('gera partes do CSV: GLB por parte, JSON por pai, numPartes no manifesto e vetor radial', async () => {
    const saida = mkdtempSync(join(tmpdir(), 'models-'));
    const manifesto = await construir({
      csv: join(FX, 'estruturas.csv'), csvPartes: join(FX, 'partes.csv'),
      elementParts: { partof: join(FX, 'partof_element_parts.txt'), isa: join(FX, 'isa_element_parts.txt') },
      dirObj: join(FX, 'obj'), dirSaida: saida,
    });
    expect(manifesto.pecas.find((p) => p.fmaId === 'FMA1')!.numPartes).toBe(2);
    expect(manifesto.pecas.find((p) => p.fmaId === 'FMA4')!.numPartes).toBe(0);
    const json = JSON.parse(readFileSync(join(saida, 'partes', 'FMA1.json'), 'utf8'));
    expect(json.versao).toBe(1); expect(json.paiFmaId).toBe('FMA1');
    expect(json.partes.map((p: { fmaId: string }) => p.fmaId)).toEqual(['FMA7', 'FMA1-resto']);
    const v = json.partes[0];
    expect(v.glb).toBe('partes/FMA1/FMA7.glb'); expect(existsSync(join(saida, v.glb))).toBe(true);
    expect(v.sistema).toBe('cardiovascular'); expect(v.paiFmaId).toBe('FMA1'); expect(v.nivel).toBe(2); expect(v.status).toBe('auto'); expect(v.numPartes).toBe(0);
    expect(v.nomePt).toBe('Ventrículo'); expect(v.nomeLatim).toBe('ventriculo');
    expect(Math.hypot(...(v.vetorExplosao as [number, number, number]))).toBeGreaterThan(0);
    expect(existsSync(join(saida, 'partes', 'FMA1', 'FMA1-resto.glb'))).toBe(true);
    expect(json.partes[1].elementos).toBe(1);                                  // FJ11
  });
});

describe('vetorExplosaoPadrao', () => {
  it('aponta do eixo do corpo para o centro da peça, com peso por sistema, e é unitário × peso', () => {
    const v = vetorExplosaoPadrao([0.3, 1.2, -0.1], 'musculos');   // eixo do corpo em (0, y, 0)
    const len = Math.hypot(...v);
    expect(len).toBeCloseTo(1.2, 5);                                  // peso de músculos
    expect(v[0]).toBeGreaterThan(0); expect(v[2]).toBeLessThan(0); expect(v[1]).toBeCloseTo(0, 5);
  });
  it('peça no eixo (mediana) sai para a frente', () => {
    expect(vetorExplosaoPadrao([0, 1.0, 0], 'esqueleto')).toEqual([0, 0, 0.6]);
  });
});
