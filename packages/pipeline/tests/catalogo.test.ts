import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerElementos, lerCsvEstruturas, resolverPecas } from '../src/catalogo';

const fx = (n: string) => readFileSync(join(__dirname, 'fixtures', n), 'utf8');

describe('catalogo', () => {
  it('lê element_parts em mapa fmaId → conjunto de elementos', () => {
    const m = lerElementos(fx('partof_element_parts.txt'));
    expect([...m.get('FMA1')!]).toEqual(['FJ10', 'FJ11']);
    expect(m.get('FMA3')!.size).toBe(3);
    expect(m.has('concept id')).toBe(false);
  });

  it('lê o CSV respeitando aspas com vírgula', () => {
    const linhas = lerCsvEstruturas(fx('estruturas.csv'));
    expect(linhas).toHaveLength(4);
    expect(linhas[1].nomeLeigo).toBe('crânio (ossos da cabeça, sem o maxilar)');
    expect(linhas[1].razaoSimplificacao).toBe(0.3);
    expect(linhas[0].razaoSimplificacao).toBeUndefined();
    expect(linhas[3].vetorExplosao).toEqual([0, 0, 1]);
  });

  it('lança erro se houver fmaId repetido no CSV', () => {
    const csv = 'fmaId,arvore,fmaIdsExtras,excluirFmaIds,nomeLatim,nomePt,nomeLeigo,sistema,lado,vetorExplosao,razaoSimplificacao\n'
      + 'FMA1,partof,,,Cor,Coração,coração,cardiovascular,-,,\n'
      + 'FMA4,partof,,,Splen,Baço,baço,linfatico,-,,\n'
      + 'FMA1,partof,,,Cor,Coração,coração,cardiovascular,-,,\n';
    expect(() => lerCsvEstruturas(csv)).toThrow(/duplicado.*FMA1/);
  });

  it('resolve união, exclusão e fallback de árvore', () => {
    const pecas = resolverPecas(lerCsvEstruturas(fx('estruturas.csv')), {
      partof: lerElementos(fx('partof_element_parts.txt')),
      isa: lerElementos(fx('isa_element_parts.txt')),
    });
    const por = Object.fromEntries(pecas.map((p) => [p.fmaId, p]));
    expect([...por.FMA1.elementos]).toEqual(['FJ10', 'FJ11']);
    expect([...por.FMA3.elementos].sort()).toEqual(['FJ30', 'FJ31']);        // FJ20 excluído (mandíbula)
    expect([...por.FMA4.elementos]).toEqual(['FJ40']);                        // pedia partof, achou em isa
    expect(por.FMA4.arvoreUsada).toBe('isa');
    expect([...por.FMA5.elementos].sort()).toEqual(['FJ50', 'FJ51']);        // extras
  });

  it('falha alto se um id não existe em nenhuma árvore', () => {
    const csv = lerCsvEstruturas('fmaId,arvore,fmaIdsExtras,excluirFmaIds,nomeLatim,nomePt,nomeLeigo,sistema,lado,vetorExplosao,razaoSimplificacao\nFMA999,partof,,,X,X,x,pele,-,,\n');
    expect(() => resolverPecas(csv, { partof: new Map(), isa: new Map() })).toThrow(/FMA999/);
  });

  it('falha alto se a exclusão esvazia a peça', () => {
    const csv = lerCsvEstruturas('fmaId,arvore,fmaIdsExtras,excluirFmaIds,nomeLatim,nomePt,nomeLeigo,sistema,lado,vetorExplosao,razaoSimplificacao\nFMA2,partof,,FMA2,X,X,x,pele,-,,\n');
    const m = lerElementos(fx('partof_element_parts.txt'));
    expect(() => resolverPecas(csv, { partof: m, isa: new Map() })).toThrow(/sem elementos/);
  });
  it('resolverPecas falha alto se um extra não existe em nenhuma árvore', () => {
    const csv = lerCsvEstruturas('fmaId,arvore,fmaIdsExtras,excluirFmaIds,nomeLatim,nomePt,nomeLeigo,sistema,lado,vetorExplosao,razaoSimplificacao\nFMA1,partof,FMA6,,Cor,Coração,coração,cardiovascular,-,,\n');
    const m = lerElementos(fx('partof_element_parts.txt'));
    expect(() => resolverPecas(csv, { partof: m, isa: new Map() })).toThrow(/extra FMA6 não existe/);
  });

  it('resolverPecas falha alto se uma exclusão não existe em nenhuma árvore', () => {
    const csv = lerCsvEstruturas('fmaId,arvore,fmaIdsExtras,excluirFmaIds,nomeLatim,nomePt,nomeLeigo,sistema,lado,vetorExplosao,razaoSimplificacao\nFMA1,partof,,FMA9,Cor,Coração,coração,cardiovascular,-,,\n');
    const m = lerElementos(fx('partof_element_parts.txt'));
    expect(() => resolverPecas(csv, { partof: m, isa: new Map() })).toThrow(/exclusão FMA9 não existe/);
  });
});
