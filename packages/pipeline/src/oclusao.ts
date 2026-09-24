import { BufferAttribute, BufferGeometry, DoubleSide, Ray, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { AFASTAMENTO_RAIO_M, ALCANCE_OCLUSAO_M, AMOSTRAS_OCLUSAO } from './constantes';

/**
 * `n` direções unitárias no hemisfério z > 0 com densidade de cosseno: pontos de uma espiral de
 * Fibonacci no disco unitário (raio = √u), projetados no hemisfério. Fixas, sem aleatório: a
 * construção é reprodutível byte a byte.
 */
export function direcoesHemisferio(n: number): Float32Array {
  const out = new Float32Array(n * 3);
  const dourado = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, r = Math.sqrt(u), phi = i * dourado;
    out[i * 3] = r * Math.cos(phi);
    out[i * 3 + 1] = r * Math.sin(phi);
    out[i * 3 + 2] = Math.sqrt(Math.max(0, 1 - u));
  }
  return out;
}

/**
 * Oclusão ambiente por vértice contra a própria malha: raios saindo `afastamentoM` acima do
 * vértice, no hemisfério da normal; um acerto a distância d pesa 1 − d/alcance. Devolve valores
 * em [0, 1]: 0 = livre, 1 = totalmente ocluído.
 */
export function oclusaoPorVertice(
  pos: Float32Array, idx: Uint32Array, normais: Float32Array,
  op: { amostras?: number; alcanceM?: number; afastamentoM?: number } = {},
): Float32Array {
  const amostras = op.amostras ?? AMOSTRAS_OCLUSAO, alcance = op.alcanceM ?? ALCANCE_OCLUSAO_M, afastamento = op.afastamentoM ?? AFASTAMENTO_RAIO_M;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setIndex(new BufferAttribute(idx, 1));
  const bvh = new MeshBVH(geo);
  const dirs = direcoesHemisferio(amostras);
  const nv = pos.length / 3, out = new Float32Array(nv);
  const ray = new Ray(), n = new Vector3(), t = new Vector3(), b = new Vector3(), aux = new Vector3();
  for (let v = 0; v < nv; v++) {
    n.fromArray(normais, v * 3);
    if (n.lengthSq() < 1e-12) continue; // vértice órfão: fica 0 (livre)
    aux.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0);
    t.crossVectors(aux, n).normalize();
    b.crossVectors(n, t);
    ray.origin.set(pos[v * 3] + n.x * afastamento, pos[v * 3 + 1] + n.y * afastamento, pos[v * 3 + 2] + n.z * afastamento);
    let soma = 0;
    for (let k = 0; k < amostras; k++) {
      const x = dirs[k * 3], y = dirs[k * 3 + 1], z = dirs[k * 3 + 2];
      ray.direction.set(t.x * x + b.x * y + n.x * z, t.y * x + b.y * y + n.y * z, t.z * x + b.z * y + n.z * z);
      const hit = bvh.raycastFirst(ray, DoubleSide, 0, alcance);
      if (hit) soma += 1 - hit.distance / alcance;
    }
    out[v] = soma / amostras;
  }
  geo.dispose();
  return out;
}
