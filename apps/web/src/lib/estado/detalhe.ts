import type { Manifesto, PartePeca, PecaManifesto } from '@/lib/manifesto';
import type { EstadoCena } from './schema';

export type EstadoPartes = PartePeca[] | 'carregando' | 'erro';
/** Partes por pai, transitório (não vai no link): lista quando chegou, ou o estado da carga. */
export type PartesCarregadas = Record<string, EstadoPartes | undefined>;

export const partesDe = (partes: PartesCarregadas, id: string): PartePeca[] | null => {
  const p = partes[id];
  return Array.isArray(p) ? p : null;
};

/**
 * Visível = peças de nível 1 menos a raiz da pilha, mais, para cada nó aberto, as partes dele
 * menos o nó seguinte; depois os filtros de opacidade do sistema e de `ocultas`. Um nó aberto
 * cujas partes ainda não chegaram continua visível (sem buraco) e os níveis abaixo dele não entram.
 */
export function pecasVisiveis(manifesto: Manifesto, partes: PartesCarregadas, e: EstadoCena): PecaManifesto[] {
  const raiz = e.detalhe[0];
  const lista: PecaManifesto[] = manifesto.pecas.filter((p) => p.fmaId !== raiz || !partesDe(partes, raiz));
  for (let i = 0; i < e.detalhe.length; i++) {
    const abertas = partesDe(partes, e.detalhe[i]);
    if (!abertas) break;
    const proximo = e.detalhe[i + 1];
    for (const p of abertas) if (p.fmaId !== proximo || !partesDe(partes, proximo)) lista.push(p);
  }
  return lista.filter((p) => e.opacidade[p.sistema] > 0 && !e.ocultas.includes(p.fmaId));
}

let memo: { partes: PartesCarregadas; detalhe: string[]; dentro: Set<string> | null } | null = null;

/**
 * Ids das partes do nó mais fundo cujas partes já chegaram; `null` = nada esmaece (sem detalhe
 * ou nada carregado). Memoizado por identidade de `partes` e `detalhe`: 241 peças consultam
 * isto a cada mudança do store.
 */
export function dentroDoDetalhe(partes: PartesCarregadas, e: EstadoCena): Set<string> | null {
  if (memo && memo.partes === partes && memo.detalhe === e.detalhe) return memo.dentro;
  let dentro: Set<string> | null = null;
  for (let i = e.detalhe.length - 1; i >= 0; i--) {
    const l = partesDe(partes, e.detalhe[i]);
    if (l) { dentro = new Set(l.map((p) => p.fmaId)); break; }
  }
  memo = { partes, detalhe: e.detalhe, dentro };
  return dentro;
}
