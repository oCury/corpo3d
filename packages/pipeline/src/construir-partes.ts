import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Peca } from './catalogo';
import { DIR_PARTES, RAZAO_PADRAO } from './constantes';
import { escreverGlb, type Bbox } from './glb';
import type { ManifestoPartes, PartePeca, PecaManifesto } from './manifesto';
import { novaGeometria, parseObj } from './obj';
import { ehResto, elementosProprios, ladoPeloNome, lerCsvPartes, vetorExplosaoParte, type Conceito, type LinhaParte } from './partes';

export interface OpcoesConstruirPartes {
  csvPartes: string; dirObj: string; dirSaida: string;
  pecas: Peca[]; manifestoPecas: PecaManifesto[]; conceitos: Map<string, Conceito>;
  log?: (m: string) => void;
}

/** Quantas partes (não excluídas) cada id tem no CSV. */
export function contarPartes(linhas: LinhaParte[]): Map<string, number> {
  const n = new Map<string, number>();
  for (const l of linhas) if (l.status !== 'excluida') n.set(l.paiFmaId, (n.get(l.paiFmaId) ?? 0) + 1);
  return n;
}

/**
 * Lê `partes.csv` e gera, por pai, os GLBs das partes e o `partes/<pai>.json`. Pais são
 * processados dos níveis rasos aos fundos (uma parte precisa da bbox/centro do pai já calculados).
 * Falha alto se uma linha apontar para conceito inexistente ou fora dos elementos próprios do pai:
 * ou a curadoria está errada, ou o CSV está velho (rode `propor-partes`).
 */
export async function construirPartes(op: OpcoesConstruirPartes): Promise<{ porPai: Map<string, ManifestoPartes>; bytesTotal: number }> {
  const log = op.log ?? (() => {});
  const linhas = lerCsvPartes(readFileSync(op.csvPartes, 'utf8')).filter((l) => l.status !== 'excluida');
  const contagem = contarPartes(linhas);
  const pecaPorId = new Map(op.pecas.map((p) => [p.fmaId, p]));
  const paiDe = new Map<string, string>();
  for (const l of linhas) if (!paiDe.has(l.fmaId)) paiDe.set(l.fmaId, l.paiFmaId);
  const raizDe = (id: string): string => { let x = id; while (paiDe.has(x)) x = paiDe.get(x)!; return x; };
  const nivelDe = (id: string): number => { let n = 1, x = id; while (paiDe.has(x)) { x = paiDe.get(x)!; n++; } return n; };
  const proprios = elementosProprios(op.pecas);
  const elementosDe = (id: string): Set<string> => {
    const p = pecaPorId.get(id); if (p) return p.elementos;
    const c = op.conceitos.get(id); if (c) return c.elementos;
    throw new Error(`partes.csv: ${id} não é peça nem conceito do atlas`);
  };
  /** bbox/centro/sistema/lado de cada nó já construído (peças vêm do manifesto principal). */
  const geo = new Map<string, { bbox: Bbox; centro: [number, number, number]; sistema: PecaManifesto['sistema']; lado: PecaManifesto['lado'] }>();
  for (const p of op.manifestoPecas) geo.set(p.fmaId, { bbox: p.bbox, centro: p.centro, sistema: p.sistema, lado: p.lado });
  const textos = new Map<string, string>();
  const lerElemento = (fj: string): string => {
    let t = textos.get(fj);
    if (t === undefined) { t = readFileSync(join(op.dirObj, `${fj}.obj`), 'utf8'); textos.set(fj, t); }
    return t;
  };
  const pais = [...new Set(linhas.map((l) => l.paiFmaId))].sort((a, b) => nivelDe(a) - nivelDe(b) || (a < b ? -1 : 1));
  const porPai = new Map<string, ManifestoPartes>();
  let bytesTotal = 0;
  for (const pai of pais) {
    const raiz = raizDe(pai);
    const g0 = geo.get(pai);
    if (!g0) throw new Error(`partes.csv: pai ${pai} não foi construído antes das suas partes (ordem por nível quebrada?)`);
    const propriosPai = new Set([...elementosDe(pai)].filter((e) => proprios.get(raiz)?.has(e)));
    const doPai = linhas.filter((l) => l.paiFmaId === pai);
    const cobertos = new Set<string>();
    const elementosDaParte = new Map<string, Set<string>>();
    for (const l of doPai.filter((l) => !ehResto(l.fmaId))) {
      const c = op.conceitos.get(l.fmaId);
      if (!c) throw new Error(`partes.csv: ${pai} → ${l.fmaId} não existe no atlas`);
      const fora = [...c.elementos].filter((e) => !propriosPai.has(e));
      if (fora.length || c.elementos.size >= propriosPai.size) throw new Error(`partes.csv: ${pai} → ${l.fmaId} (${l.nomeEn}) não é subconjunto estrito dos elementos próprios do pai (fora: ${fora.slice(0, 5).join(', ')}); curadoria errada ou CSV velho — rode propor-partes`);
      elementosDaParte.set(l.fmaId, c.elementos);
      for (const e of c.elementos) cobertos.add(e);
    }
    for (const l of doPai.filter((l) => ehResto(l.fmaId))) {
      const resto = new Set([...propriosPai].filter((e) => !cobertos.has(e)));
      if (!resto.size) { log(`aviso: ${pai} tem linha de resto mas nada sobra (CSV velho?)`); continue; }
      elementosDaParte.set(l.fmaId, resto);
    }
    mkdirSync(join(op.dirSaida, DIR_PARTES, pai), { recursive: true });
    const partes: PartePeca[] = [];
    for (const l of doPai) {
      const el = elementosDaParte.get(l.fmaId);
      if (!el) continue;
      const g = novaGeometria();
      for (const fj of el) parseObj(lerElemento(fj), g);
      const glb = `${DIR_PARTES}/${pai}/${l.fmaId}.glb`;
      const st = await escreverGlb(g, join(op.dirSaida, glb), { razao: RAZAO_PADRAO[g0.sistema], nome: l.fmaId });
      const lado = ladoPeloNome(l.nomeEn, g0.lado);
      geo.set(l.fmaId, { bbox: st.bbox, centro: st.centro, sistema: g0.sistema, lado });
      partes.push({
        fmaId: l.fmaId, nomeLatim: l.nomeEn, nomePt: l.nomePt || l.nomeEn, nomeLeigo: l.nomeLeigo || l.nomePt || l.nomeEn,
        sistema: g0.sistema, lado, glb, bytes: st.bytes, triangulos: st.triangulosDepois, elementos: el.size,
        numPartes: contagem.get(l.fmaId) ?? 0, bbox: st.bbox, centro: st.centro,
        vetorExplosao: vetorExplosaoParte(g0.centro, g0.bbox, st.centro),
        paiFmaId: pai, nivel: nivelDe(l.fmaId), status: l.status === 'revisado' ? 'revisado' : 'auto',
      });
      bytesTotal += st.bytes;
    }
    const m: ManifestoPartes = { versao: 1, paiFmaId: pai, partes };
    writeFileSync(join(op.dirSaida, DIR_PARTES, `${pai}.json`), JSON.stringify(m, null, 1));
    porPai.set(pai, m);
    log(`partes de ${pai}: ${partes.length} (${(partes.reduce((a, p) => a + p.bytes, 0) / 1024).toFixed(0)} KB)`);
  }
  return { porPai, bytesTotal };
}
