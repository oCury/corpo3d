import { dividirCsv, type Lado } from './catalogo';
import { DESLOCAMENTO_MAXIMO_M, NIVEL_MAXIMO, PECAS_SEM_PARTES } from './constantes';
import type { Bbox } from './glb';

export type StatusParte = 'auto' | 'revisado' | 'excluida';
export interface LinhaParte { paiFmaId: string; fmaId: string; nomeEn: string; nomePt: string; nomeLeigo: string; status: StatusParte }
export interface Conceito { fmaId: string; nome: string; elementos: Set<string> }
/** Um nó da recursão: peça (nível 1) ou parte. `raiz` é a peça de nível 1 de onde ele descende. */
export interface No { fmaId: string; nome: string; nomePt: string; elementos: Set<string>; nivel: number; raiz: string }
export interface Atlas { conceitos: Map<string, Conceito>; porElemento: Map<string, Set<string>> }

/** Nomes do atlas que não são estruturas visíveis (cavidades, paredes, zonas, agrupamentos). Palavra inteira, sem maiúsculas. */
export const NAO_VISUAL = /\b(cavity|lumen|space|surface|region|zone|wall|part of|set of|side of|septum|apex|base of|border|margin|line|point|content|layer|myocardium|endocardium|epicardium|parenchyma|tree|proper|hemi|segment|division|trunk of)\b/i;
export const SUFIXO_RESTO = '-resto';
export const ehResto = (id: string): boolean => id.endsWith(SUFIXO_RESTO);
export const ID_VALIDO = /^FMA\d+(-resto)?$/;
export const CABECALHO_PARTES = ['paiFmaId', 'fmaId', 'nomeEn', 'nomePt', 'nomeLeigo', 'status'] as const;

/** Une as duas árvores por FMA (mesmo conceito, mesmos elementos) e guarda o nome em inglês. */
export function unirConceitos(mapas: { partof: Map<string, Set<string>>; isa: Map<string, Set<string>> }, nomes: Map<string, string>): Map<string, Conceito> {
  const out = new Map<string, Conceito>();
  for (const arv of ['partof', 'isa'] as const) {
    for (const [id, el] of mapas[arv]) {
      const c = out.get(id);
      if (c) for (const e of el) c.elementos.add(e);
      else out.set(id, { fmaId: id, nome: nomes.get(id) ?? id, elementos: new Set(el) });
    }
  }
  return out;
}

export function indexarAtlas(conceitos: Map<string, Conceito>): Atlas {
  const porElemento = new Map<string, Set<string>>();
  for (const c of conceitos.values()) for (const e of c.elementos) {
    if (!porElemento.has(e)) porElemento.set(e, new Set());
    porElemento.get(e)!.add(c.fmaId);
  }
  return { conceitos, porElemento };
}

/** Elementos próprios de cada peça de nível 1: elemento que está em 2+ peças não pertence a nenhuma para fins de partes. */
export function elementosProprios(pecas: { fmaId: string; elementos: Set<string> }[]): Map<string, Set<string>> {
  const donos = new Map<string, number>();
  for (const p of pecas) for (const e of p.elementos) donos.set(e, (donos.get(e) ?? 0) + 1);
  return new Map(pecas.map((p) => [p.fmaId, new Set([...p.elementos].filter((e) => donos.get(e) === 1))]));
}

const ehSubconjuntoEstrito = (a: Set<string>, b: Set<string>): boolean => a.size > 0 && a.size < b.size && [...a].every((e) => b.has(e));
const ordemPartes = (a: Conceito, b: Conceito): number => b.elementos.size - a.elementos.size || (a.fmaId < b.fmaId ? -1 : a.fmaId > b.fmaId ? 1 : 0);

/** Conceitos cujos elementos são subconjunto ESTRITO dos próprios do nó, fora da lista negra e de `excluir`. */
export function candidatas(proprios: Set<string>, atlas: Atlas, excluir: Set<string>): Conceito[] {
  const ids = new Set<string>();
  for (const e of proprios) for (const c of atlas.porElemento.get(e) ?? []) ids.add(c);
  const out: Conceito[] = [];
  for (const id of ids) {
    if (excluir.has(id)) continue;
    const c = atlas.conceitos.get(id)!;
    if (!ehSubconjuntoEstrito(c.elementos, proprios)) continue;
    if (NAO_VISUAL.test(c.nome)) continue;
    out.push(c);
  }
  return out.sort(ordemPartes);
}

export interface Escolha { partes: Conceito[]; resto: Set<string> }

/**
 * Guloso (maiores primeiro, sem repetir elemento), depois a curadoria: `revisado` entra mesmo
 * sobrepondo, `excluida` sai. Falha alto se um `revisado` não existir ou não for subconjunto do pai.
 */
export function escolherPartes(no: No, proprios: Set<string>, cands: Conceito[], curadoria: LinhaParte[], atlas: Atlas): Escolha {
  const linhas = curadoria.filter((l) => l.paiFmaId === no.fmaId);
  const excluidas = new Set(linhas.filter((l) => l.status === 'excluida').map((l) => l.fmaId));
  const revisadas = linhas.filter((l) => l.status === 'revisado' && !ehResto(l.fmaId)).map((l) => l.fmaId);
  const cobertos = new Set<string>();
  const partes: Conceito[] = [];
  const cobrir = (c: Conceito) => { partes.push(c); for (const e of c.elementos) cobertos.add(e); };
  for (const c of cands) {
    if (excluidas.has(c.fmaId) || revisadas.includes(c.fmaId)) continue;
    if ([...c.elementos].some((e) => cobertos.has(e))) continue;
    cobrir(c);
  }
  for (const id of revisadas) {
    const c = atlas.conceitos.get(id);
    if (!c) throw new Error(`partes.csv: ${no.fmaId} → ${id} (revisado) não existe no atlas`);
    if (!ehSubconjuntoEstrito(c.elementos, proprios)) throw new Error(`partes.csv: ${no.fmaId} → ${id} (revisado, ${c.nome}) não é subconjunto estrito dos elementos próprios do pai`);
    cobrir(c);
  }
  partes.sort(ordemPartes);
  return { partes, resto: new Set([...proprios].filter((e) => !cobertos.has(e))) };
}

export const nomeResto = (nomePai: string): string => `Outras partes de ${nomePai}`;

/**
 * Percorre as raízes (peças) em largura, escolhe partes por nó e emite as linhas do CSV: `auto`
 * recalculadas (nomes pt já rascunhados são mantidos), `revisado`/`excluida` existentes preservadas,
 * `auto` órfãs removidas. Um conceito reaproveitado sob dois pais é expandido uma vez só (nível mais raso).
 */
export function proporArvore(raizes: No[], atlas: Atlas, propriosPorRaiz: Map<string, Set<string>>, curadoria: LinhaParte[]): LinhaParte[] {
  const saida: LinhaParte[] = [];
  const anterior = new Map(curadoria.map((l) => [`${l.paiFmaId}|${l.fmaId}`, l]));
  const fila = [...raizes];
  const vistos = new Set<string>();
  while (fila.length) {
    const no = fila.shift()!;
    if (vistos.has(no.fmaId) || no.nivel >= NIVEL_MAXIMO || ehResto(no.fmaId) || PECAS_SEM_PARTES.has(no.fmaId)) continue;
    vistos.add(no.fmaId);
    const propriosRaiz = propriosPorRaiz.get(no.raiz) ?? new Set<string>();
    const proprios = new Set([...no.elementos].filter((e) => propriosRaiz.has(e)));
    const { partes, resto } = escolherPartes(no, proprios, candidatas(proprios, atlas, new Set([no.fmaId])), curadoria, atlas);
    if (partes.length + (resto.size ? 1 : 0) < 2) continue;
    for (const c of partes) {
      const velha = anterior.get(`${no.fmaId}|${c.fmaId}`);
      const linha: LinhaParte = velha?.status === 'revisado' ? velha
        : { paiFmaId: no.fmaId, fmaId: c.fmaId, nomeEn: c.nome, nomePt: velha?.nomePt ?? '', nomeLeigo: velha?.nomeLeigo ?? '', status: 'auto' };
      saida.push(linha);
      fila.push({ fmaId: c.fmaId, nome: c.nome, nomePt: linha.nomePt, elementos: c.elementos, nivel: no.nivel + 1, raiz: no.raiz });
    }
    if (resto.size) {
      const id = no.fmaId + SUFIXO_RESTO;
      const velha = anterior.get(`${no.fmaId}|${id}`);
      saida.push(velha?.status === 'revisado' ? velha
        : { paiFmaId: no.fmaId, fmaId: id, nomeEn: `rest of ${no.nome}`, nomePt: nomeResto(no.nomePt || no.nome), nomeLeigo: velha?.nomeLeigo ?? '', status: 'auto' });
    }
    for (const l of curadoria) if (l.paiFmaId === no.fmaId && l.status === 'excluida') saida.push(l);
  }
  return saida;
}

const STATUS: StatusParte[] = ['auto', 'revisado', 'excluida'];

export function lerCsvPartes(texto: string): LinhaParte[] {
  const linhas = texto.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim());
  if (!linhas.length) return [];
  const cab = dividirCsv(linhas[0]);
  if (cab.join(',') !== CABECALHO_PARTES.join(',')) throw new Error(`partes.csv: cabeçalho esperado "${CABECALHO_PARTES.join(',')}", veio "${cab.join(',')}"`);
  const vistos = new Set<string>();
  return linhas.slice(1).map((l, i) => {
    const v = Object.fromEntries(cab.map((k, j) => [k, (dividirCsv(l)[j] ?? '').trim()]));
    const n = i + 2;
    if (!ID_VALIDO.test(v.paiFmaId) || ehResto(v.paiFmaId)) throw new Error(`partes.csv linha ${n}: paiFmaId inválido "${v.paiFmaId}"`);
    if (!ID_VALIDO.test(v.fmaId)) throw new Error(`partes.csv linha ${n}: fmaId inválido "${v.fmaId}"`);
    if (!STATUS.includes(v.status as StatusParte)) throw new Error(`partes.csv linha ${n}: status inválido "${v.status}" (auto | revisado | excluida)`);
    const chave = `${v.paiFmaId}|${v.fmaId}`;
    if (vistos.has(chave)) throw new Error(`partes.csv linha ${n}: par duplicado ${v.paiFmaId} → ${v.fmaId}`);
    vistos.add(chave);
    return { paiFmaId: v.paiFmaId, fmaId: v.fmaId, nomeEn: v.nomeEn, nomePt: v.nomePt, nomeLeigo: v.nomeLeigo, status: v.status as StatusParte };
  });
}

const campoCsv = (s: string): string => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Mantém a ordem recebida (por pai, maiores primeiro): o diff fica legível. */
export function escreverCsvPartes(linhas: LinhaParte[]): string {
  return [CABECALHO_PARTES.join(','), ...linhas.map((l) => CABECALHO_PARTES.map((k) => campoCsv(l[k])).join(','))].join('\n') + '\n';
}

/** Direção do centro do pai ao da parte, com alcance = diagonal do pai (com o slider em 1). No centro, sai para +z. */
export function vetorExplosaoParte(centroPai: [number, number, number], bboxPai: Bbox, centroParte: [number, number, number]): [number, number, number] {
  const diag = Math.hypot(bboxPai.max[0] - bboxPai.min[0], bboxPai.max[1] - bboxPai.min[1], bboxPai.max[2] - bboxPai.min[2]);
  const mag = diag / DESLOCAMENTO_MAXIMO_M;
  const d = [centroParte[0] - centroPai[0], centroParte[1] - centroPai[1], centroParte[2] - centroPai[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  if (len < 1e-6) return [0, 0, mag];
  return [(d[0] / len) * mag, (d[1] / len) * mag, (d[2] / len) * mag];
}

export function ladoPeloNome(nomeEn: string, ladoPai: Lado): Lado {
  if (/^right\b/i.test(nomeEn)) return 'D';
  if (/^left\b/i.test(nomeEn)) return 'E';
  return ladoPai;
}
