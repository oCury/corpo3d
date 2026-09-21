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
  const f = [0,1,3, 0,3,2, 4,6,7, 4,7,5, 0,4,5, 0,5,1, 2,3,7, 2,7,6, 0,2,6, 0,6,4, 1,5,7, 1,7,3];
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
});
