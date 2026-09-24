import { describe, it, expect } from 'vitest';
import { PlaneGeometry, SphereGeometry } from 'three';
import { inflarSemDobrar, verticesDobrados, vizinhos } from '../src/inflar';
import { normaisSuaves } from '../src/normais';

const deThree = (g: PlaneGeometry | SphereGeometry) => ({ pos: new Float32Array(g.getAttribute('position').array), idx: new Uint32Array(g.getIndex()!.array) });

/**
 * Calha em V ao longo de x: perfil (y, z) com o fundo em (0, 0) e as bordas em (0,01; ±0,002),
 * 4 degraus por lado → abertura de 4 mm no topo e 10 mm de fundo. Orientada com as normais
 * apontando para dentro da calha (para cima): inflar 3,5 mm de cada lado cruza as paredes.
 */
function calhaEmV(): { pos: Float32Array; idx: Uint32Array } {
  const perfil: [number, number][] = [];
  for (let k = 4; k >= 1; k--) perfil.push([k * 0.0025, -k * 0.0005]);
  perfil.push([0, 0]);
  for (let k = 1; k <= 4; k++) perfil.push([k * 0.0025, k * 0.0005]);
  const nx = 9, passo = 0.0025, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < nx; i++) for (const [y, z] of perfil) pos.push(i * passo, y, z);
  const np = perfil.length;
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < np - 1; j++) {
    const a = i * np + j, b = a + 1, c = a + np, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const p = new Float32Array(pos), x = new Uint32Array(idx);
  const n = normaisSuaves(p, x);
  if (n[1] < 0) for (let t = 0; t < x.length; t += 3) { const tmp = x[t + 1]; x[t + 1] = x[t + 2]; x[t + 2] = tmp; } // normais para +y
  return { pos: p, idx: x };
}

describe('vizinhos e verticesDobrados', () => {
  it('vizinhos diretos por aresta; nada dobrado numa placa inflada', () => {
    const { pos, idx } = deThree(new PlaneGeometry(0.1, 0.1, 4, 4));
    const v = vizinhos(idx, pos.length / 3);
    expect(v[0].length).toBeGreaterThanOrEqual(2);
    expect(v[12].length).toBe(6); // vértice central de uma grade triangulada
    const n0 = normaisSuaves(pos, idx);
    const inflada = pos.map((x, i) => x + n0[i] * 0.0035);
    expect(verticesDobrados(inflada, idx, n0)).toEqual([]);
  });
  it('a calha em V inflada 3,5 mm sem recuo dobra', () => {
    const { pos, idx } = calhaEmV();
    const n0 = normaisSuaves(pos, idx);
    expect(n0.filter((_, i) => i % 3 === 1).every((y) => y > 0)).toBe(true);
    const inflada = pos.map((x, i) => x + n0[i] * 0.0035);
    expect(verticesDobrados(inflada, idx, n0).length).toBeGreaterThan(0);
  });
});

describe('inflarSemDobrar', () => {
  it('placa plana: todo vértice sobe 3,5 mm, nada reduzido', () => {
    const { pos, idx } = deThree(new PlaneGeometry(0.1, 0.1, 4, 4));
    const n0 = normaisSuaves(pos, idx);
    const r = inflarSemDobrar(pos, idx, n0, 0.0035);
    expect(r.reduzidos).toBe(0); expect(r.zerados).toBe(0);
    for (let v = 0; v < pos.length / 3; v++) expect(r.pos[v * 3 + 2] - pos[v * 3 + 2]).toBeCloseTo(0.0035, 6);
  });
  it('calha em V: zero dobrados no fim; o fundo anda menos que as bordas; houve redução', () => {
    const { pos, idx } = calhaEmV();
    const n0 = normaisSuaves(pos, idx);
    const r = inflarSemDobrar(pos, idx, n0, 0.0035);
    expect(verticesDobrados(r.pos, idx, n0)).toEqual([]);
    expect(r.reduzidos).toBeGreaterThan(0);
    const desloc = (v: number) => Math.hypot(r.pos[v * 3] - pos[v * 3], r.pos[v * 3 + 1] - pos[v * 3 + 1], r.pos[v * 3 + 2] - pos[v * 3 + 2]);
    const np = 9, meio = 4 * np + 4, borda = 4 * np; // linha central (i = 4): fundo da calha (j = 4) e a borda de cima (j = 0)
    expect(desloc(meio)).toBeLessThan(desloc(borda));
    expect(desloc(borda)).toBeCloseTo(0.0035, 4);
  });
  it('distância zero ou malha sem faces devolve as posições intactas', () => {
    const { pos, idx } = deThree(new PlaneGeometry(0.1, 0.1, 1, 1));
    const n0 = normaisSuaves(pos, idx);
    expect(inflarSemDobrar(pos, idx, n0, 0).pos).toEqual(new Float32Array(pos));
    expect(inflarSemDobrar(pos, new Uint32Array(0), n0, 0.01).pos).toEqual(new Float32Array(pos));
  });
  it('esfera inflada: normais recalculadas da geometria final apontam para fora', () => {
    const { pos, idx } = deThree(new SphereGeometry(0.05, 24, 16));
    const n0 = normaisSuaves(pos, idx);
    const r = inflarSemDobrar(pos, idx, n0, 0.0035);
    const n = normaisSuaves(r.pos, idx);
    for (let v = 0; v < pos.length / 3; v++) {
      if (n0[v * 3] === 0 && n0[v * 3 + 1] === 0 && n0[v * 3 + 2] === 0) continue; // vértice órfão (sem face): normaisSuaves o deixa (0,0,0) e ele não é deslocado
      const l = Math.hypot(r.pos[v * 3], r.pos[v * 3 + 1], r.pos[v * 3 + 2]);
      const dot = (n[v * 3] * r.pos[v * 3] + n[v * 3 + 1] * r.pos[v * 3 + 1] + n[v * 3 + 2] * r.pos[v * 3 + 2]) / l;
      expect(dot).toBeGreaterThan(0.99);
      expect(l).toBeCloseTo(0.0535, 3);
    }
  });
});
