import { Plane, Ray, Vector3 } from 'three';
import type { PecaManifesto } from '@/lib/manifesto';
import type { EstadoCena } from './schema';
import type { PresetCamera, Vec3 } from './store';

/** Deslocamento máximo da vista explodida, em metros, quando `explosao === 1` (spec §5). */
export const DESLOCAMENTO_MAXIMO = 0.4;
/** Raio, em metros, dentro do qual soltar a peça a devolve para casa (spec §5: 3 cm). */
export const RAIO_ENCAIXE = 0.03;
/** Distância em px que o ponteiro precisa andar para virar arrasto, e não clique. */
export const LIMIAR_ARRASTO_PX = 4;
export const DURACAO_ENCAIXE_MS = 250;

/** Posição do grupo da peça (casa = origem): solta → onde foi largada; senão, explosão. */
export function posicaoAlvo(peca: PecaManifesto, e: EstadoCena): Vec3 {
  const solta = e.soltas.find((s) => s.fmaId === peca.fmaId);
  if (solta) return solta.pos;
  const k = e.explosao * DESLOCAMENTO_MAXIMO;
  return [peca.vetorExplosao[0] * k, peca.vetorExplosao[1] * k, peca.vetorExplosao[2] * k];
}

export const estaEmCasa = (pos: Vec3): boolean => Math.hypot(pos[0], pos[1], pos[2]) <= RAIO_ENCAIXE;

/**
 * Ponto onde `raio` cruza o plano com normal `direcaoCamera` que passa por `referencia`
 * (o plano "paralelo à câmera" do spec). `null` se o raio for paralelo ao plano.
 */
export function projetarNoPlanoDaCamera(raio: Ray, direcaoCamera: Vector3, referencia: Vector3): Vector3 | null {
  const plano = new Plane().setFromNormalAndCoplanarPoint(direcaoCamera.clone().normalize(), referencia);
  return raio.intersectPlane(plano, new Vector3());
}

const ALVO_CORPO: Vec3 = [0, 0.85, 0];
export const PRESETS_CAMERA: Record<Exclude<PresetCamera, 'livre'>, { pos: Vec3; alvo: Vec3 }> = {
  frente: { pos: [0, 1.0, 2.6], alvo: ALVO_CORPO },
  costas: { pos: [0, 1.0, -2.6], alvo: ALVO_CORPO },
  esquerda: { pos: [2.6, 1.0, 0], alvo: ALVO_CORPO }, // +x = esquerda do paciente
  direita: { pos: [-2.6, 1.0, 0], alvo: ALVO_CORPO },
  superior: { pos: [0, 3.4, 0.01], alvo: ALVO_CORPO },
};

/** Câmera de frente para a peça, a uma distância proporcional ao seu tamanho (0,3–3 m). */
export function enquadrar(peca: PecaManifesto): { pos: Vec3; alvo: Vec3 } {
  const { min, max } = peca.bbox;
  const tamanho = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const dist = Math.min(3, Math.max(0.3, tamanho * 2.5));
  const [cx, cy, cz] = peca.centro;
  return { pos: [cx, cy, cz + dist], alvo: [cx, cy, cz] };
}
