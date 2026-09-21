import { BufferAttribute, BufferGeometry, Triangle, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';

/** Malha fechada (float, metros) usada como limite: normalmente a pele já inflada. */
export interface Envelope { pos: Float32Array; idx: Uint32Array; }

/**
 * Empurra para dentro do envelope os vértices que estão fora dele (ou a menos de `folgaM` da
 * superfície), colocando-os a `folgaM` metros para dentro, ao longo da normal da face mais
 * próxima. Vértices a mais de `alcanceM` do envelope não são tocados (evita puxar geometria
 * que está longe por natureza). Devolve quantos vértices foram movidos. Altera `pos` no lugar.
 */
export function confinarDentro(pos: Float32Array, envelope: Envelope, op: { folgaM: number; alcanceM: number }): number {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(envelope.pos, 3));
  geo.setIndex(new BufferAttribute(envelope.idx, 1));
  const bvh = new MeshBVH(geo);
  const p = new Vector3(), tri = new Triangle(), n = new Vector3(), d = new Vector3();
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  let movidos = 0;
  for (let i = 0; i < pos.length; i += 3) {
    p.set(pos[i], pos[i + 1], pos[i + 2]);
    const alvo = bvh.closestPointToPoint(p, undefined, 0, op.alcanceM);
    if (!alvo) continue;
    const f = alvo.faceIndex * 3;
    a.fromArray(envelope.pos, envelope.idx[f] * 3); b.fromArray(envelope.pos, envelope.idx[f + 1] * 3); c.fromArray(envelope.pos, envelope.idx[f + 2] * 3);
    tri.set(a, b, c); tri.getNormal(n);
    d.subVectors(p, alvo.point);
    const fora = d.dot(n) > -op.folgaM;          // fora, ou dentro por menos que a folga
    if (!fora) continue;
    p.copy(alvo.point).addScaledVector(n, -op.folgaM);
    pos[i] = p.x; pos[i + 1] = p.y; pos[i + 2] = p.z;
    movidos++;
  }
  geo.dispose();
  return movidos;
}
