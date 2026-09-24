import { describe, it, expect } from 'vitest';
import { direcoesHemisferio, oclusaoPorVertice } from '../src/oclusao';
import { normaisSuaves } from '../src/normais';

/** Placa 0,3 × 0,1 m no plano xz (normal +y), 31 × 11 vértices; opcionalmente uma parede em x = 0,3 (0,15 m de altura). */
function placa(comParede: boolean): { pos: Float32Array; idx: Uint32Array } {
  const pos: number[] = [], idx: number[] = [];
  const grade = (nx: number, nz: number, ponto: (i: number, j: number) => [number, number, number]) => {
    const base = pos.length / 3;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) pos.push(...ponto(i, j));
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) {
      const a = base + i * nz + j, b = a + 1, c = a + nz, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  };
  grade(31, 11, (i, j) => [i * 0.01, 0, j * 0.01]);                       // placa: x 0..0,3, z 0..0,1
  if (comParede) grade(16, 11, (i, j) => [0.3, i * 0.01, j * 0.01]);       // parede: y 0..0,15 em x = 0,3
  const p = new Float32Array(pos), x = new Uint32Array(idx);
  const n = normaisSuaves(p, x);
  if (n[1] < 0) for (let t = 0; t < x.length; t += 3) { const tmp = x[t + 1]; x[t + 1] = x[t + 2]; x[t + 2] = tmp; } // placa com normal +y
  return { pos: p, idx: x };
}

describe('direcoesHemisferio', () => {
  it('n direções unitárias no hemisfério z > 0, com mais amostras perto do zênite (peso de cosseno)', () => {
    const d = direcoesHemisferio(48);
    expect(d.length).toBe(48 * 3);
    let zMedio = 0;
    for (let k = 0; k < 48; k++) {
      expect(Math.hypot(d[k * 3], d[k * 3 + 1], d[k * 3 + 2])).toBeCloseTo(1, 5);
      expect(d[k * 3 + 2]).toBeGreaterThan(0);
      zMedio += d[k * 3 + 2];
    }
    expect(zMedio / 48).toBeGreaterThan(0.6); // uniforme daria 0,5; cosseno dá 2/3
  });
});

describe('oclusaoPorVertice', () => {
  it('placa isolada: oclusão ≈ 0 em todo vértice', () => {
    const { pos, idx } = placa(false);
    const o = oclusaoPorVertice(pos, idx, normaisSuaves(pos, idx));
    expect(o.length).toBe(pos.length / 3);
    for (const v of o) expect(v).toBeLessThan(0.01);
  });
  it('placa com parede: perto da parede > 0,2; longe (x ≤ 0,05) < 0,05; determinístico', () => {
    const { pos, idx } = placa(true);
    const n = normaisSuaves(pos, idx);
    const o = oclusaoPorVertice(pos, idx, n);
    const na = (x: number, z: number) => o[Math.round(x / 0.01) * 11 + Math.round(z / 0.01)];
    expect(na(0.29, 0.05)).toBeGreaterThan(0.2);
    expect(na(0.0, 0.05)).toBeLessThan(0.05);
    expect(na(0.05, 0.05)).toBeLessThan(0.05);
    expect(oclusaoPorVertice(pos, idx, n)).toEqual(o);
  });
});
