import { describe, it, expect } from 'vitest';
import { SphereGeometry } from 'three';
import { confinarDentro, type Envelope } from '../src/confinar';

/** Envelope: esfera de raio 0,1 m centrada na origem (fechada, normais para fora). */
function esfera(): Envelope {
  const g = new SphereGeometry(0.1, 48, 32);
  return { pos: g.getAttribute('position').array as Float32Array, idx: new Uint32Array(g.getIndex()!.array) };
}

describe('confinarDentro', () => {
  it('vértice fora do envelope vai para folga mm dentro da superfície; vértice dentro não se move', () => {
    const pos = new Float32Array([0.12, 0, 0,   0.05, 0, 0,   0, 0.098, 0]);   // fora | bem dentro | quase na superfície
    const movidos = confinarDentro(pos, esfera(), { folgaM: 0.002, alcanceM: 0.05 });
    expect(movidos).toBe(2);
    expect(Math.hypot(pos[0], pos[1], pos[2])).toBeCloseTo(0.098, 3);      // 0,1 − 0,002
    expect(pos[3]).toBeCloseTo(0.05, 6); expect(pos[4]).toBe(0); expect(pos[5]).toBe(0);
    expect(Math.hypot(pos[6], pos[7], pos[8])).toBeCloseTo(0.098, 3);      // já estava a 2 mm: fica em 2 mm
  });
  it('vértice muito longe do envelope (além do alcance) é ignorado', () => {
    const pos = new Float32Array([0.5, 0, 0]);
    expect(confinarDentro(pos, esfera(), { folgaM: 0.001, alcanceM: 0.05 })).toBe(0);
    expect(pos[0]).toBe(0.5);
  });
});
