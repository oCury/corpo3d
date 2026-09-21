import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseObj, Geometria, novaGeometria } from '../src/obj';

const fx = (n: string) => readFileSync(join(__dirname, 'fixtures', n), 'utf8');

describe('obj', () => {
  it('converte mm Z-up para m Y-up: (x,y,z) → (x/1000, z/1000, -y/1000)', () => {
    const g = novaGeometria();
    parseObj(fx('tri.obj'), g);
    expect(Array.from(g.posicoes)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);   // v3 (0,0,1000) → (0,1,0)
    expect(Array.from(g.indices)).toEqual([0, 1, 2]);
  });

  it('triangula quads em leque', () => {
    const g = novaGeometria();
    parseObj(fx('quad.obj'), g);
    expect(Array.from(g.indices)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('faz merge com deslocamento de índices', () => {
    const g = novaGeometria();
    parseObj(fx('tri.obj'), g);
    parseObj(fx('tri.obj'), g);
    expect(g.posicoes.length).toBe(18);
    expect(Array.from(g.indices)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('ignora vn, vt e comentários; preserva o sinal de y', () => {
    const g = novaGeometria();
    parseObj('v 10 -20 30\nvt 0 0\nvn 0 0 1\n# x\nf 1 1 1\n', g);
    expect(Array.from(g.posicoes)).toEqual([0.01, 0.03, 0.02]);
  });
});
