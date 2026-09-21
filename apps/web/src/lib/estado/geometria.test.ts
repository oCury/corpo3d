import { describe, it, expect } from 'vitest';
import { Ray, Vector3 } from 'three';
import { posicaoAlvo, estaEmCasa, projetarNoPlanoDaCamera, PRESETS_CAMERA, enquadrar, RAIO_ENCAIXE, DESLOCAMENTO_MAXIMO } from './geometria';
import { ESTADO_INICIAL } from './schema';
import type { PecaManifesto } from '@/lib/manifesto';

const peca: PecaManifesto = {
  fmaId: 'FMA1', nomeLatim: 'Cor', nomePt: 'Coração', nomeLeigo: 'coração', sistema: 'cardiovascular', lado: '-',
  glb: 'cardiovascular/FMA1.glb', bytes: 1, triangulos: 1, elementos: 1,
  bbox: { min: [-0.05, 1.15, 0.0], max: [0.07, 1.27, 0.12] }, centro: [0.01, 1.21, 0.06], vetorExplosao: [0.6, 0, 0.8],
};

describe('posicaoAlvo', () => {
  it('em casa e sem explosão é a origem', () => {
    expect(posicaoAlvo(peca, ESTADO_INICIAL)).toEqual([0, 0, 0]);
  });
  it('explosão desloca ao longo do vetorExplosao até DESLOCAMENTO_MAXIMO', () => {
    const p = posicaoAlvo(peca, { ...ESTADO_INICIAL, explosao: 1 });
    expect(p[0]).toBeCloseTo(0.6 * DESLOCAMENTO_MAXIMO); expect(p[1]).toBe(0); expect(p[2]).toBeCloseTo(0.8 * DESLOCAMENTO_MAXIMO);
  });
  it('peça solta ignora a explosão e fica onde foi largada', () => {
    expect(posicaoAlvo(peca, { ...ESTADO_INICIAL, explosao: 1, soltas: [{ fmaId: 'FMA1', pos: [0.3, 0, 0.1] }] })).toEqual([0.3, 0, 0.1]);
  });
});

describe('estaEmCasa', () => {
  it('dentro do raio de encaixe é casa; fora não', () => {
    expect(estaEmCasa([0.02, 0, 0])).toBe(true);
    expect(estaEmCasa([RAIO_ENCAIXE + 0.001, 0, 0])).toBe(false);
  });
});

describe('projetarNoPlanoDaCamera', () => {
  it('devolve o ponto onde o raio cruza o plano paralelo à câmera que passa pelo ponto de referência', () => {
    const raio = new Ray(new Vector3(0, 0, 5), new Vector3(0.1, 0, -1).normalize());
    const direcaoCamera = new Vector3(0, 0, -1);     // câmera olha para -z
    const ref = new Vector3(0, 0, 0);
    const p = projetarNoPlanoDaCamera(raio, direcaoCamera, ref)!;
    expect(p.z).toBeCloseTo(0); expect(p.x).toBeCloseTo(0.5);
  });
  it('devolve null quando o raio é paralelo ao plano', () => {
    const raio = new Ray(new Vector3(0, 0, 5), new Vector3(1, 0, 0));
    expect(projetarNoPlanoDaCamera(raio, new Vector3(0, 0, -1), new Vector3())).toBeNull();
  });
});

describe('câmera', () => {
  it('presets: frente vê +z, esquerda do paciente está em +x', () => {
    expect(PRESETS_CAMERA.frente.pos[2]).toBeGreaterThan(0);
    expect(PRESETS_CAMERA.costas.pos[2]).toBeLessThan(0);
    expect(PRESETS_CAMERA.esquerda.pos[0]).toBeGreaterThan(0);
    expect(PRESETS_CAMERA.direita.pos[0]).toBeLessThan(0);
    expect(PRESETS_CAMERA.superior.pos[1]).toBeGreaterThan(2);
  });
  it('enquadrar mira o centro e afasta proporcional ao tamanho, com limites', () => {
    const q = enquadrar(peca);
    expect(q.alvo).toEqual(peca.centro);
    expect(q.pos[2]).toBeGreaterThan(peca.centro[2]);
    const dist = Math.hypot(q.pos[0] - q.alvo[0], q.pos[1] - q.alvo[1], q.pos[2] - q.alvo[2]);
    expect(dist).toBeGreaterThanOrEqual(0.3); expect(dist).toBeLessThanOrEqual(3);
  });
});
