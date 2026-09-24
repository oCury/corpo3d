import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CSV_ESTRUTURAS, DIR_PARTES, DIR_SAIDA, AREA_MINIMA_NORMAIS_M2, FMA_PELE, NORMAIS_OPOSTAS_TOLERADAS, NORMAIS_OPOSTAS_TOLERADAS_PELE, RAZAO_MINIMA_NORMAL, OCLUSAO_ALTA, OCLUSAO_FRACAO_ALTA_MAX, OCLUSAO_MAXIMO_MIN, OCLUSAO_MEDIA_MAX, OCLUSAO_MEDIA_MIN, ORCAMENTO_BYTES_PARTES_TOTAL, ORCAMENTO_BYTES_POR_PECA, ORCAMENTO_BYTES_TOTAL } from './constantes';
import { lerCsvEstruturas } from './catalogo';
import { lerGlb } from './glb';
import type { Manifesto, ManifestoPartes } from './manifesto';

export function verificarOrcamento(m: Manifesto, idsCsv: string[], orc: { porPeca: number; total: number }): { ok: boolean; problemas: string[] } {
  const problemas: string[] = [];
  const noManifesto = new Set(m.pecas.map((p) => p.fmaId));
  for (const id of idsCsv) if (!noManifesto.has(id)) problemas.push(`${id}: está no CSV mas sem GLB no manifesto`);
  const noCsv = new Set(idsCsv);
  for (const p of m.pecas) {
    if (!noCsv.has(p.fmaId)) problemas.push(`${p.fmaId}: no manifesto mas não está no CSV`);
    if (p.bytes > orc.porPeca) problemas.push(`${p.fmaId} ${p.nomePt}: ${p.bytes} bytes > orçamento ${orc.porPeca}`);
  }
  if (m.bytesTotal > orc.total) problemas.push(`total ${m.bytesTotal} bytes > orçamento ${orc.total}`);
  return { ok: problemas.length === 0, problemas };
}

/** Todo pai de partes é uma peça do manifesto ou uma parte de algum JSON; orçamentos por parte e total de partes. */
export function verificarPartes(jsons: ManifestoPartes[], pecas: Set<string>, orc: { porPeca: number; total: number }): { ok: boolean; problemas: string[] } {
  const problemas: string[] = [];
  const conhecidos = new Set(pecas);
  for (const j of jsons) for (const p of j.partes) conhecidos.add(p.fmaId);
  let total = 0;
  for (const j of jsons) {
    if (!conhecidos.has(j.paiFmaId)) problemas.push(`${j.paiFmaId}: pai desconhecido (não é peça nem parte)`);
    for (const p of j.partes) {
      total += p.bytes;
      if (p.bytes > orc.porPeca) problemas.push(`${p.fmaId} ${p.nomePt} (parte de ${j.paiFmaId}): ${p.bytes} bytes > orçamento ${orc.porPeca}`);
    }
  }
  if (total > orc.total) problemas.push(`total de partes ${total} bytes > orçamento ${orc.total}`);
  return { ok: problemas.length === 0, problemas };
}

/**
 * Quantos vértices têm a normal gravada de costas (`dot < 0`) para a normal média das faces vizinhas.
 * `pos` em metros. Vértices cuja área incidente é menor que `areaMinimaM2` são lascas sub-pixel que a
 * quantização de 14 bits vira sem efeito visível: não contam (o defeito real da pele tinha ≈ 6 mm² por vértice).
 */
export function verificarNormais(pos: ArrayLike<number>, idx: ArrayLike<number>, normais: ArrayLike<number>, areaMinimaM2 = AREA_MINIMA_NORMAIS_M2, razaoMinima = RAZAO_MINIMA_NORMAL): number {
  const nv = pos.length / 3;
  const soma = new Float64Array(pos.length), modulos = new Float64Array(nv);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const dobro = Math.hypot(nx, ny, nz);
    for (const i of [a, b, c]) { soma[i] += nx; soma[i + 1] += ny; soma[i + 2] += nz; modulos[i / 3] += dobro; }
  }
  let opostas = 0;
  for (let v = 0; v < nv; v++) {
    const i = v * 3;
    if (modulos[v] === 0) continue;                                    // sem face
    if (modulos[v] / 2 < areaMinimaM2) continue;                       // lasca sub-pixel (soma das áreas)
    const l = Math.hypot(soma[i], soma[i + 1], soma[i + 2]);
    if (l < razaoMinima * modulos[v]) continue;                        // faces costas com costas: média ambígua
    if (soma[i] * normais[i] + soma[i + 1] * normais[i + 1] + soma[i + 2] * normais[i + 2] < 0) opostas++;
  }
  return opostas;
}

export interface LimitesOclusao { mediaMin: number; mediaMax: number; maximoMin: number; alta: number; fracaoAltaMax: number }

/** `_OCLUSAO` presente, média na faixa, máximo alto o bastante, e poucos vértices quase totalmente ocluídos (raios entrando na malha). */
export function verificarOclusao(o: ArrayLike<number> | null, lim: LimitesOclusao): { ok: boolean; problemas: string[] } {
  if (!o || o.length === 0) return { ok: false, problemas: ['sem _OCLUSAO'] };
  const problemas: string[] = [];
  let soma = 0, maximo = 0, altos = 0;
  for (let i = 0; i < o.length; i++) { soma += o[i]; if (o[i] > maximo) maximo = o[i]; if (o[i] > lim.alta) altos++; }
  const media = soma / o.length, fracao = altos / o.length;
  if (media < lim.mediaMin || media > lim.mediaMax) problemas.push(`oclusão média ${media.toFixed(3)} fora de [${lim.mediaMin}, ${lim.mediaMax}]`);
  if (maximo < lim.maximoMin) problemas.push(`oclusão máximo ${maximo.toFixed(3)} < ${lim.maximoMin}`);
  if (fracao > lim.fracaoAltaMax) problemas.push(`fração de vértices com oclusão > ${lim.alta}: ${(fracao * 100).toFixed(2)} % > ${lim.fracaoAltaMax * 100} %`);
  return { ok: problemas.length === 0, problemas };
}

async function cli(): Promise<number> {
  const caminho = join(DIR_SAIDA, 'manifest.json');
  if (!existsSync(caminho)) { console.error(`sem ${caminho}; rode "pnpm --filter @corpo3d/pipeline construir"`); return 2; }
  const m: Manifesto = JSON.parse(readFileSync(caminho, 'utf8'));
  const ids = lerCsvEstruturas(readFileSync(CSV_ESTRUTURAS, 'utf8')).map((l) => l.fmaId);
  const faltandoNoDisco = m.pecas.filter((p) => !existsSync(join(DIR_SAIDA, p.glb))).map((p) => `${p.fmaId}: ${p.glb} não existe no disco`);
  const r = verificarOrcamento(m, ids, { porPeca: ORCAMENTO_BYTES_POR_PECA, total: ORCAMENTO_BYTES_TOTAL });
  const dirPartes = join(DIR_SAIDA, DIR_PARTES);
  const jsons: ManifestoPartes[] = existsSync(dirPartes)
    ? readdirSync(dirPartes).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dirPartes, f), 'utf8')) as ManifestoPartes)
    : [];
  const rp = verificarPartes(jsons, new Set(m.pecas.map((p) => p.fmaId)), { porPeca: ORCAMENTO_BYTES_POR_PECA, total: ORCAMENTO_BYTES_PARTES_TOTAL });
  const partesSemGlb = jsons.flatMap((j) => j.partes.filter((p) => !existsSync(join(DIR_SAIDA, p.glb))).map((p) => `${p.fmaId}: ${p.glb} não existe no disco`));
  // normais e oclusão, GLB a GLB (spec pele-realismo §5)
  const normaisOpostas: string[] = [];
  const oclusao: string[] = [];
  let toleradas = 0, glbsToleradas = 0;
  const todas = [...m.pecas.map((p) => ({ fmaId: p.fmaId, glb: p.glb })), ...jsons.flatMap((j) => j.partes.map((p) => ({ fmaId: p.fmaId, glb: p.glb })))];
  for (const p of todas) {
    const f = join(DIR_SAIDA, p.glb);
    if (!existsSync(f)) continue;
    const g = await lerGlb(f);
    const opostas = verificarNormais(g.pos, g.idx, g.normais);
    const limite = p.fmaId === FMA_PELE ? NORMAIS_OPOSTAS_TOLERADAS_PELE : NORMAIS_OPOSTAS_TOLERADAS;
    if (opostas > limite) normaisOpostas.push(`${p.fmaId}: ${opostas} vértice(s) com normal gravada oposta às faces (> ${limite})`);
    else if (opostas > 0) { toleradas += opostas; glbsToleradas++; }
    if (p.fmaId === FMA_PELE) {
      const ro = verificarOclusao(g.oclusao, { mediaMin: OCLUSAO_MEDIA_MIN, mediaMax: OCLUSAO_MEDIA_MAX, maximoMin: OCLUSAO_MAXIMO_MIN, alta: OCLUSAO_ALTA, fracaoAltaMax: OCLUSAO_FRACAO_ALTA_MAX });
      oclusao.push(...ro.problemas.map((x) => `${p.fmaId} (pele): ${x}`));
    }
  }
  if (!todas.some((p) => p.fmaId === FMA_PELE)) oclusao.push(`${FMA_PELE} (pele) ausente do manifesto: oclusão não verificada`);
  const problemas = [...r.problemas, ...faltandoNoDisco, ...rp.problemas, ...partesSemGlb, ...normaisOpostas, ...oclusao];
  console.log(`${m.pecas.length} peças, ${(m.bytesTotal / 1048576).toFixed(2)} MB, ${jsons.length} pais com partes, ${todas.length} GLBs conferidas (normais e oclusão; ${toleradas} normais opostas toleradas em ${glbsToleradas} GLBs, lascas de quantização), ${problemas.length} problema(s)`);
  for (const p of problemas) console.log(' - ' + p);
  return problemas.length ? 1 : 0;
}

if (process.argv[1] && process.argv[1].endsWith('portao.ts')) {
  cli().then((codigo) => process.exit(codigo)).catch((e) => { console.error(e); process.exit(1); });
}
