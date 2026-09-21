export type Sistema =
  | 'pele'
  | 'esqueleto'
  | 'musculos'
  | 'cardiovascular'
  | 'respiratorio'
  | 'digestivo'
  | 'linfatico'
  | 'urinario'
  | 'reprodutor'
  | 'endocrino'
  | 'nervoso'
  | 'olho';

export const SISTEMAS = ['pele', 'esqueleto', 'musculos', 'cardiovascular', 'respiratorio', 'digestivo',
  'linfatico', 'urinario', 'reprodutor', 'endocrino', 'nervoso', 'olho'] as const satisfies readonly Sistema[];

export interface PecaManifesto {
  fmaId: string;
  nomeLatim: string;
  nomePt: string;
  nomeLeigo: string;
  sistema: Sistema;
  lado: 'D' | 'E' | '-';
  glb: string;
  bytes: number;
  triangulos: number;
  elementos: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  centro: [number, number, number];
  vetorExplosao: [number, number, number];
}

export interface Manifesto {
  versao: 1;
  geradoEm: string;
  fonte: string;
  bytesTotal: number;
  sistemas: Sistema[];
  pecas: PecaManifesto[];
}

export async function carregarManifesto(): Promise<Manifesto> {
  const res = await fetch('/models/manifest.json', { cache: 'no-cache' }); // revalida com ETag; imutáveis são os GLBs, não o manifesto
  if (!res.ok) throw new Error(`manifest.json: HTTP ${res.status}`);
  const m = (await res.json()) as Manifesto;
  if (m.versao !== 1 || !Array.isArray(m.pecas)) throw new Error('manifest.json em formato inesperado');
  return m;
}

export const ROTULO_SISTEMA: Record<Sistema, string> = {
  pele: 'Pele',
  esqueleto: 'Esqueleto',
  musculos: 'Músculos',
  cardiovascular: 'Coração e vasos',
  respiratorio: 'Respiratório',
  digestivo: 'Digestivo',
  linfatico: 'Linfático',
  urinario: 'Urinário',
  reprodutor: 'Reprodutor',
  endocrino: 'Glândulas',
  nervoso: 'Nervoso',
  olho: 'Olho',
};
