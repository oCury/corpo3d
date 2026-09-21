import { describe, it, expect } from 'vitest';
import { normaisSuaves } from '../src/normais';

describe('normaisSuaves', () => {
  it('triângulo no plano XY com ordem anti-horária aponta para +Z', () => {
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const n = normaisSuaves(pos, new Uint32Array([0, 1, 2]));
    for (let i = 0; i < 3; i++) expect([n[i * 3], n[i * 3 + 1], n[i * 3 + 2]]).toEqual([0, 0, 1]);
  });

  it('vértice compartilhado por duas faces perpendiculares recebe a média normalizada', () => {
    // face A no plano XY (normal +Z), face B (0,3,1) no plano XZ (normal +Y); vértices 0 e 1 são comuns
    const pos = new Float32Array([0, 0, 0,  1, 0, 0,  0, 1, 0,  0, 0, 1]);
    const n = normaisSuaves(pos, new Uint32Array([0, 1, 2,  0, 3, 1]));
    const s = Math.SQRT1_2;
    expect(n[0]).toBeCloseTo(0); expect(n[1]).toBeCloseTo(s); expect(n[2]).toBeCloseTo(s);
    expect(n[6]).toBeCloseTo(0); expect(n[7]).toBeCloseTo(0); expect(n[8]).toBeCloseTo(1);   // vértice 2 só na face A
  });

  it('vértice sem face fica com normal zero (não NaN)', () => {
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 5]);
    const n = normaisSuaves(pos, new Uint32Array([0, 1, 2]));
    expect([n[9], n[10], n[11]]).toEqual([0, 0, 0]);
  });
});
