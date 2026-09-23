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
  numPartes?: number;
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

/** Uma parte é uma peça comum mais o pai, o nível (2–5) e o estado da curadoria do nome. */
export interface PartePeca extends PecaManifesto { paiFmaId: string; nivel: number; status: 'auto' | 'revisado' }
export interface ManifestoPartes { versao: 1; paiFmaId: string; partes: PartePeca[] }
export const ehParte = (p: PecaManifesto): p is PartePeca => 'paiFmaId' in p;

export async function carregarManifestoPartes(paiFmaId: string): Promise<PartePeca[]> {
  const res = await fetch(`/models/partes/${paiFmaId}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`partes/${paiFmaId}.json: HTTP ${res.status}`);
  const m = (await res.json()) as ManifestoPartes;
  if (m.versao !== 1 || m.paiFmaId !== paiFmaId || !Array.isArray(m.partes)) throw new Error(`partes/${paiFmaId}.json em formato inesperado`);
  return m.partes;
}
