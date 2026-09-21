import { describe, expect, it } from 'vitest';
import { criarPrng } from './prng';

/** Cinco números de uma semente. */
function cinco(semente: number): number[] {
  const rnd = criarPrng(semente);
  return [rnd(), rnd(), rnd(), rnd(), rnd()];
}

describe('criarPrng', () => {
  it('a mesma semente produz a mesma sequência', () => {
    expect(cinco(7)).toEqual(cinco(7));
  });

  it('sementes diferentes produzem sequências diferentes', () => {
    expect(cinco(7)).not.toEqual(cinco(8));
  });

  it('todos os valores caem em [0, 1)', () => {
    const rnd = criarPrng(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rnd();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
