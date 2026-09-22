/** Literal GLSL de um número: ponto decimal garantido (`1` viraria int; `toFixed` evita notação científica). */
export const literalGlsl = (n: number): string => n.toFixed(4);
