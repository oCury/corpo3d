import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSV_ESTRUTURAS, CSV_PARTES, DIR_CACHE } from './constantes';
import { lerCsvEstruturas, lerElementos, lerNomesConceitos, resolverPecas } from './catalogo';
import { elementosProprios, escreverCsvPartes, indexarAtlas, lerCsvPartes, proporArvore, unirConceitos, type LinhaParte, type No } from './partes';

export interface OpcoesPropor { csvEstruturas: string; csvPartes: string; elementParts: { partof: string; isa: string } }

/** Regra do spec §3 para as 241 peças e descendentes; preserva a curadoria do CSV existente. */
export function proporPartes(op: OpcoesPropor): { linhas: LinhaParte[]; texto: string } {
  const partofTxt = readFileSync(op.elementParts.partof, 'utf8');
  const isaTxt = readFileSync(op.elementParts.isa, 'utf8');
  const mapas = { partof: lerElementos(partofTxt), isa: lerElementos(isaTxt) };
  const nomes = new Map([...lerNomesConceitos(partofTxt), ...lerNomesConceitos(isaTxt)]);
  const pecas = resolverPecas(lerCsvEstruturas(readFileSync(op.csvEstruturas, 'utf8')), mapas);
  const atlas = indexarAtlas(unirConceitos(mapas, nomes));
  const raizes: No[] = pecas.map((p) => ({ fmaId: p.fmaId, nome: p.nomeLatim, nomePt: p.nomePt, elementos: p.elementos, nivel: 1, raiz: p.fmaId }));
  const curadoria = existsSync(op.csvPartes) ? lerCsvPartes(readFileSync(op.csvPartes, 'utf8')) : [];
  const linhas = proporArvore(raizes, atlas, elementosProprios(pecas), curadoria);
  return { linhas, texto: escreverCsvPartes(linhas) };
}

if (process.argv[1] && process.argv[1].endsWith('propor-partes.ts')) {
  const { linhas, texto } = proporPartes({
    csvEstruturas: CSV_ESTRUTURAS, csvPartes: CSV_PARTES,
    elementParts: { partof: join(DIR_CACHE, 'partof_element_parts.txt'), isa: join(DIR_CACHE, 'isa_element_parts.txt') },
  });
  writeFileSync(CSV_PARTES, texto);
  const pais = new Set(linhas.map((l) => l.paiFmaId));
  const por = (s: string) => linhas.filter((l) => l.status === s).length;
  console.log(`${CSV_PARTES}: ${linhas.length} linhas, ${pais.size} pais, auto ${por('auto')} · revisado ${por('revisado')} · excluida ${por('excluida')}`);
}
