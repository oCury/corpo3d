import { MM_PARA_M } from './constantes';

/** Geometria acumulada (vários OBJ podem ser concatenados na mesma instância). */
export interface Geometria { posicoes: number[]; indices: number[]; }
export const novaGeometria = (): Geometria => ({ posicoes: [], indices: [] });

/** Normaliza -0 para 0 (toEqual/Object.is distingue os dois). */
const semZeroNegativo = (n: number): number => (n === 0 ? 0 : n);

/**
 * Lê só `v` e `f`. Converte mm Z-up (BodyParts3D) para m Y-up (three.js):
 * (x, y, z) → (x·0,001, z·0,001, −y·0,001). Faces com n>3 vértices viram leque.
 * Índices OBJ começam em 1 e podem vir como `a`, `a/b`, `a//c` ou `a/b/c`.
 */
export function parseObj(texto: string, g: Geometria): void {
  const base = g.posicoes.length / 3;
  for (const linha of texto.split('\n')) {
    if (linha.startsWith('v ')) {
      const [, x, y, z] = linha.trim().split(/\s+/);
      g.posicoes.push(
        semZeroNegativo(+x * MM_PARA_M),
        semZeroNegativo(+z * MM_PARA_M),
        semZeroNegativo(-(+y) * MM_PARA_M),
      );
    } else if (linha.startsWith('f ')) {
      const v = linha.trim().split(/\s+/).slice(1).map((t) => {
        const indice = parseInt(t.split('/')[0], 10);
        if (!(indice >= 1)) throw new Error(`índice de face inválido "${t}" (só índices positivos absolutos são suportados)`);
        return base + indice - 1;
      });
      for (let i = 1; i + 1 < v.length; i++) g.indices.push(v[0], v[i], v[i + 1]);
    }
  }
}
