import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useLoja } from './store';
import { ESTADO_INICIAL, MAX_HISTORICO } from './schema';

const loja = () => useLoja.getState();
beforeEach(() => useLoja.getState().reiniciar());

describe('loja: histórico', () => {
  it('aplicar registra o estado anterior; desfazer/refazer navegam', () => {
    loja().definirExplosao(0.4);
    expect(loja().estado.explosao).toBe(0.4);
    expect(loja().historico).toHaveLength(1);
    loja().desfazer();
    expect(loja().estado.explosao).toBe(0);
    expect(loja().futuro).toHaveLength(1);
    loja().refazer();
    expect(loja().estado.explosao).toBe(0.4);
  });
  it('uma ação nova apaga o futuro', () => {
    loja().definirExplosao(0.4); loja().desfazer(); loja().definirExplosao(0.2);
    expect(loja().futuro).toEqual([]);
  });
  it('o histórico é limitado a MAX_HISTORICO', () => {
    for (let i = 1; i <= MAX_HISTORICO + 10; i++) loja().definirExplosao((i % 10) / 10);
    expect(loja().historico).toHaveLength(MAX_HISTORICO);
  });
  it('aplicar com historico:false não registra (slider em movimento, câmera)', () => {
    loja().definirExplosao(0.3, { historico: false });
    loja().definirCamera([1, 1, 1], [0, 0, 0]);
    expect(loja().historico).toEqual([]);
    expect(loja().estado.camera.pos).toEqual([1, 1, 1]);
  });
  it('desfazer sem histórico e refazer sem futuro são no-ops', () => {
    loja().desfazer(); loja().refazer();
    expect(loja().estado).toEqual(ESTADO_INICIAL);
  });
});

describe('loja: peças', () => {
  it('soltar/encaixar mantêm uma entrada por peça', () => {
    loja().soltar('FMA7088', [0.3, 1.2, 0.4]);
    loja().soltar('FMA7088', [0.5, 1.2, 0.4]);
    expect(loja().estado.soltas).toEqual([{ fmaId: 'FMA7088', pos: [0.5, 1.2, 0.4] }]);
    loja().encaixar('FMA7088');
    expect(loja().estado.soltas).toEqual([]);
  });
  it('remontarTudo limpa soltas e zera explosão numa única entrada do histórico', () => {
    loja().soltar('FMA7088', [0.3, 1.2, 0.4]); loja().definirExplosao(0.8);
    const antes = loja().historico.length;
    loja().remontarTudo();
    expect(loja().estado.soltas).toEqual([]); expect(loja().estado.explosao).toBe(0);
    expect(loja().historico).toHaveLength(antes + 1);
  });
  it('destacar, anotar, isolar, alternarOculta', () => {
    loja().destacar('FMA1', '#ffd166'); loja().destacar('FMA1', '#06d6a0');
    expect(loja().estado.destacadas).toEqual([{ fmaId: 'FMA1', cor: '#06d6a0' }]);
    loja().destacar('FMA1', null);
    expect(loja().estado.destacadas).toEqual([]);
    loja().anotar('FMA1', 'sem nome do paciente'); loja().anotar('FMA1', '');
    expect(loja().estado.notas).toEqual([]);
    loja().anotar('FMA1', 'x'.repeat(300));
    expect(loja().estado.notas[0].texto).toHaveLength(280);
    loja().isolar('FMA1'); expect(loja().estado.isolada).toBe('FMA1');
    loja().isolar(null); expect(loja().estado.isolada).toBeNull();
    loja().alternarOculta('FMA2'); loja().alternarOculta('FMA3'); loja().alternarOculta('FMA2');
    expect(loja().estado.ocultas).toEqual(['FMA3']);
  });
  it('definirOpacidade valida o intervalo', () => {
    loja().definirOpacidade('pele', 0.25);
    expect(loja().estado.opacidade.pele).toBe(0.25);
    expect(() => loja().definirOpacidade('pele', 2)).toThrow();
  });
  it('registrarSnapshot: um gesto de slider vira uma única entrada, com o estado de antes', () => {
    const antes = loja().estado;
    loja().definirExplosao(0.1, { historico: false }); loja().definirExplosao(0.2, { historico: false }); loja().definirExplosao(0.3, { historico: false });
    loja().registrarSnapshot(antes);
    expect(loja().historico).toEqual([antes]);
    loja().desfazer();
    expect(loja().estado.explosao).toBe(0);
    loja().registrarSnapshot(loja().estado);      // nada mudou desde o snapshot: não registra
    expect(loja().historico).toEqual([]);
  });
  it('estado transitório não entra no histórico nem no estado', () => {
    loja().selecionar('FMA1'); loja().passarMouse('FMA2'); loja().definirArrastando('FMA1');
    expect(loja().selecionada).toBe('FMA1'); expect(loja().hover).toBe('FMA2'); expect(loja().arrastando).toBe('FMA1');
    expect(loja().historico).toEqual([]);
    expect('selecionada' in loja().estado).toBe(false);
  });
});

describe('loja: modo detalhe', () => {
  const peca = { fmaId: 'FMA1', nomeLatim: 'Cor', nomePt: 'Coração', nomeLeigo: 'coração', sistema: 'cardiovascular' as const, lado: '-' as const, glb: 'cardiovascular/FMA1.glb', bytes: 1, triangulos: 1, elementos: 1, numPartes: 1, bbox: { min: [0, 1, 0] as [number, number, number], max: [0.1, 1.1, 0.1] as [number, number, number] }, centro: [0.05, 1.05, 0.05] as [number, number, number], vetorExplosao: [0, 0, 1] as [number, number, number] };
  const json = { versao: 1, paiFmaId: 'FMA1', partes: [{ ...peca, fmaId: 'FMA10', glb: 'partes/FMA1/FMA10.glb', paiFmaId: 'FMA1', nivel: 2, status: 'auto', numPartes: 0 }] };
  /** `carregarManifestoPartes` confere que `paiFmaId` do JSON é o pedido: o mock responde com o pai que está na URL. */
  const mockFetch = () => vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => ({ ...json, paiFmaId: /partes\/(.+)\.json/.exec(url)?.[1] ?? '' }) })));
  afterEach(() => vi.unstubAllGlobals());
  it('abrirPartes carrega o JSON, encaixa, empilha, tira a seleção, enquadra e registra histórico', async () => {
    mockFetch();
    loja().soltar('FMA1', [0.3, 0, 0]); loja().selecionar('FMA1');
    expect(await loja().abrirPartes(peca)).toBe(true);
    expect(loja().estado.detalhe).toEqual(['FMA1']);
    expect(loja().estado.soltas).toEqual([]);
    expect(loja().selecionada).toBeNull();
    expect(loja().presetCamera).toBe('livre');
    expect(loja().estado.camera.alvo).toEqual(peca.centro);
    expect(Array.isArray(loja().partes.FMA1)).toBe(true);
    loja().desfazer();
    expect(loja().estado.detalhe).toEqual([]);
  });
  it('JSON indisponível: registra erro e não muda o estado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    expect(await loja().abrirPartes(peca)).toBe(false);
    expect(loja().partes.FMA1).toBe('erro');
    expect(loja().estado.detalhe).toEqual([]);
    expect(loja().historico).toEqual([]);
  });
  it('fecharPartes(n) mantém n níveis', async () => {
    mockFetch();
    await loja().abrirPartes(peca);
    await loja().abrirPartes({ ...peca, fmaId: 'FMA10' });
    expect(loja().estado.detalhe).toEqual(['FMA1', 'FMA10']);
    loja().fecharPartes(1);
    expect(loja().estado.detalhe).toEqual(['FMA1']);
    loja().fecharPartes(0);
    expect(loja().estado.detalhe).toEqual([]);
  });
});
