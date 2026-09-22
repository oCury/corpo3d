import type { Vec3 } from '@/lib/estado/store';

/**
 * Marcos da cabeça do BodyParts3D (um único corpo, 2013), em metros nos eixos do three
 * (+y cima, +z frente, +x esquerda do paciente). Medidos no manifesto em 2026-09-22;
 * `pelos.test.ts` falha se o manifesto se afastar deles.
 */
export const MARCOS = {
  /** Centro do globo ocular esquerdo (`FMA12515`). O direito é o espelho em x. */
  olhoEsquerdo: [0.0291, 1.5181, 0.1524] as Vec3,
  /** Centro do crânio (`FMA46565`), x arredondado para o plano mediano. */
  centroCabeca: [0, 1.53, 0.085] as Vec3,
  /** `bbox.max.y` da pele. */
  topoPele: 1.641,
} as const;

const Y_OLHO = MARCOS.olhoEsquerdo[1];

/** Todas as constantes de forma e intensidade. Ajuste visual = mudar aqui. */
export const AJUSTE = {
  couro: {
    /** Abaixo disto nem avalia (o corpo inteiro não paga o custo). */
    yMinimo: 1.4,
    /** Altura da linha do cabelo por região, interpolada pelo ângulo ao redor da cabeça. */
    testa: Y_OLHO + 0.07,
    tempora: Y_OLHO + 0.03,
    nuca: Y_OLHO - 0.038,
    /** Meia-largura da transição (m) e amplitude do ruído que desalinha a borda (m). */
    bordaM: 0.006,
    ruidoBordaM: 0.012,
    freqRuidoBorda: 90,
    /** Pontilhado de ~1 mm que dá o aspecto raspado. */
    freqPontilhado: 1000,
    forcaBump: 0.25,
    mistura: 0.85,
    rugosidade: 0.85,
  },
  sobrancelha: {
    /** Centro = olho + deslocamento; raios do elipsoide; ponta externa mais alta. */
    deslocamento: [0, 0.022, 0.022] as Vec3,
    raios: [0.026, 0.006, 0.02] as Vec3,
    inclinacaoRad: (8 * Math.PI) / 180,
    /** Fios deitados: frequência alta só em y. */
    freqFiosLateral: 90,
    freqFiosVertical: 1600,
    mistura: 0.9,
    forcaBump: 0.3,
  },
  corpo: {
    peito: { y0: 1.15, y1: 1.36, zMin: 0.1, xMax: 0.14 },
    antebracos: { y0: 0.8, y1: 1.05, xMin: 0.2 },
    pernas: { y0: 0.08, y1: 0.4 },
    bordaM: 0.02,
    freqDensidade: 40,
    freqPontilhado: 900,
    limiarPontilhado: 0.72,
    escurecimento: 0.1,
    rugosidadeExtra: 0.1,
  },
  /** Castanho escuro dos pelos (sRGB). */
  cor: '#3a2a20',
} as const;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Altura-limite da linha do cabelo no ponto (x, z): alta na testa, média nas têmporas,
 * baixa na nuca. Ângulo medido no plano xz a partir de +z (frente) ao redor do centro da cabeça.
 */
export function alturaLinhaDoCabelo(x: number, z: number): number {
  const [cx, , cz] = MARCOS.centroCabeca;
  const dx = x - cx, dz = z - cz;
  const r = Math.hypot(dx, dz);
  const c = r < 1e-6 ? 0 : dz / r;
  const { testa, tempora, nuca } = AJUSTE.couro;
  return tempora + smoothstep(0, 1, Math.max(c, 0)) * (testa - tempora) + smoothstep(0, 1, Math.max(-c, 0)) * (nuca - tempora);
}

/** Couro cabeludo: 1 acima da linha do cabelo, 0 abaixo, transição de ±bordaM. Sem ruído (o ruído é só do shader). */
export function mascaraCouroCabeludo([x, y, z]: Vec3): number {
  if (y < AJUSTE.couro.yMinimo) return 0;
  const lim = alturaLinhaDoCabelo(x, z);
  const b = AJUSTE.couro.bordaM;
  return smoothstep(lim - b, lim + b, y);
}

/** Um elipsoide inclinado por olho; `lado` +1 = esquerdo do paciente (+x), −1 = direito. */
function umaSobrancelha([x, y, z]: Vec3, lado: 1 | -1): number {
  const [ox, oy, oz] = MARCOS.olhoEsquerdo;
  const [dx, dy, dz] = AJUSTE.sobrancelha.deslocamento;
  const lx0 = x - (lado * ox + dx), ly0 = y - (oy + dy), lz = z - (oz + dz);
  // gira o ponto para o espaço local da sobrancelha (ponta externa, de maior |x|, mais alta)
  const ang = lado * AJUSTE.sobrancelha.inclinacaoRad;
  const lx = Math.cos(ang) * lx0 + Math.sin(ang) * ly0;
  const ly = -Math.sin(ang) * lx0 + Math.cos(ang) * ly0;
  const [rx, ry, rz] = AJUSTE.sobrancelha.raios;
  const d = Math.sqrt((lx / rx) ** 2 + (ly / ry) ** 2 + (lz / rz) ** 2);
  return 1 - smoothstep(0.8, 1.0, d);
}

/** Sobrancelhas: máximo das duas. */
export function mascaraSobrancelha(p: Vec3): number {
  if (p[1] < AJUSTE.couro.yMinimo) return 0;
  return Math.max(umaSobrancelha(p, 1), umaSobrancelha(p, -1));
}

/** Faixa [a, b] com bordas suaves de ±borda. */
function faixa(a: number, b: number, borda: number, v: number): number {
  return smoothstep(a - borda, a + borda, v) * (1 - smoothstep(b - borda, b + borda, v));
}

/** Sugestão de pelos: peito (frente), antebraços (braços ao lado do corpo) e pernas abaixo do joelho. Sem ruído. */
export function mascaraPelosCorpo([x, y, z]: Vec3): number {
  const { peito, antebracos, pernas, bordaM: b } = AJUSTE.corpo;
  const ax = Math.abs(x);
  const mPeito = faixa(peito.y0, peito.y1, b, y) * smoothstep(peito.zMin - b, peito.zMin + b, z) * (1 - smoothstep(peito.xMax - b, peito.xMax + b, ax));
  const mAntebracos = faixa(antebracos.y0, antebracos.y1, b, y) * smoothstep(antebracos.xMin - b, antebracos.xMin + b, ax);
  const mPernas = faixa(pernas.y0, pernas.y1, b, y);
  return Math.max(mPeito, mAntebracos, mPernas);
}
