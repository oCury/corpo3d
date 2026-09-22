import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MARCOS, mascaraCouroCabeludo, mascaraSobrancelha, mascaraPelosCorpo, alturaLinhaDoCabelo } from './pelos';
import type { Vec3 } from '@/lib/estado/store';

/** Pontos sobre (ou perto de) a pele do atlas, em metros. Ver spec §5. */
const PONTOS: Record<string, { p: Vec3; couro: 'dentro' | 'fora'; sobrancelha: 'dentro' | 'fora'; corpo: 'dentro' | 'fora' }> = {
  'topo da cabeça':               { p: [0, 1.63, 0.08],       couro: 'dentro', sobrancelha: 'fora', corpo: 'fora' },
  'nuca':                         { p: [0, 1.5, -0.005],      couro: 'dentro', sobrancelha: 'fora', corpo: 'fora' },
  'testa acima da sobrancelha':   { p: [0, 1.575, 0.185],     couro: 'fora',   sobrancelha: 'fora', corpo: 'fora' },
  'bochecha':                     { p: [0.05, 1.49, 0.15],    couro: 'fora',   sobrancelha: 'fora', corpo: 'fora' },
  'orelha':                       { p: [0.075, 1.525, 0.085], couro: 'fora',   sobrancelha: 'fora', corpo: 'fora' },
  'centro da sobrancelha esq.':   { p: [0.029, 1.54, 0.178],  couro: 'fora',   sobrancelha: 'dentro', corpo: 'fora' },
  'centro da sobrancelha dir.':   { p: [-0.029, 1.54, 0.178], couro: 'fora',   sobrancelha: 'dentro', corpo: 'fora' },
  'centro do olho':               { p: [0.029, 1.518, 0.156], couro: 'fora',   sobrancelha: 'fora', corpo: 'fora' },
  'peito':                        { p: [0, 1.3, 0.12],        couro: 'fora',   sobrancelha: 'fora', corpo: 'dentro' },
  'abdômen':                      { p: [0, 1.1, 0.12],        couro: 'fora',   sobrancelha: 'fora', corpo: 'fora' },
  'antebraço':                    { p: [0.28, 0.92, 0.09],    couro: 'fora',   sobrancelha: 'fora', corpo: 'dentro' },
  'coxa':                         { p: [0.1, 0.7, 0.1],       couro: 'fora',   sobrancelha: 'fora', corpo: 'fora' },
  'canela':                       { p: [0.1, 0.3, 0.1],       couro: 'fora',   sobrancelha: 'fora', corpo: 'dentro' },
};

const esperar = (valor: number, lado: 'dentro' | 'fora') =>
  lado === 'dentro' ? expect(valor).toBeGreaterThanOrEqual(0.9) : expect(valor).toBeLessThanOrEqual(0.1);

describe('máscaras geométricas dos pelos', () => {
  for (const [nome, c] of Object.entries(PONTOS)) {
    it(`${nome}: couro ${c.couro}, sobrancelha ${c.sobrancelha}, corpo ${c.corpo}`, () => {
      esperar(mascaraCouroCabeludo(c.p), c.couro);
      esperar(mascaraSobrancelha(c.p), c.sobrancelha);
      esperar(mascaraPelosCorpo(c.p), c.corpo);
    });
  }
  it('a linha do cabelo é mais alta na testa que na têmpora, e mais baixa na nuca', () => {
    const [cx, , cz] = MARCOS.centroCabeca;
    const testa = alturaLinhaDoCabelo(cx, cz + 0.1);
    const tempora = alturaLinhaDoCabelo(cx + 0.1, cz);
    const nuca = alturaLinhaDoCabelo(cx, cz - 0.1);
    expect(testa).toBeGreaterThan(tempora);
    expect(tempora).toBeGreaterThan(nuca);
  });
  it('as máscaras ficam em 0–1 numa varredura grossa do corpo', () => {
    for (let y = -0.1; y <= 1.7; y += 0.05)
      for (let x = -0.35; x <= 0.35; x += 0.05)
        for (let z = -0.05; z <= 0.25; z += 0.05)
          for (const m of [mascaraCouroCabeludo, mascaraSobrancelha, mascaraPelosCorpo]) {
            const v = m([x, y, z]);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
          }
  });
});

const MANIFESTO = fileURLToPath(new URL('../../../public/models/manifest.json', import.meta.url));

describe('marcos contra o manifesto', () => {
  it.skipIf(!existsSync(MANIFESTO))(
    'centro do globo esquerdo a < 2 mm de MARCOS e topo da pele a < 5 mm (se este teste PULOU, rode `pnpm --filter @corpo3d/pipeline construir`)',
    () => {
      const m = JSON.parse(readFileSync(MANIFESTO, 'utf8')) as { pecas: { fmaId: string; centro: Vec3; bbox: { max: Vec3 } }[] };
      const olho = m.pecas.find((p) => p.fmaId === 'FMA12515');
      const pele = m.pecas.find((p) => p.fmaId === 'FMA7163');
      expect(olho, 'FMA12515 no manifesto').toBeDefined();
      expect(pele, 'FMA7163 no manifesto').toBeDefined();
      const dist = Math.hypot(...(olho!.centro.map((v, i) => v - MARCOS.olhoEsquerdo[i]) as Vec3));
      expect(dist).toBeLessThan(0.002);
      expect(Math.abs(pele!.bbox.max[1] - MARCOS.topoPele)).toBeLessThan(0.005);
    },
  );
});
