export type Arvore = 'partof' | 'isa';
export type Sistema = 'pele' | 'esqueleto' | 'musculos' | 'cardiovascular' | 'respiratorio' | 'digestivo'
  | 'linfatico' | 'urinario' | 'reprodutor' | 'endocrino' | 'nervoso' | 'olho';
export type Lado = 'D' | 'E' | '-';

export interface LinhaEstrutura {
  fmaId: string; arvore: Arvore; fmaIdsExtras: string[]; excluirFmaIds: string[];
  nomeLatim: string; nomePt: string; nomeLeigo: string; sistema: Sistema; lado: Lado;
  vetorExplosao?: [number, number, number]; razaoSimplificacao?: number; inflarMm?: number; confinar?: 'pele';
}
export interface Peca extends LinhaEstrutura { elementos: Set<string>; arvoreUsada: Arvore; }
export type Mapas = Record<Arvore, Map<string, Set<string>>>;

/** `concept id \t name \t element file id`, com cabeçalho. */
export function lerElementos(texto: string): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const linha of texto.split('\n').slice(1)) {
    const c = linha.split('\t');
    if (c.length < 3) continue;
    const [fma, , fj] = c.map((s) => s.trim());
    if (!m.has(fma)) m.set(fma, new Set());
    m.get(fma)!.add(fj);
  }
  return m;
}

function dividirCsv(linha: string): string[] {
  const out: string[] = []; let atual = ''; let aspas = false;
  for (const ch of linha) {
    if (ch === '"') aspas = !aspas;
    else if (ch === ',' && !aspas) { out.push(atual); atual = ''; }
    else atual += ch;
  }
  out.push(atual);
  return out;
}

const SISTEMAS: Sistema[] = ['pele','esqueleto','musculos','cardiovascular','respiratorio','digestivo','linfatico','urinario','reprodutor','endocrino','nervoso','olho'];

export function lerCsvEstruturas(texto: string): LinhaEstrutura[] {
  const linhas = texto.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim());
  const cab = dividirCsv(linhas[0]);
  const resultado = linhas.slice(1).map((l, i) => {
    const v = Object.fromEntries(cab.map((k, j) => [k, (dividirCsv(l)[j] ?? '').trim()]));
    const lista = (s: string) => s ? s.split(';').map((x) => x.trim()).filter(Boolean) : [];
    if (!/^FMA\d+$/.test(v.fmaId)) throw new Error(`linha ${i + 2}: fmaId inválido "${v.fmaId}"`);
    if (v.arvore !== 'partof' && v.arvore !== 'isa') throw new Error(`linha ${i + 2}: arvore inválida "${v.arvore}"`);
    if (!SISTEMAS.includes(v.sistema as Sistema)) throw new Error(`linha ${i + 2}: sistema inválido "${v.sistema}"`);
    if (!['D', 'E', '-'].includes(v.lado)) throw new Error(`linha ${i + 2}: lado inválido "${v.lado}"`);
    const vetor = v.vetorExplosao ? v.vetorExplosao.split(',').map(Number) : undefined;
    if (vetor && (vetor.length !== 3 || vetor.some(Number.isNaN))) throw new Error(`linha ${i + 2}: vetorExplosao inválido`);
    const razao = v.razaoSimplificacao ? Number(v.razaoSimplificacao) : undefined;
    if (razao !== undefined && !(razao > 0 && razao <= 1)) throw new Error(`linha ${i + 2}: razaoSimplificacao fora de (0,1]`);
    const inflarMm = v.inflarMm ? Number(v.inflarMm) : undefined;
    if (inflarMm !== undefined && !(Number.isFinite(inflarMm) && Math.abs(inflarMm) <= 10)) throw new Error(`linha ${i + 2}: inflarMm inválido "${v.inflarMm}" (mm, entre -10 e 10; negativo encolhe)`);
    if (v.confinar && v.confinar !== 'pele') throw new Error(`linha ${i + 2}: confinar inválido "${v.confinar}" (só "pele")`);
    return {
      fmaId: v.fmaId, arvore: v.arvore as Arvore, fmaIdsExtras: lista(v.fmaIdsExtras), excluirFmaIds: lista(v.excluirFmaIds),
      nomeLatim: v.nomeLatim, nomePt: v.nomePt, nomeLeigo: v.nomeLeigo, sistema: v.sistema as Sistema, lado: v.lado as Lado,
      vetorExplosao: vetor as [number, number, number] | undefined, razaoSimplificacao: razao, inflarMm, confinar: v.confinar === 'pele' ? ('pele' as const) : undefined,
    };
  });
  // cada item de `resultado` corresponde à linha i+2 do arquivo (cabeçalho é a linha 1)
  const primeiraLinhaPorId = new Map<string, number>();
  resultado.forEach((l, i) => {
    const anterior = primeiraLinhaPorId.get(l.fmaId);
    if (anterior !== undefined) throw new Error(`fmaId duplicado: ${l.fmaId} (linhas ${anterior} e ${i + 2})`);
    primeiraLinhaPorId.set(l.fmaId, i + 2);
  });
  return resultado;
}

function elementosDe(id: string, preferida: Arvore, mapas: Mapas): { elementos: Set<string>; arvore: Arvore } | undefined {
  const outra: Arvore = preferida === 'partof' ? 'isa' : 'partof';
  if (mapas[preferida].has(id)) return { elementos: mapas[preferida].get(id)!, arvore: preferida };
  if (mapas[outra].has(id)) return { elementos: mapas[outra].get(id)!, arvore: outra };
  return undefined;
}

export function resolverPecas(linhas: LinhaEstrutura[], mapas: Mapas): Peca[] {
  return linhas.map((l) => {
    const principal = elementosDe(l.fmaId, l.arvore, mapas);
    if (!principal) throw new Error(`${l.fmaId} (${l.nomePt}): não existe em nenhuma árvore`);
    const elementos = new Set(principal.elementos);
    for (const extra of l.fmaIdsExtras) {
      const e = elementosDe(extra, principal.arvore, mapas);
      if (!e) throw new Error(`${l.fmaId} (${l.nomePt}): extra ${extra} não existe em nenhuma árvore`);
      for (const fj of e.elementos) elementos.add(fj);
    }
    for (const exc of l.excluirFmaIds) {
      const e = elementosDe(exc, principal.arvore, mapas);
      if (!e) throw new Error(`${l.fmaId} (${l.nomePt}): exclusão ${exc} não existe em nenhuma árvore`);
      for (const fj of e.elementos) elementos.delete(fj);
    }
    if (elementos.size === 0) throw new Error(`${l.fmaId} (${l.nomePt}): sem elementos após exclusões`);
    return { ...l, elementos, arvoreUsada: principal.arvore };
  });
}
