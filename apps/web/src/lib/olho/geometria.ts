// Portado do Olho3D (mesmo autor), 2026-09-21 — `src/lib/eye-geometry.ts`.
// Só as quatro superfícies que o Corpo3D mostra: esclera, córnea, íris e cristalino.
// Ficaram de fora retina, coroide, nervo óptico, corpo ciliar, zônulas, músculos
// extraoculares e as deformações de ceratocone/toricidade — nada disso aparece num
// olho de 12,5 mm visto de fora.
import {
  LatheGeometry,
  MathUtils,
  RingGeometry,
  SphereGeometry,
  Vector2,
  type BufferAttribute,
} from 'three';

/**
 * Proporções de referência (olho adulto):
 *   comprimento axial ≈ 24 mm → normalizado para raio 1,0
 *   raio corneano anterior ≈ 7,8 mm
 *   cristalino: espessura ≈ 4,0 mm, diâmetro ≈ 9,5 mm
 * Todas as geometrias ficam centradas na origem com o eixo visual em +Z.
 */
const SEG = 64;

/**
 * Esclera — esfera com uma abertura circular no polo (+Y) onde a córnea se encaixa.
 * Precisa ser girada em +π/2 em X para a abertura olhar para +Z (eixo visual).
 * Na esfera unitária a borda da abertura fica em raio sin(0,62) ≈ 0,58.
 */
export function geometriaEsclera(raio = 1.0, anguloAbertura = 0.62, segmentos = SEG): SphereGeometry {
  const geo = new SphereGeometry(
    raio,
    segmentos,
    Math.floor(segmentos / 2),
    0,
    Math.PI * 2,
    anguloAbertura,
    Math.PI - anguloAbertura,
  );
  geo.computeVertexNormals();
  return geo;
}

/**
 * Cristalino biconvexo por revolução. As duas faces são arcos de círculo que se
 * encontram no equador (y local = 0): polo posterior em −sagP, anterior em +sagA.
 * O wrapper gira +π/2 em X para o polo anterior olhar para +Z.
 */
export function geometriaCristalino(
  raioAnterior = 0.75,
  raioPosterior = 0.48,
  semiDiametro = 0.4,
): LatheGeometry {
  const passos = 28;
  const pontos: Vector2[] = [];

  // Face posterior: polo (0, −sagP) → equador (semiDiametro, 0)
  const alfaMax = Math.asin(Math.min(semiDiametro / raioPosterior, 1));
  const sagP = raioPosterior * (1 - Math.cos(alfaMax));
  for (let i = 0; i <= passos; i++) {
    const a = (i / passos) * alfaMax;
    pontos.push(new Vector2(raioPosterior * Math.sin(a), -sagP + raioPosterior * (1 - Math.cos(a))));
  }

  // Face anterior: equador (semiDiametro, 0) → polo (0, +sagA)
  const betaMax = Math.asin(Math.min(semiDiametro / raioAnterior, 1));
  const sagA = raioAnterior * (1 - Math.cos(betaMax));
  for (let i = passos; i >= 0; i--) {
    const b = (i / passos) * betaMax;
    pontos.push(new Vector2(raioAnterior * Math.sin(b), sagA - raioAnterior * (1 - Math.cos(b))));
  }

  const geo = new LatheGeometry(pontos, SEG);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Diafragma da íris — anel cuja borda interna É a abertura pupilar. Cone truncado raso:
 * a margem pupilar fica um pouco à frente da raiz (o cristalino empurra o centro).
 * As UVs planares do `RingGeometry` são preservadas para a textura radial casar 1:1.
 */
export function geometriaIris(raioPupila = 0.15, raioExterno = 0.58, protrusao = 0.045): RingGeometry {
  const interno = MathUtils.clamp(raioPupila, 0.04, raioExterno - 0.04);
  const geo = new RingGeometry(interno, raioExterno, 96, 12);
  const pos = geo.attributes.position as BufferAttribute;
  const v = new Vector2();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i));
    const t = MathUtils.clamp((raioExterno - v.length()) / (raioExterno - interno), 0, 1);
    pos.setZ(i, Math.sin((t * Math.PI) / 2) * protrusao);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Córnea — calota esférica que cobre a abertura da esclera, com curvatura maior que ela
 * (é essa diferença que faz a saliência corneana). Raio 0,7 e extensão 1,0 → círculo de
 * base ≈ 0,588, que casa com a abertura da esclera (sin(0,62) ≈ 0,58).
 */
export function geometriaCornea(raio = 0.7, extensaoAngular = 1.0, segmentos = SEG): SphereGeometry {
  return new SphereGeometry(raio, segmentos, segmentos / 2, 0, Math.PI * 2, 0, extensaoAngular);
}
