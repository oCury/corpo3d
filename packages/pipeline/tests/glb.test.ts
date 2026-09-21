import { describe, it, expect } from 'vitest';
import { mkdtempSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { escreverGlb } from '../src/glb';

// cubo de 1 m centrado em (2, 3, 4): 8 vértices, 12 triângulos
function cubo() {
  const c = [2, 3, 4], h = 0.5, p: number[] = [];
  for (const dz of [-h, h]) for (const dy of [-h, h]) for (const dx of [-h, h]) p.push(c[0] + dx, c[1] + dy, c[2] + dz);
  // winding CCW visto de fora (normal para fora); ordem trocada em relação a uma versão anterior que ficava "de dentro para fora"
  const f = [0,3,1, 0,2,3, 4,7,6, 4,5,7, 0,5,4, 0,1,5, 2,7,3, 2,6,7, 0,6,2, 0,4,6, 1,7,5, 1,3,7];
  return { posicoes: p, indices: f };
}

describe('escreverGlb', () => {
  it('escreve um GLB legível com NORMAL e índices, e devolve bbox/centro antes da quantização', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'glb-'));
    const saida = join(dir, 'cubo.glb');
    const st = await escreverGlb(cubo(), saida, { razao: 1, nome: 'FMA0' });
    expect(existsSync(saida)).toBe(true);
    expect(st.bytes).toBe(statSync(saida).size);
    expect(st.triangulosAntes).toBe(12);
    expect(st.triangulosDepois).toBeGreaterThan(0);
    expect(st.bbox.min.map((v) => +v.toFixed(3))).toEqual([1.5, 2.5, 3.5]);
    expect(st.bbox.max.map((v) => +v.toFixed(3))).toEqual([2.5, 3.5, 4.5]);
    expect(st.centro.map((v) => +v.toFixed(3))).toEqual([2, 3, 4]);

    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const doc = await io.read(saida);
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    expect(prim.getAttribute('NORMAL')).not.toBeNull();
    expect(prim.getIndices()).not.toBeNull();
    expect(doc.getRoot().listMeshes()[0].getName()).toBe('FMA0');
  });

  it('rejeita geometria vazia', async () => {
    await expect(escreverGlb({ posicoes: [], indices: [] }, '/tmp/x.glb', { razao: 1, nome: 'X' })).rejects.toThrow(/vazia/);
  });

  it('inflar desloca cada vértice ao longo da sua normal (cubo cresce 2 mm por lado)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'glb-'));
    const semInflar = await escreverGlb(cubo(), join(dir, 'a.glb'), { razao: 1, nome: 'A' });
    const inflado = await escreverGlb(cubo(), join(dir, 'b.glb'), { razao: 1, nome: 'B', inflarM: 0.002 });
    // bbox do manifesto é da geometria de entrada (antes de inflar): igual nos dois
    expect(inflado.bbox).toEqual(semInflar.bbox);
    // mas a geometria gravada é maior: lê de volta e mede a extensão em x
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const extensao = async (f: string) => {
      const doc = await io.read(f); const p = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION')!;
      const no = doc.getRoot().listNodes()[0]; const esc = no.getScale()[0];   // quantização: escala no nó
      return (p.getMax([])[0] - p.getMin([])[0]) * esc;
    };
    expect(await extensao(join(dir, 'b.glb'))).toBeGreaterThan((await extensao(join(dir, 'a.glb'))) + 0.003);  // +2 mm de cada lado ≈ +4 mm (tolerância)
  });
});
