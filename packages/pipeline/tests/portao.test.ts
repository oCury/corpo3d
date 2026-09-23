import { describe, it, expect } from 'vitest';
import { verificarOrcamento } from '../src/portao';
import type { Manifesto } from '../src/manifesto';

const base = (pecas: Array<{ fmaId: string; bytes: number; glb?: string }>): Manifesto => ({
  versao: 1, geradoEm: '', fonte: '', sistemas: ['pele'],
  bytesTotal: pecas.reduce((a, p) => a + p.bytes, 0),
  pecas: pecas.map((p) => ({ fmaId: p.fmaId, nomeLatim: '', nomePt: p.fmaId, nomeLeigo: '', sistema: 'pele', lado: '-',
    glb: p.glb ?? `pele/${p.fmaId}.glb`, bytes: p.bytes, triangulos: 1, elementos: 1, numPartes: 0,
    bbox: { min: [0, 0, 0], max: [1, 1, 1] }, centro: [0.5, 0.5, 0.5], vetorExplosao: [0, 0, 1] })),
});

describe('verificarOrcamento', () => {
  it('passa quando todos os ids do CSV existem, ninguém estoura e o total cabe', () => {
    const r = verificarOrcamento(base([{ fmaId: 'FMA1', bytes: 1000 }]), ['FMA1'], { porPeca: 2000, total: 5000 });
    expect(r.ok).toBe(true); expect(r.problemas).toEqual([]);
  });
  it('acusa peça acima do orçamento, total estourado, id faltando e id sobrando', () => {
    const r = verificarOrcamento(base([{ fmaId: 'FMA1', bytes: 3000 }, { fmaId: 'FMA9', bytes: 3000 }]), ['FMA1', 'FMA2'], { porPeca: 2000, total: 5000 });
    expect(r.ok).toBe(false);
    expect(r.problemas.join('\n')).toMatch(/FMA1 .*3000/);
    expect(r.problemas.join('\n')).toMatch(/total/);
    expect(r.problemas.join('\n')).toMatch(/FMA2.*sem GLB/);
    expect(r.problemas.join('\n')).toMatch(/FMA9.*não está no CSV/);
  });
});
import { verificarPartes } from '../src/portao';
import type { ManifestoPartes } from '../src/manifesto';

describe('verificarPartes', () => {
  const parte = (fmaId: string, paiFmaId: string, bytes: number): ManifestoPartes['partes'][number] => ({
    ...base([{ fmaId, bytes }]).pecas[0], glb: `partes/${paiFmaId}/${fmaId}.glb`, numPartes: 0, paiFmaId, nivel: 2, status: 'auto',
  });
  it('acusa pai desconhecido, parte acima do orçamento e total estourado', () => {
    const jsons: ManifestoPartes[] = [
      { versao: 1, paiFmaId: 'FMA1', partes: [parte('FMA10', 'FMA1', 3000)] },
      { versao: 1, paiFmaId: 'FMA9', partes: [parte('FMA90', 'FMA9', 100)] },
    ];
    const r = verificarPartes(jsons, new Set(['FMA1']), { porPeca: 2000, total: 2500 });
    expect(r.ok).toBe(false);
    expect(r.problemas.join('\n')).toMatch(/FMA9.*pai desconhecido/);
    expect(r.problemas.join('\n')).toMatch(/FMA10.*3000/);
    expect(r.problemas.join('\n')).toMatch(/total de partes/);
  });
  it('uma parte com partes conta como pai conhecido', () => {
    const jsons: ManifestoPartes[] = [
      { versao: 1, paiFmaId: 'FMA1', partes: [parte('FMA10', 'FMA1', 100)] },
      { versao: 1, paiFmaId: 'FMA10', partes: [parte('FMA100', 'FMA10', 100)] },
    ];
    expect(verificarPartes(jsons, new Set(['FMA1']), { porPeca: 2000, total: 2500 }).ok).toBe(true);
  });
});
