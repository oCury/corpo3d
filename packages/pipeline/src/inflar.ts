import { LIMIAR_DOBRA, MAX_REDUCOES_DOBRA } from './constantes';
import { normaisSuaves } from './normais';

/** Vizinhos diretos (1 anel) de cada vértice, pelas arestas dos triângulos. */
export function vizinhos(idx: ArrayLike<number>, nVertices: number): number[][] {
  const v: Set<number>[] = Array.from({ length: nVertices }, () => new Set<number>());
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    v[a].add(b); v[a].add(c); v[b].add(a); v[b].add(c); v[c].add(a); v[c].add(b);
  }
  return v.map((s) => [...s]);
}

/**
 * Vértices (com face) cuja normal média das faces em `pos` discorda da normal de partida `n0`
 * (`dot < limiar`, ou média nula): a superfície virou do avesso ali.
 */
export function verticesDobrados(pos: ArrayLike<number>, idx: ArrayLike<number>, n0: ArrayLike<number>, limiar = LIMIAR_DOBRA): number[] {
  const n = normaisSuaves(pos, idx);
  const temFace = new Uint8Array(pos.length / 3);
  for (let t = 0; t < idx.length; t++) temFace[idx[t]] = 1;
  const out: number[] = [];
  for (let v = 0; v < temFace.length; v++) {
    if (!temFace[v]) continue;
    const i = v * 3;
    if (n[i] * n0[i] + n[i + 1] * n0[i + 1] + n[i + 2] * n0[i + 2] < limiar) out.push(v);
  }
  return out;
}

export interface ResultadoInflar { pos: Float32Array; reduzidos: number; zerados: number }

/**
 * Desloca cada vértice `distM` ao longo de `n0`. Onde a superfície dobraria (dobras mais
 * estreitas que 2 × distM: entre os dedos, virilha, axilas), o deslocamento do vértice e dos
 * vizinhos diretos cai pela metade, até `maxReducoes` vezes; o que ainda dobrar vai a zero.
 * `reduzidos` = vértices que não andaram a distância cheia; `zerados` = os que não andaram nada.
 */
export function inflarSemDobrar(
  pos: ArrayLike<number>, idx: ArrayLike<number>, n0: ArrayLike<number>, distM: number,
  op: { limiar?: number; maxReducoes?: number } = {},
): ResultadoInflar {
  const limiar = op.limiar ?? LIMIAR_DOBRA, maxReducoes = op.maxReducoes ?? MAX_REDUCOES_DOBRA;
  const nv = pos.length / 3;
  const out = new Float32Array(pos);
  if (distM <= 0 || idx.length === 0) return { pos: out, reduzidos: 0, zerados: 0 };
  const desloc = new Float32Array(nv).fill(distM);
  const viz = vizinhos(idx, nv);
  const aplicar = () => {
    for (let v = 0; v < nv; v++) {
      const i = v * 3, d = desloc[v];
      out[i] = pos[i] + n0[i] * d; out[i + 1] = pos[i + 1] + n0[i + 1] * d; out[i + 2] = pos[i + 2] + n0[i + 2] * d;
    }
  };
  const comAnel = (lista: number[]) => { const s = new Set(lista); for (const v of lista) for (const w of viz[v]) s.add(w); return s; };
  const reduzidos = new Set<number>();
  aplicar();
  let dobrados = verticesDobrados(out, idx, n0, limiar);
  for (let k = 0; k < maxReducoes && dobrados.length; k++) {
    for (const v of comAnel(dobrados)) { desloc[v] *= 0.5; reduzidos.add(v); }
    aplicar();
    dobrados = verticesDobrados(out, idx, n0, limiar);
  }
  let zerados = 0;
  for (let k = 0; k <= maxReducoes && dobrados.length; k++) {
    for (const v of comAnel(dobrados)) { if (desloc[v] > 0) zerados++; desloc[v] = 0; reduzidos.add(v); }
    aplicar();
    dobrados = verticesDobrados(out, idx, n0, limiar);
  }
  return { pos: out, reduzidos: reduzidos.size, zerados };
}
