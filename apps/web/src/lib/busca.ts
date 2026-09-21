import type { PecaManifesto } from './manifesto';

export const MAX_RESULTADOS = 20;
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function buscarPecas(pecas: PecaManifesto[], consulta: string): PecaManifesto[] {
  const q = normalizar(consulta);
  if (!q) return [];
  return pecas.filter((p) => [p.nomeLeigo, p.nomePt, p.nomeLatim].some((n) => normalizar(n).includes(q))).slice(0, MAX_RESULTADOS);
}
