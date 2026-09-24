import { mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { ALCANCE_CONFINAR_M, ERRO_SIMPLIFICACAO, FOLGA_CONFINAR_M } from './constantes';
import { normaisSuaves } from './normais';
import { confinarDentro, type Envelope } from './confinar';
import { inflarSemDobrar } from './inflar';
import { oclusaoPorVertice } from './oclusao';
import type { Geometria } from './obj';

export interface Bbox { min: [number, number, number]; max: [number, number, number]; }
export interface EstatisticasGlb {
  bytes: number; triangulosAntes: number; triangulosDepois: number; bbox: Bbox; centro: [number, number, number];
  /** Geometria float final (após inflar), para servir de envelope a outras peças. Só quando pedida. */
  geometriaFinal?: Envelope;
  /** Vértices empurrados para dentro do envelope. */
  confinados?: number;
  /** Vértices que inflaram menos que a distância cheia por causa de uma dobra (spec pele-realismo §3). */
  reduzidosInflar?: number;
  /** Só com `oclusao: true`. */
  segundosOclusao?: number;
  oclusaoMedia?: number;
}

let io: NodeIO | undefined;
async function getIo(): Promise<NodeIO> {
  await MeshoptSimplifier.ready; await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  io ??= new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  return io;
}

export function bboxDe(pos: ArrayLike<number>): Bbox {
  if (pos.length < 3) throw new Error('bboxDe: sem posições');
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
    if (pos[i + k] < min[k]) min[k] = pos[i + k];
    if (pos[i + k] > max[k]) max[k] = pos[i + k];
  }
  return { min, max };
}

/**
 * weld → simplify (meshoptimizer) → normais suaves próprias → prune → meshopt (quantiza e
 * comprime). bbox/centro vêm da geometria float, antes da quantização.
 */
export async function escreverGlb(g: Geometria, saida: string, op: { razao: number; nome: string; inflarM?: number; confinarEm?: Envelope; devolverGeometria?: boolean; oclusao?: boolean }): Promise<EstatisticasGlb> {
  if (g.posicoes.length === 0 || g.indices.length === 0) throw new Error(`geometria vazia para ${op.nome}`);
  const bbox = bboxDe(g.posicoes);
  const centro: [number, number, number] = [0, 1, 2].map((k) => (bbox.min[k] + bbox.max[k]) / 2) as [number, number, number];

  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.posicoes)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.indices)).setBuffer(buffer));
  doc.createScene().addChild(doc.createNode(op.nome).setMesh(doc.createMesh(op.nome).addPrimitive(prim)));

  const nodeIo = await getIo();
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: op.razao, error: ERRO_SIMPLIFICACAO }));
  const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const posAcc = p.getAttribute('POSITION');
  const pos = posAcc?.getArray();
  const idx = p.getIndices()?.getArray();
  if (!posAcc || !pos || !idx || idx.length === 0) throw new Error(`simplify não deixou geometria indexada para ${op.nome}`);
  // normais de partida (da malha simplificada) só servem de direção para inflar
  const n0 = normaisSuaves(pos, idx);
  let final = new Float32Array(pos);
  let reduzidosInflar: number | undefined;
  if (op.inflarM) {
    const r = inflarSemDobrar(pos, idx, n0, op.inflarM);
    final = r.pos; reduzidosInflar = r.reduzidos;
  }
  let confinados: number | undefined;
  if (op.confinarEm) confinados = confinarDentro(final, op.confinarEm, { folgaM: FOLGA_CONFINAR_M, alcanceM: ALCANCE_CONFINAR_M });
  if (op.inflarM || op.confinarEm) posAcc.setArray(final);
  // normais GRAVADAS = as da geometria gravada (spec pele-realismo §3): impossível ficarem de costas para a face
  const n = normaisSuaves(final, idx);
  p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(n).setBuffer(buffer));
  let segundosOclusao: number | undefined, oclusaoMedia: number | undefined;
  if (op.oclusao) {
    const t0 = performance.now();
    const o = oclusaoPorVertice(final, new Uint32Array(idx), n);
    segundosOclusao = (performance.now() - t0) / 1000;
    oclusaoMedia = o.reduce((a, v) => a + v, 0) / o.length;
    // Uint8 normalizado: 0 = livre, 255 = totalmente ocluído; atributo ausente lê 0 no shader
    const bytes = Uint8Array.from(o, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
    p.setAttribute('_OCLUSAO', doc.createAccessor().setType('SCALAR').setArray(bytes).setNormalized(true).setBuffer(buffer));
  }
  const triangulosDepois = idx.length / 3;
  const geometriaFinal = op.devolverGeometria ? { pos: new Float32Array(final), idx: new Uint32Array(idx) } : undefined;
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder }));

  mkdirSync(dirname(saida), { recursive: true });
  await nodeIo.write(saida, doc);
  return { bytes: statSync(saida).size, triangulosAntes: g.indices.length / 3, triangulosDepois, bbox, centro, geometriaFinal, confinados, reduzidosInflar, segundosOclusao, oclusaoMedia };
}

/**
 * Lê uma GLB do pipeline de volta: posições (nas unidades quantizadas do nó — a escala é uniforme e
 * positiva, então direções e sinais de produto vetorial são os do mundo), normais e `_OCLUSAO`
 * (desnormalizados para float) e os índices.
 */
export async function lerGlb(caminho: string): Promise<{ pos: Float32Array; idx: Uint32Array; normais: Float32Array; oclusao: Float32Array | null }> {
  const doc = await (await getIo()).read(caminho);
  const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const ler = (nome: string): Float32Array | null => {
    const a = p.getAttribute(nome);
    if (!a) return null;
    const tam = a.getElementSize(), out = new Float32Array(a.getCount() * tam), e: number[] = [];
    for (let i = 0; i < a.getCount(); i++) { a.getElement(i, e); for (let k = 0; k < tam; k++) out[i * tam + k] = e[k]; }
    return out;
  };
  const pos = ler('POSITION'), normais = ler('NORMAL'), idx = p.getIndices()?.getArray();
  if (!pos || !normais || !idx) throw new Error(`${caminho}: GLB sem POSITION, NORMAL ou índices`);
  return { pos, idx: new Uint32Array(idx), normais, oclusao: ler('_OCLUSAO') };
}
