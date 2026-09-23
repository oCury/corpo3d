import { describe, it, expect } from 'vitest';
import {
  NAO_VISUAL, unirConceitos, indexarAtlas, elementosProprios, candidatas, escolherPartes, proporArvore,
  lerCsvPartes, escreverCsvPartes, vetorExplosaoParte, ladoPeloNome, type No, type LinhaParte,
} from '../src/partes';

/** Atlas sintético: P = {a..f}; A={a,b}, B={c,d}, C={e}, W="wall of P"={f}, X=P inteiro, Y={a,g}, Z={b}, Q="cavity of P"={c}. */
function atlas() {
  const partof = new Map<string, Set<string>>([
    ['FMA1', new Set(['a', 'b', 'c', 'd', 'e', 'f'])],
    ['FMA10', new Set(['a', 'b'])], ['FMA11', new Set(['c', 'd'])], ['FMA12', new Set(['e'])],
    ['FMA13', new Set(['f'])], ['FMA14', new Set(['a', 'b', 'c', 'd', 'e', 'f'])], ['FMA15', new Set(['a', 'g'])],
    ['FMA16', new Set(['b'])], ['FMA17', new Set(['c'])],
    ['FMA2', new Set(['g', 'h'])],
  ]);
  const isa = new Map<string, Set<string>>([['FMA11', new Set(['c', 'd'])], ['FMA18', new Set(['h'])]]);
  const nomes = new Map<string, string>([
    ['FMA1', 'heart'], ['FMA10', 'left ventricle'], ['FMA11', 'right ventricle'], ['FMA12', 'coronary sinus'],
    ['FMA13', 'wall of heart'], ['FMA14', 'heart proper'], ['FMA15', 'weird'], ['FMA16', 'mitral valve'], ['FMA17', 'cavity of heart'],
    ['FMA2', 'liver'], ['FMA18', 'left lobe of liver'],
  ]);
  return indexarAtlas(unirConceitos({ partof, isa }, nomes));
}
const pecas = [
  { fmaId: 'FMA1', elementos: new Set(['a', 'b', 'c', 'd', 'e', 'f']) },
  { fmaId: 'FMA2', elementos: new Set(['g', 'h']) },
  { fmaId: 'FMA3', elementos: new Set(['f', 'z']) }, // f também está em FMA3 → não é próprio de FMA1
];
const no = (fmaId: string, elementos: Set<string>, nivel = 1, raiz = fmaId): No => ({ fmaId, nome: fmaId, nomePt: '', elementos, nivel, raiz });

describe('lista negra', () => {
  it('casa palavras inteiras, sem maiúsculas, e não casa nomes anatômicos comuns', () => {
    for (const n of ['wall of heart', 'Cavity of left ventricle', 'myocardial zone 12', 'left side of heart', 'inflow part of right ventricle', 'parenchyma of pancreas']) expect(NAO_VISUAL.test(n)).toBe(true);
    for (const n of ['left ventricle', 'mitral valve', 'right coronary artery', 'left lobe of liver', 'zygomatic bone']) expect(NAO_VISUAL.test(n)).toBe(false);
  });
});

describe('unirConceitos e elementosProprios', () => {
  it('une as duas árvores por FMA e guarda o nome', () => {
    const a = atlas();
    expect(a.conceitos.get('FMA11')!.elementos).toEqual(new Set(['c', 'd']));
    expect(a.conceitos.get('FMA18')!.nome).toBe('left lobe of liver');
    expect(a.porElemento.get('c')).toEqual(new Set(['FMA1', 'FMA11', 'FMA14', 'FMA17']));
  });
  it('elemento em duas peças de nível 1 não é próprio de nenhuma', () => {
    const p = elementosProprios(pecas);
    expect(p.get('FMA1')).toEqual(new Set(['a', 'b', 'c', 'd', 'e']));
    expect(p.get('FMA3')).toEqual(new Set(['z']));
  });
});

describe('candidatas', () => {
  it('subconjunto estrito dos próprios, sem lista negra, sem o próprio nó; ordenadas por tamanho e id', () => {
    const a = atlas();
    const proprios = elementosProprios(pecas).get('FMA1')!;
    const c = candidatas(proprios, a, new Set(['FMA1']));
    expect(c.map((x) => x.fmaId)).toEqual(['FMA10', 'FMA11', 'FMA12', 'FMA16']); // FMA13 (f não é próprio), FMA14 (igual/ maior + 'proper'), FMA15 (g fora), FMA17 (cavity)
  });
});

describe('escolherPartes', () => {
  const a = atlas();
  const proprios = elementosProprios(pecas).get('FMA1')!;
  it('guloso: maiores primeiro, sem repetir elemento; o que sobra vira resto', () => {
    const r = escolherPartes(no('FMA1', proprios), proprios, candidatas(proprios, a, new Set(['FMA1'])), [], a);
    expect(r.partes.map((p) => p.fmaId)).toEqual(['FMA10', 'FMA11', 'FMA12']); // FMA16 {b} sobrepõe FMA10
    expect(r.resto).toEqual(new Set());
  });
  it('revisado entra mesmo sobrepondo; excluida sai; revisado fora do pai falha alto', () => {
    const cur: LinhaParte[] = [
      { paiFmaId: 'FMA1', fmaId: 'FMA16', nomeEn: 'mitral valve', nomePt: 'Valva mitral', nomeLeigo: '', status: 'revisado' },
      { paiFmaId: 'FMA1', fmaId: 'FMA12', nomeEn: 'coronary sinus', nomePt: '', nomeLeigo: '', status: 'excluida' },
    ];
    const r = escolherPartes(no('FMA1', proprios), proprios, candidatas(proprios, a, new Set(['FMA1'])), cur, a);
    expect(r.partes.map((p) => p.fmaId)).toEqual(['FMA10', 'FMA11', 'FMA16']);
    expect(r.resto).toEqual(new Set(['e']));
    const ruim: LinhaParte[] = [{ paiFmaId: 'FMA1', fmaId: 'FMA15', nomeEn: 'weird', nomePt: '', nomeLeigo: '', status: 'revisado' }];
    expect(() => escolherPartes(no('FMA1', proprios), proprios, [], ruim, a)).toThrow(/FMA15.*não é subconjunto/);
    const inexistente: LinhaParte[] = [{ paiFmaId: 'FMA1', fmaId: 'FMA999', nomeEn: '', nomePt: '', nomeLeigo: '', status: 'revisado' }];
    expect(() => escolherPartes(no('FMA1', proprios), proprios, [], inexistente, a)).toThrow(/FMA999.*não existe/);
  });
});

describe('proporArvore', () => {
  it('gera linhas auto por pai, resto quando sobra, recursão, preserva curadoria e nomes já rascunhados', () => {
    const a = atlas();
    const proprios = elementosProprios(pecas);
    const raizes = pecas.map((p) => no(p.fmaId, p.elementos));
    const cur: LinhaParte[] = [
      { paiFmaId: 'FMA1', fmaId: 'FMA10', nomeEn: 'left ventricle', nomePt: 'Ventrículo esquerdo', nomeLeigo: 'câmara', status: 'auto' },
      { paiFmaId: 'FMA1', fmaId: 'FMA12', nomeEn: 'coronary sinus', nomePt: '', nomeLeigo: '', status: 'excluida' },
      { paiFmaId: 'FMA1', fmaId: 'FMA77', nomeEn: 'órfã', nomePt: 'x', nomeLeigo: '', status: 'auto' },
    ];
    const linhas = proporArvore(raizes, a, proprios, cur);
    const doCoracao = linhas.filter((l) => l.paiFmaId === 'FMA1');
    expect(doCoracao.map((l) => [l.fmaId, l.status])).toEqual([['FMA10', 'auto'], ['FMA11', 'auto'], ['FMA1-resto', 'auto'], ['FMA12', 'excluida']]);
    expect(doCoracao[0].nomePt).toBe('Ventrículo esquerdo'); // rascunho preservado
    expect(doCoracao[2].nomePt).toMatch(/^Outras partes de /);
    expect(linhas.some((l) => l.fmaId === 'FMA77')).toBe(false); // órfã auto removida
    // FMA10 {a,b} tem só FMA16 {b} dentro → 1 parte + resto {a} = 2 → tem detalhe (nível 2)
    expect(linhas.filter((l) => l.paiFmaId === 'FMA10').map((l) => l.fmaId)).toEqual(['FMA16', 'FMA10-resto']);
    // FMA2 {g,h}: só FMA18 {h} → 1 parte + resto {g} = 2 → detalhe
    expect(linhas.filter((l) => l.paiFmaId === 'FMA2').map((l) => l.fmaId)).toEqual(['FMA18', 'FMA2-resto']);
    // FMA3 {f,z}: próprios {z} → sem candidatas → sem detalhe
    expect(linhas.some((l) => l.paiFmaId === 'FMA3')).toBe(false);
  });
  it('resto marcado excluida não volta nem duplica a linha; curadoria de pai sem detalhe é preservada; CSV relê', () => {
    const a = atlas(); const proprios = elementosProprios(pecas);
    const raizes = pecas.map((p) => no(p.fmaId, p.elementos));
    const cur: LinhaParte[] = [
      { paiFmaId: 'FMA1', fmaId: 'FMA12', nomeEn: 'coronary sinus', nomePt: '', nomeLeigo: '', status: 'excluida' },
      { paiFmaId: 'FMA1', fmaId: 'FMA1-resto', nomeEn: 'rest of heart', nomePt: '', nomeLeigo: '', status: 'excluida' },
      { paiFmaId: 'FMA10', fmaId: 'FMA10-resto', nomeEn: 'rest of left ventricle', nomePt: '', nomeLeigo: '', status: 'excluida' },
      { paiFmaId: 'FMA3', fmaId: 'FMA77', nomeEn: 'x', nomePt: '', nomeLeigo: '', status: 'excluida' },
    ];
    const linhas = proporArvore(raizes, a, proprios, cur);
    expect(linhas.filter((l) => l.paiFmaId === 'FMA1').map((l) => [l.fmaId, l.status])).toEqual([['FMA10', 'auto'], ['FMA11', 'auto'], ['FMA12', 'excluida'], ['FMA1-resto', 'excluida']]);
    // FMA10 {a,b}: 1 parte + resto excluído = 1 → sem detalhe; a exclusão fica no CSV mesmo assim
    expect(linhas.filter((l) => l.paiFmaId === 'FMA10').map((l) => [l.fmaId, l.status])).toEqual([['FMA10-resto', 'excluida']]);
    expect(linhas.filter((l) => l.paiFmaId === 'FMA3').map((l) => [l.fmaId, l.status])).toEqual([['FMA77', 'excluida']]);
    expect(() => lerCsvPartes(escreverCsvPartes(linhas))).not.toThrow();
  });
  it('para no nível máximo', () => {
    const a = atlas(); const proprios = elementosProprios(pecas);
    const linhas = proporArvore([no('FMA1', pecas[0].elementos, 5)], a, proprios, []);
    expect(linhas).toEqual([]);
  });
});

describe('CSV de partes', () => {
  it('ida e volta com aspas, e rejeita status/ids inválidos', () => {
    const linhas: LinhaParte[] = [
      { paiFmaId: 'FMA1', fmaId: 'FMA10', nomeEn: 'left ventricle', nomePt: 'Ventrículo esquerdo', nomeLeigo: 'câmara que bombeia, esquerda', status: 'auto' },
      { paiFmaId: 'FMA1', fmaId: 'FMA1-resto', nomeEn: 'rest of heart', nomePt: 'Outras partes de Coração', nomeLeigo: '', status: 'revisado' },
    ];
    const texto = escreverCsvPartes(linhas);
    expect(texto.split('\n')[0]).toBe('paiFmaId,fmaId,nomeEn,nomePt,nomeLeigo,status');
    expect(lerCsvPartes(texto)).toEqual(linhas);
    expect(() => lerCsvPartes('paiFmaId,fmaId,nomeEn,nomePt,nomeLeigo,status\nFMA1,FMA2,x,,,talvez\n')).toThrow(/status/);
    expect(() => lerCsvPartes('paiFmaId,fmaId,nomeEn,nomePt,nomeLeigo,status\nFMA1,abc,x,,,auto\n')).toThrow(/fmaId/);
    expect(() => lerCsvPartes('paiFmaId,fmaId,nomeEn,nomePt,nomeLeigo,status\nFMA1,FMA2,x,,,auto\nFMA1,FMA2,x,,,auto\n')).toThrow(/duplicad/);
  });
});

describe('vetorExplosaoParte e ladoPeloNome', () => {
  it('radial a partir do centro do pai, com alcance = diagonal do pai / 0,4; no centro sai para +z', () => {
    const bbox = { min: [0, 0, 0] as [number, number, number], max: [0.3, 0.4, 0] as [number, number, number] }; // diagonal 0,5
    const v = vetorExplosaoParte([0.15, 0.2, 0], bbox, [0.25, 0.2, 0]);
    expect(v[0]).toBeCloseTo(1.25, 5); expect(v[1]).toBeCloseTo(0, 5); expect(v[2]).toBeCloseTo(0, 5);
    expect(vetorExplosaoParte([0.15, 0.2, 0], bbox, [0.15, 0.2, 0])).toEqual([0, 0, 1.25]);
  });
  it('lado pelo nome do atlas, senão o do pai', () => {
    expect(ladoPeloNome('right coronary artery', '-')).toBe('D');
    expect(ladoPeloNome('Left ventricle', '-')).toBe('E');
    expect(ladoPeloNome('mitral valve', 'E')).toBe('E');
  });
});
