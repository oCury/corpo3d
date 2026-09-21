import type { Lado, Sistema } from './catalogo';
import type { Bbox } from './glb';

export interface PecaManifesto {
  fmaId: string; nomeLatim: string; nomePt: string; nomeLeigo: string; sistema: Sistema; lado: Lado;
  glb: string; bytes: number; triangulos: number; elementos: number;
  bbox: Bbox; centro: [number, number, number]; vetorExplosao: [number, number, number];
}
export interface Manifesto {
  versao: 1; geradoEm: string; fonte: string; bytesTotal: number;
  sistemas: Sistema[]; pecas: PecaManifesto[];
}

/** Peso do deslocamento na vista explodida, por sistema (spec §4.1). */
export const PESO_EXPLOSAO: Record<Sistema, number> = {
  pele: 1.4, esqueleto: 0.6, musculos: 1.2, cardiovascular: 1.0, respiratorio: 1.0, digestivo: 1.0,
  linfatico: 1.0, urinario: 1.0, reprodutor: 1.0, endocrino: 1.0, nervoso: 0.8, olho: 1.0,
};

/**
 * Vetor do eixo vertical do corpo (x=0, z=0) até o centro da peça, no plano horizontal,
 * normalizado e multiplicado pelo peso do sistema. Peça sobre o eixo sai para a frente (+z).
 */
export function vetorExplosaoPadrao(centro: [number, number, number], sistema: Sistema): [number, number, number] {
  const [x, , z] = centro;
  const len = Math.hypot(x, z);
  const peso = PESO_EXPLOSAO[sistema];
  if (len < 1e-6) return [0, 0, peso];
  return [(x / len) * peso, 0, (z / len) * peso];
}

export const FONTE = 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International';
