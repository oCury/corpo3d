import { MeshPhysicalMaterial, MeshBasicMaterial, Color, DoubleSide } from 'three';
import type { Sistema } from '../manifesto';

interface Receita {
  cor: string;
  roughness: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenColor?: string;
  transmission?: number;
  ior?: number;
  opacity?: number;
}

/** Uma receita por sistema. Cores em sRGB. Sem texturas: tudo procedural. */
export const RECEITAS: Record<Sistema, Receita> = {
  pele: { cor: '#d9a68b', roughness: 0.55, sheen: 0.4, sheenColor: '#f2c9b0' },
  esqueleto: { cor: '#e8dcc4', roughness: 0.75 },
  musculos: { cor: '#9b2f2f', roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.5 },
  cardiovascular: { cor: '#b3312e', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 },
  respiratorio: { cor: '#d98c8c', roughness: 0.6, clearcoat: 0.2 },
  digestivo: { cor: '#c4776b', roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.35 },
  linfatico: { cor: '#8b4a5c', roughness: 0.45, clearcoat: 0.4 },
  urinario: { cor: '#a65a4f', roughness: 0.4, clearcoat: 0.5 },
  reprodutor: { cor: '#c78f86', roughness: 0.5, clearcoat: 0.3 },
  endocrino: { cor: '#d9a066', roughness: 0.5, clearcoat: 0.3 },
  nervoso: { cor: '#e6cfc2', roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4 },
  olho: { cor: '#f0ece6', roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.1 },
};

/** Cor semântica para artérias x veias, sobrepondo a receita do sistema quando o nome diz. */
export function corPorNome(sistema: Sistema, nomeLatim: string): string {
  if (sistema !== 'cardiovascular') return RECEITAS[sistema].cor;
  if (/^(Vena|Venae)\b/.test(nomeLatim)) return '#3f5fa8';
  if (/^(Arteria|Truncus|Circulus|Aorta)\b/.test(nomeLatim)) return '#c4322d';
  return RECEITAS.cardiovascular.cor;
}

const cache = new Map<string, MeshPhysicalMaterial>();

export function materialPara(sistema: Sistema, nomeLatim: string): MeshPhysicalMaterial {
  const cor = corPorNome(sistema, nomeLatim);
  const chave = `${sistema}:${cor}`;
  const existente = cache.get(chave);
  if (existente) return existente;
  const r = RECEITAS[sistema];
  const m = new MeshPhysicalMaterial({
    color: new Color(cor),
    roughness: r.roughness,
    metalness: r.metalness ?? 0,
    clearcoat: r.clearcoat ?? 0,
    clearcoatRoughness: r.clearcoatRoughness ?? 0.3,
    sheen: r.sheen ?? 0,
    ...(r.sheenColor ? { sheenColor: new Color(r.sheenColor) } : {}),
    transmission: r.transmission ?? 0,
    ior: r.ior ?? 1.45,
    transparent: (r.opacity ?? 1) < 1,
    opacity: r.opacity ?? 1,
    side: DoubleSide,
  });
  cache.set(chave, m);
  return m;
}

let fantasma: MeshBasicMaterial | undefined;
/** Wireframe translúcido que marca a posição de casa de uma peça solta. Compartilhado. */
export function materialFantasma(): MeshBasicMaterial {
  fantasma ??= new MeshBasicMaterial({ color: new Color('#9ecbff'), wireframe: true, transparent: true, opacity: 0.25, depthWrite: false });
  return fantasma;
}
