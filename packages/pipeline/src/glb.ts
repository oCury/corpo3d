import { mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { ERRO_SIMPLIFICACAO } from './constantes';
import { normaisSuaves } from './normais';
import type { Geometria } from './obj';

export interface Bbox { min: [number, number, number]; max: [number, number, number]; }
export interface EstatisticasGlb {
  bytes: number; triangulosAntes: number; triangulosDepois: number; bbox: Bbox; centro: [number, number, number];
}

let io: NodeIO | undefined;
async function getIo(): Promise<NodeIO> {
  await MeshoptSimplifier.ready; await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  io ??= new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  return io;
}

export function bboxDe(pos: ArrayLike<number>): Bbox {
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
export async function escreverGlb(g: Geometria, saida: string, op: { razao: number; nome: string }): Promise<EstatisticasGlb> {
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
  const pos = p.getAttribute('POSITION')!.getArray()!;
  const idx = p.getIndices()!.getArray()!;
  p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normaisSuaves(pos, idx)).setBuffer(buffer));
  const triangulosDepois = idx.length / 3;
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder }));

  mkdirSync(dirname(saida), { recursive: true });
  await nodeIo.write(saida, doc);
  return { bytes: statSync(saida).size, triangulosAntes: g.indices.length / 3, triangulosDepois, bbox, centro };
}
