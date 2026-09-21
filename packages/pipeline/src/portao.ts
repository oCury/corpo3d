import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSV_ESTRUTURAS, DIR_SAIDA, ORCAMENTO_BYTES_POR_PECA, ORCAMENTO_BYTES_TOTAL } from './constantes';
import { lerCsvEstruturas } from './catalogo';
import type { Manifesto } from './manifesto';

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

if (process.argv[1] && process.argv[1].endsWith('portao.ts')) {
  const caminho = join(DIR_SAIDA, 'manifest.json');
  if (!existsSync(caminho)) { console.error(`sem ${caminho}; rode "pnpm --filter @corpo3d/pipeline construir"`); process.exit(2); }
  const m: Manifesto = JSON.parse(readFileSync(caminho, 'utf8'));
  const ids = lerCsvEstruturas(readFileSync(CSV_ESTRUTURAS, 'utf8')).map((l) => l.fmaId);
  const faltandoNoDisco = m.pecas.filter((p) => !existsSync(join(DIR_SAIDA, p.glb))).map((p) => `${p.fmaId}: ${p.glb} não existe no disco`);
  const r = verificarOrcamento(m, ids, { porPeca: ORCAMENTO_BYTES_POR_PECA, total: ORCAMENTO_BYTES_TOTAL });
  const problemas = [...r.problemas, ...faltandoNoDisco];
  console.log(`${m.pecas.length} peças, ${(m.bytesTotal / 1048576).toFixed(2)} MB, ${problemas.length} problema(s)`);
  for (const p of problemas) console.log(' - ' + p);
  process.exit(problemas.length ? 1 : 0);
}
