import { describe, it, expect } from 'vitest';
import { buscarPecas, normalizar } from './busca';
import type { PecaManifesto } from './manifesto';

const p = (fmaId: string, nomePt: string, nomeLeigo: string, nomeLatim: string): PecaManifesto => ({
  fmaId, nomePt, nomeLeigo, nomeLatim, sistema: 'digestivo', lado: '-', glb: '', bytes: 0, triangulos: 0, elementos: 0,
  bbox: { min: [0, 0, 0], max: [0, 0, 0] }, centro: [0, 0, 0], vetorExplosao: [0, 0, 1],
});
const pecas = [p('FMA7197', 'Fígado', 'fígado', 'Hepar'), p('FMA7148', 'Estômago', 'estômago', 'Gaster'), p('FMA24475', 'Fêmur esquerdo', 'osso da coxa esquerdo', 'Femur')];

describe('buscarPecas', () => {
  it('ignora acentos e caixa, e casa por nome leigo, português ou latim', () => {
    expect(buscarPecas(pecas, 'FIGADO').map((x) => x.fmaId)).toEqual(['FMA7197']);
    expect(buscarPecas(pecas, 'hepar').map((x) => x.fmaId)).toEqual(['FMA7197']);
    expect(buscarPecas(pecas, 'coxa').map((x) => x.fmaId)).toEqual(['FMA24475']);
  });
  it('consulta vazia ou só espaços devolve lista vazia; limita a 20 resultados', () => {
    expect(buscarPecas(pecas, '  ')).toEqual([]);
    const muitas = Array.from({ length: 30 }, (_, i) => p(`FMA${i}`, `Costela ${i}`, 'costela', 'Costa'));
    expect(buscarPecas(muitas, 'costela')).toHaveLength(20);
  });
  it('normalizar remove diacríticos', () => { expect(normalizar('Fêmur Ésquerdo')).toBe('femur esquerdo'); });
});
