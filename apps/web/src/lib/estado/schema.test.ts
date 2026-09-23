import { describe, it, expect } from 'vitest';
import { EstadoCenaSchema, ESTADO_INICIAL, serializar, desserializar, type EstadoCena } from './schema';

describe('EstadoCena', () => {
  it('o estado inicial é válido e tem opacidade 1 para os 12 sistemas', () => {
    expect(EstadoCenaSchema.parse(ESTADO_INICIAL)).toEqual(ESTADO_INICIAL);
    expect(Object.keys(ESTADO_INICIAL.opacidade)).toHaveLength(12);
    expect(Object.values(ESTADO_INICIAL.opacidade).every((v) => v === 1)).toBe(true);
    expect(ESTADO_INICIAL.explosao).toBe(0);
  });
  it('rejeita nota com mais de 280 caracteres, opacidade fora de 0–1 e versão desconhecida', () => {
    expect(EstadoCenaSchema.safeParse({ ...ESTADO_INICIAL, notas: [{ fmaId: 'FMA1', texto: 'x'.repeat(281) }] }).success).toBe(false);
    expect(EstadoCenaSchema.safeParse({ ...ESTADO_INICIAL, opacidade: { ...ESTADO_INICIAL.opacidade, pele: 1.5 } }).success).toBe(false);
    expect(EstadoCenaSchema.safeParse({ ...ESTADO_INICIAL, v: 2 }).success).toBe(false);
    expect(EstadoCenaSchema.safeParse({ ...ESTADO_INICIAL, opacidade: { pele: 1 } }).success).toBe(false); // faltam sistemas
  });
  it('serializa e desserializa sem perda', () => {
    const e: EstadoCena = { ...ESTADO_INICIAL, soltas: [{ fmaId: 'FMA7088', pos: [0.3, 1.2, 0.4] }], explosao: 0.5, isolada: 'FMA7088' };
    expect(desserializar(serializar(e))).toEqual(e);
  });
  it('desserializar rejeita JSON inválido com erro legível', () => {
    expect(() => desserializar('{"v":1}')).toThrow(/estado inválido/);
    expect(() => desserializar('não é json')).toThrow(/estado inválido/);
  });
  it('aceita ids -resto e a pilha de detalhe; link antigo sem detalhe vira []', () => {
    const e: EstadoCena = { ...ESTADO_INICIAL, detalhe: ['FMA7088', 'FMA7101'], ocultas: ['FMA7088-resto'] };
    expect(desserializar(serializar(e))).toEqual(e);
    const semDetalhe = JSON.parse(serializar(ESTADO_INICIAL)) as Record<string, unknown>;
    delete semDetalhe.detalhe;
    expect(desserializar(JSON.stringify(semDetalhe)).detalhe).toEqual([]);
    expect(EstadoCenaSchema.safeParse({ ...ESTADO_INICIAL, detalhe: ['coração'] }).success).toBe(false);
    expect(EstadoCenaSchema.safeParse({ ...ESTADO_INICIAL, ocultas: ['FMA1-lixo'] }).success).toBe(false);
  });
});
