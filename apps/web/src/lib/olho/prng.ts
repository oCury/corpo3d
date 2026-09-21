/**
 * mulberry32: gerador determinístico, rápido, suficiente para textura procedural.
 *
 * As texturas do olho vêm do Olho3D, onde eram pintadas com `Math.random()`. Aqui o
 * desenho precisa ser reprodutível — dois olhos com a mesma semente são idênticos e
 * uma captura de tela de teste não muda entre execuções.
 */
export function criarPrng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
