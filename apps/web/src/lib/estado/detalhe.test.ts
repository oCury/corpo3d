import { describe, it, expect } from 'vitest';
import { pecasVisiveis, dentroDoDetalhe, type PartesCarregadas } from './detalhe';
import { ESTADO_INICIAL } from './schema';
import type { Manifesto, PartePeca, PecaManifesto } from '@/lib/manifesto';

const peca = (fmaId: string, sistema: PecaManifesto['sistema'] = 'cardiovascular', numPartes = 0): PecaManifesto => ({
  fmaId, nomeLatim: fmaId, nomePt: fmaId, nomeLeigo: fmaId, sistema, lado: '-', glb: `${sistema}/${fmaId}.glb`, bytes: 1, triangulos: 1, elementos: 1,
  numPartes, bbox: { min: [0, 0, 0], max: [1, 1, 1] }, centro: [0.5, 0.5, 0.5], vetorExplosao: [0, 0, 1],
});
const parte = (fmaId: string, paiFmaId: string, numPartes = 0): PartePeca => ({ ...peca(fmaId, 'cardiovascular', numPartes), glb: `partes/${paiFmaId}/${fmaId}.glb`, paiFmaId, nivel: 2, status: 'auto' });
const manifesto: Manifesto = { versao: 1, geradoEm: '', fonte: '', bytesTotal: 3, sistemas: ['cardiovascular', 'pele'], pecas: [peca('FMA1', 'cardiovascular', 2), peca('FMA2', 'pele'), peca('FMA3')] };
const ids = (l: PecaManifesto[]) => l.map((p) => p.fmaId);

describe('pecasVisiveis', () => {
  it('sem detalhe: as peças, com os filtros de opacidade e ocultas', () => {
    expect(ids(pecasVisiveis(manifesto, {}, ESTADO_INICIAL))).toEqual(['FMA1', 'FMA2', 'FMA3']);
    expect(ids(pecasVisiveis(manifesto, {}, { ...ESTADO_INICIAL, ocultas: ['FMA2'] }))).toEqual(['FMA1', 'FMA3']);
    expect(ids(pecasVisiveis(manifesto, {}, { ...ESTADO_INICIAL, opacidade: { ...ESTADO_INICIAL.opacidade, pele: 0 } }))).toEqual(['FMA1', 'FMA3']);
  });
  it('nó aberto cujas partes não chegaram continua visível; ao chegarem, some e as partes entram', () => {
    const e = { ...ESTADO_INICIAL, detalhe: ['FMA1'] };
    expect(ids(pecasVisiveis(manifesto, { FMA1: 'carregando' }, e))).toEqual(['FMA1', 'FMA2', 'FMA3']);
    const partes: PartesCarregadas = { FMA1: [parte('FMA10', 'FMA1', 1), parte('FMA11', 'FMA1')] };
    expect(ids(pecasVisiveis(manifesto, partes, e))).toEqual(['FMA2', 'FMA3', 'FMA10', 'FMA11']);
  });
  it('dois níveis: a parte aberta some e as partes dela entram; parte oculta some', () => {
    const partes: PartesCarregadas = { FMA1: [parte('FMA10', 'FMA1', 1), parte('FMA11', 'FMA1')], FMA10: [parte('FMA100', 'FMA10'), parte('FMA10-resto', 'FMA10')] };
    const e = { ...ESTADO_INICIAL, detalhe: ['FMA1', 'FMA10'] };
    expect(ids(pecasVisiveis(manifesto, partes, e))).toEqual(['FMA2', 'FMA3', 'FMA11', 'FMA100', 'FMA10-resto']);
    expect(ids(pecasVisiveis(manifesto, partes, { ...e, ocultas: ['FMA10-resto'] }))).toEqual(['FMA2', 'FMA3', 'FMA11', 'FMA100']);
    // segundo nível ainda carregando: FMA10 fica visível
    expect(ids(pecasVisiveis(manifesto, { FMA1: partes.FMA1, FMA10: 'carregando' }, e))).toEqual(['FMA2', 'FMA3', 'FMA10', 'FMA11']);
  });
});

describe('dentroDoDetalhe', () => {
  it('null sem detalhe ou sem partes carregadas; senão os ids das partes do nó mais fundo carregado', () => {
    expect(dentroDoDetalhe({}, ESTADO_INICIAL)).toBeNull();
    expect(dentroDoDetalhe({ FMA1: 'carregando' }, { ...ESTADO_INICIAL, detalhe: ['FMA1'] })).toBeNull();
    const partes: PartesCarregadas = { FMA1: [parte('FMA10', 'FMA1'), parte('FMA11', 'FMA1')] };
    const e = { ...ESTADO_INICIAL, detalhe: ['FMA1', 'FMA10'] }; // FMA10 sem partes carregadas → o nó mais fundo carregado é FMA1
    expect(dentroDoDetalhe(partes, e)).toEqual(new Set(['FMA10', 'FMA11']));
    expect(dentroDoDetalhe(partes, e)).toBe(dentroDoDetalhe(partes, e)); // memoizado
  });
});
