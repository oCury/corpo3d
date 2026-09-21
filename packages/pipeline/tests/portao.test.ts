import { describe, it, expect } from 'vitest';
import { verificarOrcamento } from '../src/portao';
import type { Manifesto } from '../src/manifesto';

const base = (pecas: Array<{ fmaId: string; bytes: number; glb?: string }>): Manifesto => ({
  versao: 1, geradoEm: '', fonte: '', sistemas: ['pele'],
  bytesTotal: pecas.reduce((a, p) => a + p.bytes, 0),
  pecas: pecas.map((p) => ({ fmaId: p.fmaId, nomeLatim: '', nomePt: p.fmaId, nomeLeigo: '', sistema: 'pele', lado: '-',
    glb: p.glb ?? `pele/${p.fmaId}.glb`, bytes: p.bytes, triangulos: 1, elementos: 1,
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
