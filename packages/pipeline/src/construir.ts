import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CSV_ESTRUTURAS, CSV_PARTES, DIR_CACHE, DIR_SAIDA, FMA_PELE, ORCAMENTO_SEGUNDOS_OCLUSAO, PECAS_COM_OCLUSAO, RAZAO_PADRAO } from './constantes';
import type { Envelope } from './confinar';
import { lerCsvEstruturas, lerElementos, lerNomesConceitos, resolverPecas } from './catalogo';
import { escreverGlb } from './glb';
import { novaGeometria, parseObj } from './obj';
import { FONTE, vetorExplosaoPadrao, type Manifesto, type PecaManifesto } from './manifesto';
import { construirPartes, contarPartes } from './construir-partes';
import { lerCsvPartes, unirConceitos } from './partes';

export interface OpcoesConstruir {
  csv: string; elementParts: { partof: string; isa: string }; dirObj: string; dirSaida: string;
  csvPartes?: string;
  log?: (m: string) => void;
}

function lerElemento(dirObj: string, fj: string, p: { fmaId: string; nomePt: string }): string {
  try {
    return readFileSync(join(dirObj, `${fj}.obj`), 'utf8');
  } catch (e) {
    throw new Error(`${p.fmaId} (${p.nomePt}): elemento ${fj}.obj não pôde ser lido em ${dirObj} — ${(e as Error).message}`);
  }
}

export async function construir(op: OpcoesConstruir): Promise<Manifesto> {
  const log = op.log ?? (() => {});
  const partofTxt = readFileSync(op.elementParts.partof, 'utf8');
  const isaTxt = readFileSync(op.elementParts.isa, 'utf8');
  const mapas = { partof: lerElementos(partofTxt), isa: lerElementos(isaTxt) };
  const pecas = resolverPecas(lerCsvEstruturas(readFileSync(op.csv, 'utf8')), mapas);
  const conceitos = unirConceitos(mapas, new Map([...lerNomesConceitos(partofTxt), ...lerNomesConceitos(isaTxt)]));
  const temCsvPartes = !!op.csvPartes && existsSync(op.csvPartes);
  const contagemPartes = temCsvPartes ? contarPartes(lerCsvPartes(readFileSync(op.csvPartes!, 'utf8'))) : new Map<string, number>();
  mkdirSync(op.dirSaida, { recursive: true });
  const saida: PecaManifesto[] = [];
  // a pele vai primeiro: a geometria final dela é o envelope das peças com `confinar=pele`
  const ordenadas = [...pecas].sort((a, b) => (a.fmaId === FMA_PELE ? -1 : b.fmaId === FMA_PELE ? 1 : 0));
  let envelope: Envelope | undefined;
  for (const [i, p] of ordenadas.entries()) {
    const g = novaGeometria();
    for (const fj of p.elementos) parseObj(lerElemento(op.dirObj, fj, p), g);
    const glb = `${p.sistema}/${p.fmaId}.glb`;
    if (p.confinar === 'pele' && !envelope) throw new Error(`${p.fmaId} (${p.nomePt}): confinar=pele exige a pele (${FMA_PELE}) no CSV`);
    const st = await escreverGlb(g, join(op.dirSaida, glb), {
      razao: p.razaoSimplificacao ?? RAZAO_PADRAO[p.sistema], nome: p.fmaId,
      inflarM: p.inflarMm ? p.inflarMm / 1000 : undefined,
      confinarEm: p.confinar === 'pele' ? envelope : undefined,
      devolverGeometria: p.fmaId === FMA_PELE,
      oclusao: PECAS_COM_OCLUSAO.has(p.fmaId),
    });
    if (p.fmaId === FMA_PELE) envelope = st.geometriaFinal;
    saida.push({
      fmaId: p.fmaId, nomeLatim: p.nomeLatim, nomePt: p.nomePt, nomeLeigo: p.nomeLeigo, sistema: p.sistema, lado: p.lado,
      glb, bytes: st.bytes, triangulos: st.triangulosDepois, elementos: p.elementos.size,
      numPartes: contagemPartes.get(p.fmaId) ?? 0,
      bbox: st.bbox, centro: st.centro, vetorExplosao: p.vetorExplosao ?? vetorExplosaoPadrao(st.centro, p.sistema),
    });
    log(`[${i + 1}/${pecas.length}] ${p.nomePt}: ${p.elementos.size} el, ${st.triangulosAntes}→${st.triangulosDepois} tri, ${(st.bytes / 1024).toFixed(0)} KB${st.confinados !== undefined ? `, ${st.confinados} vértices confinados na pele` : ''}${st.reduzidosInflar !== undefined ? `, ${st.reduzidosInflar} vértices inflaram menos (dobras)${st.dobrasRestantes ? `, ${st.dobrasRestantes} DOBRAS RESTANTES` : ''}` : ''}${st.segundosOclusao !== undefined ? `, oclusão média ${(st.oclusaoMedia ?? 0).toFixed(3)} em ${st.segundosOclusao.toFixed(1)} s${st.segundosOclusao > ORCAMENTO_SEGUNDOS_OCLUSAO ? ' (ACIMA do orçamento de tempo)' : ''}` : ''}`);
  }
  if (temCsvPartes) {
    const r = await construirPartes({ csvPartes: op.csvPartes!, dirObj: op.dirObj, dirSaida: op.dirSaida, pecas, manifestoPecas: saida, conceitos, log });
    log(`${r.porPai.size} pais com partes, ${(r.bytesTotal / 1048576).toFixed(1)} MB de partes`);
  } else log('sem partes.csv: nenhuma parte gerada');
  const sistemas = [...new Set(saida.map((p) => p.sistema))];
  const manifesto: Manifesto = {
    versao: 1, geradoEm: new Date().toISOString(), fonte: FONTE,
    bytesTotal: saida.reduce((a, p) => a + p.bytes, 0), sistemas, pecas: saida,
  };
  writeFileSync(join(op.dirSaida, 'manifest.json'), JSON.stringify(manifesto, null, 1));
  return manifesto;
}

if (process.argv[1] && process.argv[1].endsWith('construir.ts')) {
  construir({
    csv: CSV_ESTRUTURAS,
    elementParts: { partof: join(DIR_CACHE, 'partof_element_parts.txt'), isa: join(DIR_CACHE, 'isa_element_parts.txt') },
    dirObj: join(DIR_CACHE, 'obj'), dirSaida: DIR_SAIDA, csvPartes: CSV_PARTES, log: console.log,
  }).then((m) => console.log(`\n${m.pecas.length} peças, ${(m.bytesTotal / 1048576).toFixed(1)} MB`))
    .catch((e) => { console.error(e); process.exit(1); });
}
