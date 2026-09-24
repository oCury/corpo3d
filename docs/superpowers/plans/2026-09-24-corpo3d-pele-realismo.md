# Corpo3D — pele: oclusão cozida, luz neutra e fim dos pontinhos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pele deixa de ter pontinhos escuros (inflar sem dobrar + normais da geometria final), ganha sombra de contato (oclusão ambiente cozida por vértice no pipeline, aplicada só à luz indireta no shader) e passa a ser iluminada por um estúdio neutro (tom `Neutral`, preenchimento e contorno).

**Architecture:** (1) Pipeline: `inflar.ts` desloca ao longo das normais e recua onde a superfície dobraria; `glb.ts` passa a calcular as normais gravadas **depois** de inflar e confinar; `oclusao.ts` lança 48 raios por vértice contra o BVH da própria malha e grava `_OCLUSAO` (Uint8 normalizado, 0 = livre); `portao.ts` confere normais e oclusão em toda GLB. (2) Web: `pele.ts` lê `_oclusao` e multiplica só a luz indireta por `1 − oclusão × força`; `luz.ts` guarda as constantes do estúdio; `Cena.tsx` monta luzes, tom e o gancho `window.__oclusao` (dev). (3) E2E `realismo.spec.ts` mede pontos isolados e prova que a oclusão escurece só as dobras.

**Tech Stack:** o que já existe: pipeline TypeScript (tsx, gltf-transform 4.5, meshoptimizer, three-mesh-bvh 0.9, Vitest), web Next 16 + R3F 9 + drei 10.7 + three 0.186 + Playwright.

**Spec:** `docs/superpowers/specs/2026-09-24-corpo3d-pele-realismo-design.md`. Branch `feat/pele-realismo` (já criada com o spec).

**Fatos verificados em 23–24/09 que o código abaixo assume:**
- `glb.ts`: `escreverGlb(g, saida, { razao, nome, inflarM?, confinarEm?, devolverGeometria? })` faz weld → simplify → `normaisSuaves(pos, idx)` → infla `final[i] += n[i] * inflarM` → `confinarDentro(final, …)` → grava NORMAL = as normais de ANTES → prune → meshopt. `getIo()` é privada e registra encoder+decoder meshopt. `EstatisticasGlb` tem `bytes, triangulosAntes, triangulosDepois, bbox, centro, geometriaFinal?, confinados?`.
- `normais.ts`: `normaisSuaves(pos, idx): Float32Array` (soma dos produtos vetoriais, normalizada; vértice órfão fica 0,0,0).
- `confinar.ts` monta `MeshBVH` de `three-mesh-bvh` sobre `BufferGeometry` com `BufferAttribute(Float32Array, 3)` e índice `BufferAttribute(Uint32Array, 1)`. `raycastFirst(ray, materialOrSide?, near?, far?): Intersection | null` existe no 0.9.
- `constantes.ts` já tem `FMA_PELE = 'FMA7163'`, `ORCAMENTO_BYTES_POR_PECA`, `DIR_SAIDA`, `DIR_PARTES`.
- `construir.ts` chama `escreverGlb` uma vez por peça com `inflarM`, `confinarEm`, `devolverGeometria: p.fmaId === FMA_PELE`; `construir-partes.ts` chama com `{ razao, nome }`.
- `portao.ts` tem `verificarOrcamento`, `verificarPartes` e um bloco CLI que já lê `manifest.json` e os JSONs de partes (`jsons`), e monta `problemas`.
- Testes existentes usam `SphereGeometry` do three como malha sintética (`confinar.test.ts`) e leem GLBs com `NodeIO` + `MeshoptDecoder` (`glb.test.ts`). Hoje: 47 testes no pipeline, 61 no web.
- Web: `MaterialPele` (`pele.ts`) injeta GLSL em `common`, `begin_vertex`, `color_fragment`, `roughnessmap_fragment`, `normal_fragment_maps`; `customProgramCacheKey` = `'pele-procedural-v2'`. `Cena.tsx`: `<Canvas shadows frameloop="demand" dpr={[1, 1.5]} camera={…} gl={{ antialias: true, powerPreference: 'high-performance' }} …>`, `<Environment files="/hdri/studio_small_09_1k.hdr" />`, uma `<directionalLight position={[1.5, 3, 2]} intensity={1.2} castShadow …>`; `ExporCena` expõe `window.__cena` fora de produção.
- Chunk `aomap_fragment` do three 0.186 usa `geometryNormal`, `geometryViewDir`, `material.roughness`, `computeSpecularOcclusion`, `clearcoatSpecularIndirect`, `sheenSpecularIndirect` sob `USE_CLEARCOAT`/`USE_SHEEN`/`USE_ENVMAP && STANDARD`.
- Playwright: `e2e/util.ts` exporta `aguardarModeloRenderizado(page, alvo?: Locator | Page)` e `capturarSePossivel(page: Page, path)` (a Tarefa C alarga para `Page | Locator`); `Locator` já está importado lá; projetos `desktop` (1440×900), `tablet` (768×1024), `celular` (320×640); o fundo do canvas é `#101214`.
- Medição de referência (GLB da pele hoje): 2.108 vértices com normal gravada oposta à média das faces; ≈ 1.000 pontos escuros isolados na vista de frente.

---

## Estrutura de arquivos

```
packages/pipeline/src/constantes.ts        # + LIMIAR_DOBRA, MAX_REDUCOES_DOBRA, AMOSTRAS_OCLUSAO, ALCANCE_OCLUSAO_M, AFASTAMENTO_RAIO_M, PECAS_COM_OCLUSAO, ORCAMENTO_SEGUNDOS_OCLUSAO, OCLUSAO_*
packages/pipeline/src/inflar.ts            # NOVO — vizinhos, verticesDobrados, inflarSemDobrar
packages/pipeline/src/oclusao.ts           # NOVO — direcoesHemisferio, oclusaoPorVertice
packages/pipeline/src/glb.ts               # ordem nova; opção oclusao; _OCLUSAO; lerGlb
packages/pipeline/src/construir.ts         # oclusao para PECAS_COM_OCLUSAO; log
packages/pipeline/src/portao.ts            # + verificarNormais, verificarOclusao, CLI assíncrono
packages/pipeline/tests/inflar.test.ts     # NOVO
packages/pipeline/tests/oclusao.test.ts    # NOVO
packages/pipeline/tests/glb.test.ts        # + normais finais e _OCLUSAO
packages/pipeline/tests/portao.test.ts     # + verificarNormais, verificarOclusao
apps/web/src/lib/luz.ts                    # NOVO — constantes do estúdio
apps/web/src/lib/materiais/pele.ts         # lê _oclusao; uniform compartilhado; definirForcaOclusao
apps/web/src/components/viewer/Cena.tsx    # tom, sombra suave, HDRI 0,8, três luzes, __oclusao
apps/web/e2e/realismo.spec.ts              # NOVO
```

---

### Task A: Pipeline — inflar sem dobrar, normais finais, oclusão por vértice, portão

**Files:**
- Modify: `packages/pipeline/src/constantes.ts`, `packages/pipeline/src/glb.ts`, `packages/pipeline/src/construir.ts`, `packages/pipeline/src/portao.ts`
- Create: `packages/pipeline/src/inflar.ts`, `packages/pipeline/src/oclusao.ts`
- Test: `packages/pipeline/tests/inflar.test.ts` (novo), `packages/pipeline/tests/oclusao.test.ts` (novo), `packages/pipeline/tests/glb.test.ts`, `packages/pipeline/tests/portao.test.ts`

- [ ] **Step A1: Constantes**

Em `packages/pipeline/src/constantes.ts`, acrescentar ao fim:

```ts
/** Inflar sem dobrar (spec pele-realismo §3): vértice dobrado = normal média das faces infladas discorda da normal de partida. */
export const LIMIAR_DOBRA = 0.2;
/** Reduções pela metade do deslocamento nos vértices dobrados e vizinhos (3,5 → 1,75 → 0,875 → 0,44 mm); o que ainda dobrar vai a zero. */
export const MAX_REDUCOES_DOBRA = 3;
/** Oclusão ambiente cozida por vértice (spec §4): raios por vértice, alcance e afastamento da origem para não acertar a própria face. */
export const AMOSTRAS_OCLUSAO = 48;
export const ALCANCE_OCLUSAO_M = 0.3;
export const AFASTAMENTO_RAIO_M = 0.0005;
/** Peças que recebem `_OCLUSAO`. Ligar outra é acrescentar aqui. */
export const PECAS_COM_OCLUSAO = new Set([FMA_PELE]);
/** Passar disto não falha: fica no log. */
export const ORCAMENTO_SEGUNDOS_OCLUSAO = 30;
/** Portão da oclusão (spec §5). */
export const OCLUSAO_MEDIA_MIN = 0.05;
export const OCLUSAO_MEDIA_MAX = 0.4;
export const OCLUSAO_MAXIMO_MIN = 0.5;
export const OCLUSAO_ALTA = 0.9;
export const OCLUSAO_FRACAO_ALTA_MAX = 0.01;
```

- [ ] **Step A2: Testes de `inflar.ts` (RED)**

Criar `packages/pipeline/tests/inflar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PlaneGeometry, SphereGeometry } from 'three';
import { inflarSemDobrar, verticesDobrados, vizinhos } from '../src/inflar';
import { normaisSuaves } from '../src/normais';

const deThree = (g: PlaneGeometry | SphereGeometry) => ({ pos: new Float32Array(g.getAttribute('position').array), idx: new Uint32Array(g.getIndex()!.array) });

/**
 * Calha em V ao longo de x: perfil (y, z) com o fundo em (0, 0) e as bordas em (0,01; ±0,002),
 * 4 degraus por lado → abertura de 4 mm no topo e 10 mm de fundo. Orientada com as normais
 * apontando para dentro da calha (para cima): inflar 3,5 mm de cada lado cruza as paredes.
 */
function calhaEmV(): { pos: Float32Array; idx: Uint32Array } {
  const perfil: [number, number][] = [];
  for (let k = 4; k >= 1; k--) perfil.push([k * 0.0025, -k * 0.0005]);
  perfil.push([0, 0]);
  for (let k = 1; k <= 4; k++) perfil.push([k * 0.0025, k * 0.0005]);
  const nx = 9, passo = 0.0025, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < nx; i++) for (const [y, z] of perfil) pos.push(i * passo, y, z);
  const np = perfil.length;
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < np - 1; j++) {
    const a = i * np + j, b = a + 1, c = a + np, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const p = new Float32Array(pos), x = new Uint32Array(idx);
  const n = normaisSuaves(p, x);
  if (n[1] < 0) for (let t = 0; t < x.length; t += 3) { const tmp = x[t + 1]; x[t + 1] = x[t + 2]; x[t + 2] = tmp; } // normais para +y
  return { pos: p, idx: x };
}

describe('vizinhos e verticesDobrados', () => {
  it('vizinhos diretos por aresta; nada dobrado numa placa inflada', () => {
    const { pos, idx } = deThree(new PlaneGeometry(0.1, 0.1, 4, 4));
    const v = vizinhos(idx, pos.length / 3);
    expect(v[0].length).toBeGreaterThanOrEqual(2);
    expect(v[12].length).toBe(6); // vértice central de uma grade triangulada
    const n0 = normaisSuaves(pos, idx);
    const inflada = pos.map((x, i) => x + n0[i] * 0.0035);
    expect(verticesDobrados(inflada, idx, n0)).toEqual([]);
  });
  it('a calha em V inflada 3,5 mm sem recuo dobra', () => {
    const { pos, idx } = calhaEmV();
    const n0 = normaisSuaves(pos, idx);
    expect(n0.filter((_, i) => i % 3 === 1).every((y) => y > 0)).toBe(true);
    const inflada = pos.map((x, i) => x + n0[i] * 0.0035);
    expect(verticesDobrados(inflada, idx, n0).length).toBeGreaterThan(0);
  });
});

describe('inflarSemDobrar', () => {
  it('placa plana: todo vértice sobe 3,5 mm, nada reduzido', () => {
    const { pos, idx } = deThree(new PlaneGeometry(0.1, 0.1, 4, 4));
    const n0 = normaisSuaves(pos, idx);
    const r = inflarSemDobrar(pos, idx, n0, 0.0035);
    expect(r.reduzidos).toBe(0); expect(r.zerados).toBe(0);
    for (let v = 0; v < pos.length / 3; v++) expect(r.pos[v * 3 + 2] - pos[v * 3 + 2]).toBeCloseTo(0.0035, 6);
  });
  it('calha em V: zero dobrados no fim; o fundo anda menos que as bordas; houve redução', () => {
    const { pos, idx } = calhaEmV();
    const n0 = normaisSuaves(pos, idx);
    const r = inflarSemDobrar(pos, idx, n0, 0.0035);
    expect(verticesDobrados(r.pos, idx, n0)).toEqual([]);
    expect(r.reduzidos).toBeGreaterThan(0);
    const desloc = (v: number) => Math.hypot(r.pos[v * 3] - pos[v * 3], r.pos[v * 3 + 1] - pos[v * 3 + 1], r.pos[v * 3 + 2] - pos[v * 3 + 2]);
    const np = 9, meio = 4 * np + 4, borda = 4 * np; // linha central (i = 4): fundo da calha (j = 4) e a borda de cima (j = 0)
    expect(desloc(meio)).toBeLessThan(desloc(borda));
    expect(desloc(borda)).toBeCloseTo(0.0035, 4);
  });
  it('distância zero ou malha sem faces devolve as posições intactas', () => {
    const { pos, idx } = deThree(new PlaneGeometry(0.1, 0.1, 1, 1));
    const n0 = normaisSuaves(pos, idx);
    expect(inflarSemDobrar(pos, idx, n0, 0).pos).toEqual(new Float32Array(pos));
    expect(inflarSemDobrar(pos, new Uint32Array(0), n0, 0.01).pos).toEqual(new Float32Array(pos));
  });
  it('esfera inflada: normais recalculadas da geometria final apontam para fora', () => {
    const { pos, idx } = deThree(new SphereGeometry(0.05, 24, 16));
    const n0 = normaisSuaves(pos, idx);
    const r = inflarSemDobrar(pos, idx, n0, 0.0035);
    const n = normaisSuaves(r.pos, idx);
    for (let v = 0; v < pos.length / 3; v++) {
      const l = Math.hypot(r.pos[v * 3], r.pos[v * 3 + 1], r.pos[v * 3 + 2]);
      const dot = (n[v * 3] * r.pos[v * 3] + n[v * 3 + 1] * r.pos[v * 3 + 1] + n[v * 3 + 2] * r.pos[v * 3 + 2]) / l;
      expect(dot).toBeGreaterThan(0.99);
      expect(l).toBeCloseTo(0.0535, 3);
    }
  });
});
```

Run: `pnpm --filter @corpo3d/pipeline test -- inflar`
Expected: FAIL — `Cannot find module '../src/inflar'`.

- [ ] **Step A3: `inflar.ts` (GREEN)**

Criar `packages/pipeline/src/inflar.ts`:

```ts
import { LIMIAR_DOBRA, MAX_REDUCOES_DOBRA } from './constantes';
import { normaisSuaves } from './normais';

/** Vizinhos diretos (1 anel) de cada vértice, pelas arestas dos triângulos. */
export function vizinhos(idx: ArrayLike<number>, nVertices: number): number[][] {
  const v: Set<number>[] = Array.from({ length: nVertices }, () => new Set<number>());
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    v[a].add(b); v[a].add(c); v[b].add(a); v[b].add(c); v[c].add(a); v[c].add(b);
  }
  return v.map((s) => [...s]);
}

/**
 * Vértices (com face) cuja normal média das faces em `pos` discorda da normal de partida `n0`
 * (`dot < limiar`, ou média nula): a superfície virou do avesso ali.
 */
export function verticesDobrados(pos: ArrayLike<number>, idx: ArrayLike<number>, n0: ArrayLike<number>, limiar = LIMIAR_DOBRA): number[] {
  const n = normaisSuaves(pos, idx);
  const temFace = new Uint8Array(pos.length / 3);
  for (let t = 0; t < idx.length; t++) temFace[idx[t]] = 1;
  const out: number[] = [];
  for (let v = 0; v < temFace.length; v++) {
    if (!temFace[v]) continue;
    const i = v * 3;
    if (n[i] * n0[i] + n[i + 1] * n0[i + 1] + n[i + 2] * n0[i + 2] < limiar) out.push(v);
  }
  return out;
}

export interface ResultadoInflar { pos: Float32Array; reduzidos: number; zerados: number }

/**
 * Desloca cada vértice `distM` ao longo de `n0`. Onde a superfície dobraria (dobras mais
 * estreitas que 2 × distM: entre os dedos, virilha, axilas), o deslocamento do vértice e dos
 * vizinhos diretos cai pela metade, até `maxReducoes` vezes; o que ainda dobrar vai a zero.
 * `reduzidos` = vértices que não andaram a distância cheia; `zerados` = os que não andaram nada.
 */
export function inflarSemDobrar(
  pos: ArrayLike<number>, idx: ArrayLike<number>, n0: ArrayLike<number>, distM: number,
  op: { limiar?: number; maxReducoes?: number } = {},
): ResultadoInflar {
  const limiar = op.limiar ?? LIMIAR_DOBRA, maxReducoes = op.maxReducoes ?? MAX_REDUCOES_DOBRA;
  const nv = pos.length / 3;
  const out = new Float32Array(pos);
  if (distM <= 0 || idx.length === 0) return { pos: out, reduzidos: 0, zerados: 0 };
  const desloc = new Float32Array(nv).fill(distM);
  const viz = vizinhos(idx, nv);
  const aplicar = () => {
    for (let v = 0; v < nv; v++) {
      const i = v * 3, d = desloc[v];
      out[i] = pos[i] + n0[i] * d; out[i + 1] = pos[i + 1] + n0[i + 1] * d; out[i + 2] = pos[i + 2] + n0[i + 2] * d;
    }
  };
  const comAnel = (lista: number[]) => { const s = new Set(lista); for (const v of lista) for (const w of viz[v]) s.add(w); return s; };
  const reduzidos = new Set<number>();
  aplicar();
  let dobrados = verticesDobrados(out, idx, n0, limiar);
  for (let k = 0; k < maxReducoes && dobrados.length; k++) {
    for (const v of comAnel(dobrados)) { desloc[v] *= 0.5; reduzidos.add(v); }
    aplicar();
    dobrados = verticesDobrados(out, idx, n0, limiar);
  }
  let zerados = 0;
  for (let k = 0; k <= maxReducoes && dobrados.length; k++) {
    for (const v of comAnel(dobrados)) { if (desloc[v] > 0) zerados++; desloc[v] = 0; reduzidos.add(v); }
    aplicar();
    dobrados = verticesDobrados(out, idx, n0, limiar);
  }
  return { pos: out, reduzidos: reduzidos.size, zerados };
}
```

Run: `pnpm --filter @corpo3d/pipeline test -- inflar` → PASS (5 testes). Se o teste da calha falhar em `desloc(borda)`, confira os índices: `perfil` tem 9 pontos, `nx = 9`, a linha central é `i = 4`; `borda = 4 * 9 + 0` (primeiro ponto do perfil, no topo) e `meio = 4 * 9 + 4` (fundo da calha).

- [ ] **Step A4: Testes de `oclusao.ts` (RED)**

Criar `packages/pipeline/tests/oclusao.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { direcoesHemisferio, oclusaoPorVertice } from '../src/oclusao';
import { normaisSuaves } from '../src/normais';

/** Placa 0,3 × 0,1 m no plano xz (normal +y), 31 × 11 vértices; opcionalmente uma parede em x = 0,3 (0,15 m de altura). */
function placa(comParede: boolean): { pos: Float32Array; idx: Uint32Array } {
  const pos: number[] = [], idx: number[] = [];
  const grade = (nx: number, nz: number, ponto: (i: number, j: number) => [number, number, number]) => {
    const base = pos.length / 3;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) pos.push(...ponto(i, j));
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) {
      const a = base + i * nz + j, b = a + 1, c = a + nz, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  };
  grade(31, 11, (i, j) => [i * 0.01, 0, j * 0.01]);                       // placa: x 0..0,3, z 0..0,1
  if (comParede) grade(16, 11, (i, j) => [0.3, i * 0.01, j * 0.01]);       // parede: y 0..0,15 em x = 0,3
  const p = new Float32Array(pos), x = new Uint32Array(idx);
  const n = normaisSuaves(p, x);
  if (n[1] < 0) for (let t = 0; t < x.length; t += 3) { const tmp = x[t + 1]; x[t + 1] = x[t + 2]; x[t + 2] = tmp; } // placa com normal +y
  return { pos: p, idx: x };
}

describe('direcoesHemisferio', () => {
  it('n direções unitárias no hemisfério z > 0, com mais amostras perto do zênite (peso de cosseno)', () => {
    const d = direcoesHemisferio(48);
    expect(d.length).toBe(48 * 3);
    let zMedio = 0;
    for (let k = 0; k < 48; k++) {
      expect(Math.hypot(d[k * 3], d[k * 3 + 1], d[k * 3 + 2])).toBeCloseTo(1, 5);
      expect(d[k * 3 + 2]).toBeGreaterThan(0);
      zMedio += d[k * 3 + 2];
    }
    expect(zMedio / 48).toBeGreaterThan(0.6); // uniforme daria 0,5; cosseno dá 2/3
  });
});

describe('oclusaoPorVertice', () => {
  it('placa isolada: oclusão ≈ 0 em todo vértice', () => {
    const { pos, idx } = placa(false);
    const o = oclusaoPorVertice(pos, idx, normaisSuaves(pos, idx));
    expect(o.length).toBe(pos.length / 3);
    for (const v of o) expect(v).toBeLessThan(0.01);
  });
  it('placa com parede: perto da parede > 0,2; longe (x ≤ 0,05) < 0,05; determinístico', () => {
    const { pos, idx } = placa(true);
    const n = normaisSuaves(pos, idx);
    const o = oclusaoPorVertice(pos, idx, n);
    const na = (x: number, z: number) => o[Math.round(x / 0.01) * 11 + Math.round(z / 0.01)];
    expect(na(0.29, 0.05)).toBeGreaterThan(0.2);
    expect(na(0.0, 0.05)).toBeLessThan(0.05);
    expect(na(0.05, 0.05)).toBeLessThan(0.05);
    expect(oclusaoPorVertice(pos, idx, n)).toEqual(o);
  });
});
```

Run: `pnpm --filter @corpo3d/pipeline test -- oclusao` → FAIL (`Cannot find module '../src/oclusao'`).

- [ ] **Step A5: `oclusao.ts` (GREEN)**

Criar `packages/pipeline/src/oclusao.ts`:

```ts
import { BufferAttribute, BufferGeometry, DoubleSide, Ray, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { AFASTAMENTO_RAIO_M, ALCANCE_OCLUSAO_M, AMOSTRAS_OCLUSAO } from './constantes';

/**
 * `n` direções unitárias no hemisfério z > 0 com densidade de cosseno: pontos de uma espiral de
 * Fibonacci no disco unitário (raio = √u), projetados no hemisfério. Fixas, sem aleatório: a
 * construção é reprodutível byte a byte.
 */
export function direcoesHemisferio(n: number): Float32Array {
  const out = new Float32Array(n * 3);
  const dourado = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, r = Math.sqrt(u), phi = i * dourado;
    out[i * 3] = r * Math.cos(phi);
    out[i * 3 + 1] = r * Math.sin(phi);
    out[i * 3 + 2] = Math.sqrt(Math.max(0, 1 - u));
  }
  return out;
}

/**
 * Oclusão ambiente por vértice contra a própria malha: raios saindo `afastamentoM` acima do
 * vértice, no hemisfério da normal; um acerto a distância d pesa 1 − d/alcance. Devolve valores
 * em [0, 1]: 0 = livre, 1 = totalmente ocluído.
 */
export function oclusaoPorVertice(
  pos: Float32Array, idx: Uint32Array, normais: Float32Array,
  op: { amostras?: number; alcanceM?: number; afastamentoM?: number } = {},
): Float32Array {
  const amostras = op.amostras ?? AMOSTRAS_OCLUSAO, alcance = op.alcanceM ?? ALCANCE_OCLUSAO_M, afastamento = op.afastamentoM ?? AFASTAMENTO_RAIO_M;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setIndex(new BufferAttribute(idx, 1));
  const bvh = new MeshBVH(geo);
  const dirs = direcoesHemisferio(amostras);
  const nv = pos.length / 3, out = new Float32Array(nv);
  const ray = new Ray(), n = new Vector3(), t = new Vector3(), b = new Vector3(), aux = new Vector3();
  for (let v = 0; v < nv; v++) {
    n.fromArray(normais, v * 3);
    if (n.lengthSq() < 1e-12) continue; // vértice órfão: fica 0 (livre)
    aux.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0);
    t.crossVectors(aux, n).normalize();
    b.crossVectors(n, t);
    ray.origin.set(pos[v * 3] + n.x * afastamento, pos[v * 3 + 1] + n.y * afastamento, pos[v * 3 + 2] + n.z * afastamento);
    let soma = 0;
    for (let k = 0; k < amostras; k++) {
      const x = dirs[k * 3], y = dirs[k * 3 + 1], z = dirs[k * 3 + 2];
      ray.direction.set(t.x * x + b.x * y + n.x * z, t.y * x + b.y * y + n.y * z, t.z * x + b.z * y + n.z * z);
      const hit = bvh.raycastFirst(ray, DoubleSide, 0, alcance);
      if (hit) soma += 1 - hit.distance / alcance;
    }
    out[v] = soma / amostras;
  }
  geo.dispose();
  return out;
}
```

Run: `pnpm --filter @corpo3d/pipeline test -- oclusao` → PASS (3 testes).

- [ ] **Step A6: Testes de `escreverGlb` (ordem nova, `_OCLUSAO`, `lerGlb`) e do portão (RED)**

Em `packages/pipeline/tests/glb.test.ts`: trocar `import { escreverGlb } from '../src/glb';` por `import { escreverGlb, lerGlb } from '../src/glb';`, acrescentar `import { SphereGeometry } from 'three';` e `import { verificarNormais } from '../src/portao';`, e ao fim do `describe('escreverGlb')`:

```ts
  it('normais gravadas são da geometria FINAL (depois de inflar) e a oclusão vira _OCLUSAO normalizado', async () => {
    const g = new SphereGeometry(0.05, 24, 16);
    const geo = { posicoes: Array.from(g.getAttribute('position').array as Float32Array), indices: Array.from(g.getIndex()!.array) };
    const dir = mkdtempSync(join(tmpdir(), 'glb-'));
    const st = await escreverGlb(geo, join(dir, 'esfera.glb'), { razao: 1, nome: 'E', inflarM: 0.0035, oclusao: true });
    expect(st.reduzidosInflar).toBe(0);
    expect(st.segundosOclusao).toBeGreaterThan(0);
    const lido = await lerGlb(join(dir, 'esfera.glb'));
    expect(verificarNormais(lido.pos, lido.idx, lido.normais)).toBe(0);
    expect(lido.oclusao).not.toBeNull();
    expect(lido.oclusao!.length).toBe(lido.pos.length / 3);
    for (const o of lido.oclusao!) { expect(o).toBeGreaterThanOrEqual(0); expect(o).toBeLessThanOrEqual(1); }
    expect(lido.oclusao!.reduce((a, o) => a + o, 0) / lido.oclusao!.length).toBeLessThan(0.05); // convexa: quase nada ocluído
  });
  it('sem a opção oclusao, não há _OCLUSAO', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'glb-'));
    await escreverGlb(cubo(), join(dir, 'c.glb'), { razao: 1, nome: 'C' });
    expect((await lerGlb(join(dir, 'c.glb'))).oclusao).toBeNull();
  });
```

Em `packages/pipeline/tests/portao.test.ts`, acrescentar `verificarNormais, verificarOclusao` ao import de `../src/portao`, e ao fim do arquivo:

```ts
describe('verificarNormais', () => {
  const tri = { pos: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), idx: new Uint32Array([0, 1, 2]) }; // normal +z
  it('0 quando as normais gravadas concordam com as faces; conta as opostas', () => {
    expect(verificarNormais(tri.pos, tri.idx, new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]))).toBe(0);
    expect(verificarNormais(tri.pos, tri.idx, new Float32Array([0, 0, -1, 0, 0, 1, 0, 0, -1]))).toBe(2);
  });
});

describe('verificarOclusao', () => {
  const lim = { mediaMin: 0.05, mediaMax: 0.4, maximoMin: 0.5, alta: 0.9, fracaoAltaMax: 0.01 };
  it('passa com média na faixa, máximo alto e poucos quase totalmente ocluídos', () => {
    const o = new Float32Array(200).map((_, i) => (i === 0 ? 0.95 : i < 20 ? 0.6 : 0.1));
    expect(verificarOclusao(o, lim)).toEqual({ ok: true, problemas: [] });
  });
  it('acusa atributo ausente, média fora da faixa, máximo baixo e fração alta', () => {
    expect(verificarOclusao(null, lim).problemas.join('\n')).toMatch(/sem _OCLUSAO/);
    expect(verificarOclusao(new Float32Array(100).fill(0.01), lim).problemas.join('\n')).toMatch(/média.*fora|máximo/);
    expect(verificarOclusao(new Float32Array(100).fill(0.95), lim).problemas.join('\n')).toMatch(/fração/);
  });
});
```

Run: `pnpm --filter @corpo3d/pipeline test -- glb portao` → FAIL (`lerGlb`, `oclusao`, `verificarNormais`, `verificarOclusao` não existem).

- [ ] **Step A7: `glb.ts` — ordem nova, `_OCLUSAO`, `lerGlb` (GREEN, parte 1)**

Em `packages/pipeline/src/glb.ts`:

1. Imports: acrescentar `import { performance } from 'node:perf_hooks';`, `import { inflarSemDobrar } from './inflar';` e `import { oclusaoPorVertice } from './oclusao';`.
2. Em `EstatisticasGlb`, acrescentar depois de `confinados?: number;`:

```ts
  /** Vértices que inflaram menos que a distância cheia por causa de uma dobra (spec pele-realismo §3). */
  reduzidosInflar?: number;
  /** Só com `oclusao: true`. */
  segundosOclusao?: number;
  oclusaoMedia?: number;
```
3. Na assinatura de `escreverGlb`, acrescentar `oclusao?: boolean` às opções: `op: { razao: number; nome: string; inflarM?: number; confinarEm?: Envelope; devolverGeometria?: boolean; oclusao?: boolean }`.
4. Trocar o trecho que vai de `const n = normaisSuaves(pos, idx);` até `p.setAttribute('NORMAL', …);` (inclusive) por:

```ts
  // normais de partida (da malha simplificada) só servem de direção para inflar
  const n0 = normaisSuaves(pos, idx);
  let final = new Float32Array(pos);
  let reduzidosInflar: number | undefined;
  if (op.inflarM) {
    const r = inflarSemDobrar(pos, idx, n0, op.inflarM);
    final = r.pos; reduzidosInflar = r.reduzidos;
  }
  let confinados: number | undefined;
  if (op.confinarEm) confinados = confinarDentro(final, op.confinarEm, { folgaM: FOLGA_CONFINAR_M, alcanceM: ALCANCE_CONFINAR_M });
  if (op.inflarM || op.confinarEm) posAcc.setArray(final);
  // normais GRAVADAS = as da geometria gravada (spec pele-realismo §3): impossível ficarem de costas para a face
  const n = normaisSuaves(final, idx);
  p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(n).setBuffer(buffer));
  let segundosOclusao: number | undefined, oclusaoMedia: number | undefined;
  if (op.oclusao) {
    const t0 = performance.now();
    const o = oclusaoPorVertice(final, new Uint32Array(idx), n);
    segundosOclusao = (performance.now() - t0) / 1000;
    oclusaoMedia = o.reduce((a, v) => a + v, 0) / o.length;
    // Uint8 normalizado: 0 = livre, 255 = totalmente ocluído; atributo ausente lê 0 no shader
    const bytes = Uint8Array.from(o, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
    p.setAttribute('_OCLUSAO', doc.createAccessor().setType('SCALAR').setArray(bytes).setNormalized(true).setBuffer(buffer));
  }
```
5. No `return` final, acrescentar `reduzidosInflar, segundosOclusao, oclusaoMedia` ao objeto devolvido.
6. Ao fim do arquivo, a leitura usada pelo portão e pelos testes:

```ts
/**
 * Lê uma GLB do pipeline de volta: posições (nas unidades quantizadas do nó — a escala é uniforme e
 * positiva, então direções e sinais de produto vetorial são os do mundo), normais e `_OCLUSAO`
 * (desnormalizados para float) e os índices.
 */
export async function lerGlb(caminho: string): Promise<{ pos: Float32Array; idx: Uint32Array; normais: Float32Array; oclusao: Float32Array | null }> {
  const doc = await (await getIo()).read(caminho);
  const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const ler = (nome: string): Float32Array | null => {
    const a = p.getAttribute(nome);
    if (!a) return null;
    const tam = a.getElementSize(), out = new Float32Array(a.getCount() * tam), e: number[] = [];
    for (let i = 0; i < a.getCount(); i++) { a.getElement(i, e); for (let k = 0; k < tam; k++) out[i * tam + k] = e[k]; }
    return out;
  };
  const pos = ler('POSITION'), normais = ler('NORMAL'), idx = p.getIndices()?.getArray();
  if (!pos || !normais || !idx) throw new Error(`${caminho}: GLB sem POSITION, NORMAL ou índices`);
  return { pos, idx: new Uint32Array(idx), normais, oclusao: ler('_OCLUSAO') };
}
```

Se o `meshopt()` reclamar do `byteStride` do atributo de 1 byte, trocar `Uint8Array`/`255` por `Uint16Array`/`65535` (continua normalizado) e relatar.

- [ ] **Step A8: `portao.ts` — `verificarNormais`, `verificarOclusao` e CLI assíncrono (GREEN, parte 2)**

Em `packages/pipeline/src/portao.ts`:

1. Imports: acrescentar `FMA_PELE, OCLUSAO_ALTA, OCLUSAO_FRACAO_ALTA_MAX, OCLUSAO_MAXIMO_MIN, OCLUSAO_MEDIA_MAX, OCLUSAO_MEDIA_MIN` ao import de `./constantes`; `import { lerGlb } from './glb';` e `import { normaisSuaves } from './normais';`.
2. Acrescentar, antes do bloco CLI:

```ts
/** Quantos vértices têm a normal gravada de costas (`dot < 0`) para a normal média das faces vizinhas. */
export function verificarNormais(pos: ArrayLike<number>, idx: ArrayLike<number>, normais: ArrayLike<number>): number {
  const media = normaisSuaves(pos, idx);
  let opostas = 0;
  for (let i = 0; i < media.length; i += 3) {
    if (media[i] === 0 && media[i + 1] === 0 && media[i + 2] === 0) continue; // sem face
    if (media[i] * normais[i] + media[i + 1] * normais[i + 1] + media[i + 2] * normais[i + 2] < 0) opostas++;
  }
  return opostas;
}

export interface LimitesOclusao { mediaMin: number; mediaMax: number; maximoMin: number; alta: number; fracaoAltaMax: number }

/** `_OCLUSAO` presente, média na faixa, máximo alto o bastante, e poucos vértices quase totalmente ocluídos (raios entrando na malha). */
export function verificarOclusao(o: ArrayLike<number> | null, lim: LimitesOclusao): { ok: boolean; problemas: string[] } {
  if (!o || o.length === 0) return { ok: false, problemas: ['sem _OCLUSAO'] };
  const problemas: string[] = [];
  let soma = 0, maximo = 0, altos = 0;
  for (let i = 0; i < o.length; i++) { soma += o[i]; if (o[i] > maximo) maximo = o[i]; if (o[i] > lim.alta) altos++; }
  const media = soma / o.length, fracao = altos / o.length;
  if (media < lim.mediaMin || media > lim.mediaMax) problemas.push(`oclusão média ${media.toFixed(3)} fora de [${lim.mediaMin}, ${lim.mediaMax}]`);
  if (maximo < lim.maximoMin) problemas.push(`oclusão máximo ${maximo.toFixed(3)} < ${lim.maximoMin}`);
  if (fracao > lim.fracaoAltaMax) problemas.push(`fração de vértices com oclusão > ${lim.alta}: ${(fracao * 100).toFixed(2)} % > ${lim.fracaoAltaMax * 100} %`);
  return { ok: problemas.length === 0, problemas };
}
```
3. O bloco CLI hoje é síncrono (`if (process.argv[1] …) { … process.exit(…) }`). Substituir todo o bloco por:

```ts
async function cli(): Promise<number> {
  const caminho = join(DIR_SAIDA, 'manifest.json');
  if (!existsSync(caminho)) { console.error(`sem ${caminho}; rode "pnpm --filter @corpo3d/pipeline construir"`); return 2; }
  const m: Manifesto = JSON.parse(readFileSync(caminho, 'utf8'));
  const ids = lerCsvEstruturas(readFileSync(CSV_ESTRUTURAS, 'utf8')).map((l) => l.fmaId);
  const faltandoNoDisco = m.pecas.filter((p) => !existsSync(join(DIR_SAIDA, p.glb))).map((p) => `${p.fmaId}: ${p.glb} não existe no disco`);
  const r = verificarOrcamento(m, ids, { porPeca: ORCAMENTO_BYTES_POR_PECA, total: ORCAMENTO_BYTES_TOTAL });
  const dirPartes = join(DIR_SAIDA, DIR_PARTES);
  const jsons: ManifestoPartes[] = existsSync(dirPartes)
    ? readdirSync(dirPartes).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dirPartes, f), 'utf8')) as ManifestoPartes)
    : [];
  const rp = verificarPartes(jsons, new Set(m.pecas.map((p) => p.fmaId)), { porPeca: ORCAMENTO_BYTES_POR_PECA, total: ORCAMENTO_BYTES_PARTES_TOTAL });
  const partesSemGlb = jsons.flatMap((j) => j.partes.filter((p) => !existsSync(join(DIR_SAIDA, p.glb))).map((p) => `${p.fmaId}: ${p.glb} não existe no disco`));
  // normais e oclusão, GLB a GLB (spec pele-realismo §5)
  const normaisOpostas: string[] = [];
  const oclusao: string[] = [];
  const todas = [...m.pecas.map((p) => ({ fmaId: p.fmaId, glb: p.glb })), ...jsons.flatMap((j) => j.partes.map((p) => ({ fmaId: p.fmaId, glb: p.glb })))];
  for (const p of todas) {
    const f = join(DIR_SAIDA, p.glb);
    if (!existsSync(f)) continue;
    const g = await lerGlb(f);
    const opostas = verificarNormais(g.pos, g.idx, g.normais);
    if (opostas > 0) normaisOpostas.push(`${p.fmaId}: ${opostas} vértice(s) com normal gravada oposta às faces`);
    if (p.fmaId === FMA_PELE) {
      const ro = verificarOclusao(g.oclusao, { mediaMin: OCLUSAO_MEDIA_MIN, mediaMax: OCLUSAO_MEDIA_MAX, maximoMin: OCLUSAO_MAXIMO_MIN, alta: OCLUSAO_ALTA, fracaoAltaMax: OCLUSAO_FRACAO_ALTA_MAX });
      oclusao.push(...ro.problemas.map((x) => `${p.fmaId} (pele): ${x}`));
    }
  }
  const problemas = [...r.problemas, ...faltandoNoDisco, ...rp.problemas, ...partesSemGlb, ...normaisOpostas, ...oclusao];
  console.log(`${m.pecas.length} peças, ${(m.bytesTotal / 1048576).toFixed(2)} MB, ${jsons.length} pais com partes, ${todas.length} GLBs conferidas (normais e oclusão), ${problemas.length} problema(s)`);
  for (const p of problemas) console.log(' - ' + p);
  return problemas.length ? 1 : 0;
}

if (process.argv[1] && process.argv[1].endsWith('portao.ts')) {
  cli().then((codigo) => process.exit(codigo)).catch((e) => { console.error(e); process.exit(1); });
}
```
(Os imports que o bloco antigo já usava — `existsSync, readFileSync, readdirSync`, `join`, `CSV_ESTRUTURAS, DIR_SAIDA, DIR_PARTES, ORCAMENTO_BYTES_POR_PECA, ORCAMENTO_BYTES_TOTAL, ORCAMENTO_BYTES_PARTES_TOTAL`, `lerCsvEstruturas`, `type Manifesto`, `type ManifestoPartes` — continuam.)

Run: `pnpm --filter @corpo3d/pipeline test` → PASS (todos: 47 + 5 inflar + 3 oclusao + 2 glb + 4 portão = 61). `pnpm --filter @corpo3d/pipeline typecheck` → limpo.

- [ ] **Step A9: `construir.ts` — oclusão para a pele e log**

Em `packages/pipeline/src/construir.ts`:
1. Acrescentar `PECAS_COM_OCLUSAO, ORCAMENTO_SEGUNDOS_OCLUSAO` ao import de `./constantes`.
2. Na chamada `escreverGlb(g, join(op.dirSaida, glb), { … devolverGeometria: p.fmaId === FMA_PELE, })`, acrescentar `oclusao: PECAS_COM_OCLUSAO.has(p.fmaId),`.
3. Na linha `log(\`[${i + 1}/${pecas.length}] …\`)`, acrescentar ao fim do template, antes do fecha-crase:

```ts
${st.reduzidosInflar ? `, ${st.reduzidosInflar} vértices inflaram menos (dobras)` : ''}${st.segundosOclusao !== undefined ? `, oclusão média ${(st.oclusaoMedia ?? 0).toFixed(3)} em ${st.segundosOclusao.toFixed(1)} s${st.segundosOclusao > ORCAMENTO_SEGUNDOS_OCLUSAO ? ' (ACIMA do orçamento de tempo)' : ''}` : ''}
```

Run: `pnpm --filter @corpo3d/pipeline typecheck` → limpo; `pnpm --filter @corpo3d/pipeline test` → PASS.

- [ ] **Step A10: Rodar de verdade, portão e commit**

```bash
pnpm --filter @corpo3d/pipeline construir 2>&1 | grep -E "Pele|oclusão|dobras|peças,"
pnpm --filter @corpo3d/pipeline portao
ls -la apps/web/public/models/pele/
```
Expected: a linha da pele mostra `N vértices inflaram menos (dobras)` (centenas a poucos milhares) e `oclusão média 0,1–0,3 em X s` (X ≤ 30; se passar, relate); o portão diz `… GLBs conferidas (normais e oclusão), 0 problema(s)`; a pele continua < 1 MB (o portão já confere). Anote no relatório: N reduzidos, oclusão média, segundos e o tamanho da pele em KB.

Se o portão acusar normais opostas em alguma GLB, é quantização em triângulo-lasca: relate quantas e em quais peças, **não** afrouxe o portão; o controlador decide.

```bash
git add packages/pipeline
git commit -m "feat(pipeline): inflar sem dobrar, normais da geometria final, oclusão ambiente por vértice (_OCLUSAO na pele) e portão de normais/oclusão"
```

---

### Task B: Web — shader lê `_oclusao`, luz de estúdio neutro, gancho de desenvolvimento

**Files:**
- Create: `apps/web/src/lib/luz.ts`
- Modify: `apps/web/src/lib/materiais/pele.ts`, `apps/web/src/components/viewer/Cena.tsx`

- [ ] **Step B1: `luz.ts`**

Criar `apps/web/src/lib/luz.ts`:

```ts
import { NeutralToneMapping, type ToneMapping } from 'three';

/**
 * Estúdio neutro (spec pele-realismo §7): tom fiel à cor da pele e dos órgãos, luz principal
 * branca com sombra, preenchimento fraco do lado oposto e contorno frio atrás para separar o
 * corpo do fundo escuro. Só constantes: o E2E `pelos.spec` é o oráculo de que sobrancelha e
 * couro cabeludo continuam legíveis se alguém mexer aqui.
 */
export const TOM: ToneMapping = NeutralToneMapping;
export const EXPOSICAO = 1.0;
export const HDRI_INTENSIDADE = 0.8;

export interface Luz { posicao: [number, number, number]; intensidade: number; cor: string }
export const LUZ_PRINCIPAL: Luz = { posicao: [1.5, 3, 2], intensidade: 1.2, cor: '#ffffff' };
export const PREENCHIMENTO: Luz = { posicao: [-2.5, 1.5, 2.5], intensidade: 0.35, cor: '#ffffff' };
export const CONTORNO: Luz = { posicao: [-1.5, 2.5, -2.5], intensidade: 0.6, cor: '#dfe8ff' };
```

- [ ] **Step B2: `pele.ts` — atributo, uniform compartilhado, oclusão só na luz indireta**

Em `apps/web/src/lib/materiais/pele.ts`:

1. Depois de `const GLSL_COR_PELO = …;`, acrescentar:

```ts
/** Força da oclusão cozida (`_OCLUSAO` do pipeline); 0 desliga. */
export const FORCA_OCLUSAO = 1.0;
/** Um único objeto de uniform para TODAS as instâncias: `Peca.tsx` clona o material por peça, e o gancho de desenvolvimento muda todas de uma vez. */
const uForcaOclusao = { value: FORCA_OCLUSAO };
export function definirForcaOclusao(valor: number): void { uForcaOclusao.value = valor; }
```
2. Em `onBeforeCompile`, logo após `shader.uniforms.uOrigemPele = { value: this.origem };`, acrescentar `shader.uniforms.uForcaOclusao = uForcaOclusao;`.
3. No `vertexShader`: trocar `'#include <common>\nvarying vec3 vPosMundoPele;\nuniform vec3 uOrigemPele;'` por `'#include <common>\nvarying vec3 vPosMundoPele;\nuniform vec3 uOrigemPele;\nattribute float _oclusao;\nvarying float vOclusaoPele;'`, e `'#include <begin_vertex>\nvPosMundoPele = (modelMatrix * vec4(transformed, 1.0)).xyz - uOrigemPele;'` por `'#include <begin_vertex>\nvPosMundoPele = (modelMatrix * vec4(transformed, 1.0)).xyz - uOrigemPele;\nvOclusaoPele = _oclusao;'`.
4. No `fragmentShader`: trocar `'#include <common>\nvarying vec3 vPosMundoPele;\n' + GLSL_RUIDO + GLSL_PELOS` por `'#include <common>\nvarying vec3 vPosMundoPele;\nvarying float vOclusaoPele;\nuniform float uForcaOclusao;\n' + GLSL_RUIDO + GLSL_PELOS`, e acrescentar mais um `.replace(…)` na cadeia, logo após o de `color_fragment`:

```ts
      // oclusão cozida por vértice (spec pele-realismo §6): só a luz INDIRETA escurece, como o aoMap do three
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
        {
          float oclusaoPele = 1.0 - clamp(vOclusaoPele, 0.0, 1.0) * uForcaOclusao;
          reflectedLight.indirectDiffuse *= oclusaoPele;
          #if defined( USE_CLEARCOAT )
            clearcoatSpecularIndirect *= oclusaoPele;
          #endif
          #if defined( USE_SHEEN )
            sheenSpecularIndirect *= oclusaoPele;
          #endif
          #if defined( USE_ENVMAP ) && defined( STANDARD )
            float dotNVOclusao = saturate( dot( geometryNormal, geometryViewDir ) );
            reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNVOclusao, oclusaoPele, material.roughness );
          #endif
        }`,
      )
```
5. `customProgramCacheKey` passa a devolver `'pele-procedural-v3'`.
6. No comentário de doc da classe, acrescentar a linha ` * - oclusão ambiente cozida no pipeline (atributo \`_oclusao\`, 0 = livre) só na luz indireta; GLB antiga sem o atributo lê 0.`

- [ ] **Step B3: `Cena.tsx` — tom, sombra suave, HDRI, três luzes, gancho `__oclusao`**

Em `apps/web/src/components/viewer/Cena.tsx`:

1. Imports: `import { CONTORNO, EXPOSICAO, HDRI_INTENSIDADE, LUZ_PRINCIPAL, PREENCHIMENTO, TOM } from '@/lib/luz';` e `import { definirForcaOclusao } from '@/lib/materiais/pele';`.
2. `ExporCena` vira:

```tsx
/** Expõe a cena Three.js em `window.__cena` e o gancho `window.__oclusao(v)` (força da oclusão cozida) para os testes E2E. */
function ExporCena() {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const w = window as unknown as { __cena?: unknown; __oclusao?: (v: number) => void };
    w.__cena = scene;
    w.__oclusao = (v: number) => { definirForcaOclusao(v); invalidate(); };
  }, [scene, invalidate]);
  return null;
}
```
3. No `<Canvas …>`: trocar `shadows` por `shadows="soft"` e `gl={{ antialias: true, powerPreference: 'high-performance' }}` por `gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: TOM, toneMappingExposure: EXPOSICAO }}`.
4. Trocar `<Environment files="/hdri/studio_small_09_1k.hdr" />` por `<Environment files="/hdri/studio_small_09_1k.hdr" environmentIntensity={HDRI_INTENSIDADE} />`.
5. Trocar o bloco da `<directionalLight …>` inteiro (até `</directionalLight>`) por:

```tsx
        <directionalLight
          position={LUZ_PRINCIPAL.posicao}
          intensity={LUZ_PRINCIPAL.intensidade}
          color={LUZ_PRINCIPAL.cor}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0002}
          shadow-normalBias={0.02}
        >
          <orthographicCamera attach="shadow-camera" args={[-1.2, 1.2, 2, -0.2, 0.5, 8]} />
        </directionalLight>
        <directionalLight position={PREENCHIMENTO.posicao} intensity={PREENCHIMENTO.intensidade} color={PREENCHIMENTO.cor} />
        <directionalLight position={CONTORNO.posicao} intensity={CONTORNO.intensidade} color={CONTORNO.cor} />
```

Run: `pnpm --filter @corpo3d/web typecheck` → limpo; `pnpm --filter @corpo3d/web test` → PASS (61). Depois: `cd apps/web && pnpm test:e2e e2e/pelos.spec.ts e2e/visualizador.spec.ts --project=desktop` → PASS. Se `pelos.spec` reprovar (contraste da sobrancelha/couro < 25, testa < 100 ou fundo > 40), ajuste **só** as constantes de `luz.ts` (primeiro `HDRI_INTENSIDADE` 0,8 → 1,0; depois `PREENCHIMENTO.intensidade` 0,35 → 0,25) e rode de novo; relate os valores finais. Não toque no teste.

- [ ] **Step B4: Commit**

```bash
git add apps/web/src/lib/luz.ts apps/web/src/lib/materiais/pele.ts apps/web/src/components/viewer/Cena.tsx
git commit -m "feat(web): pele lê a oclusão cozida (só luz indireta), estúdio neutro (tom Neutral, preenchimento, contorno, sombra suave), gancho __oclusao"
```

---

### Task C: E2E `realismo.spec`, capturas Neutral × AgX, revisão final e fechamento

**Files:**
- Create: `apps/web/e2e/realismo.spec.ts`
- Modify: `apps/web/e2e/util.ts` (uma assinatura)
- Capturas (não commitadas): `~/Desktop/corpo3d-realismo-*.png`

- [ ] **Step C1: `util.ts` aceita um elemento na captura; `realismo.spec.ts`**

Em `apps/web/e2e/util.ts`, trocar `export async function capturarSePossivel(page: Page, path: string) {` por `export async function capturarSePossivel(alvo: Page | Locator, path: string) {` e, dentro dela, `await page.screenshot({ path });` por `await alvo.screenshot({ path });`.

Criar `apps/web/e2e/realismo.spec.ts`:

```ts
import { test, expect, type Locator } from '@playwright/test';
import { PNG } from 'pngjs';
import { join } from 'node:path';
import { aguardarModeloRenderizado, capturarSePossivel } from './util';

const FUNDO = [16, 18, 20];
/** Pixel escuro cujos 8 vizinhos são claros: é o "pontinho" da normal virada, não sombra (spec pele-realismo §9). */
const LUM_PONTO_ESCURO = 95;
const LUM_VIZINHO_CLARO = 130;
const MAX_PONTOS_ISOLADOS = 20;
/** Oclusão de contato: escurece o percentil 5 do corpo em ≥ 8 níveis e o percentil 95 em ≤ 3. */
const QUEDA_MINIMA_P5 = 8;
const QUEDA_MAXIMA_P95 = 3;

interface Analise { pontosIsolados: number; p5: number; p95: number; corpo: number }

function analisar(png: Buffer): Analise {
  const img = PNG.sync.read(png);
  const { width: w, height: h, data } = img;
  const lum = new Float32Array(w * h);
  const ehCorpo = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    ehCorpo[i] = Math.abs(r - FUNDO[0]) + Math.abs(g - FUNDO[1]) + Math.abs(b - FUNDO[2]) > 30 ? 1 : 0;
  }
  let pontosIsolados = 0;
  const lums: number[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!ehCorpo[i]) continue;
    lums.push(lum[i]);
    if (lum[i] >= LUM_PONTO_ESCURO) continue;
    let claros = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && lum[i + dy * w + dx] > LUM_VIZINHO_CLARO) claros++;
    if (claros === 8) pontosIsolados++;
  }
  lums.sort((a, b) => a - b);
  const p = (q: number) => lums[Math.floor(q * (lums.length - 1))] ?? 0;
  return { pontosIsolados, p5: p(0.05), p95: p(0.95), corpo: lums.length };
}

/** Chromium sem cabeça às vezes recusa a captura num quadro pesado: repete até conseguir. */
async function capturar(alvo: Locator): Promise<Buffer> {
  let ultimo: unknown;
  for (let i = 0; i < 5; i++) { try { return await alvo.screenshot(); } catch (e) { ultimo = e; } }
  throw ultimo;
}

const doisQuadros = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

test('pele sem pontos escuros isolados; a oclusão cozida escurece só as dobras', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'palco pequeno demais para a estatística de pixels');
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '241');
  await aguardarModeloRenderizado(page);
  await expect(cena).toHaveAttribute('data-camera', 'frente');

  const ligada = analisar(await capturar(cena));
  expect(ligada.corpo).toBeGreaterThan(20_000);
  expect(ligada.pontosIsolados, `pontos escuros isolados no corpo (p5 ${ligada.p5.toFixed(0)}, p95 ${ligada.p95.toFixed(0)})`).toBeLessThanOrEqual(MAX_PONTOS_ISOLADOS);
  await capturarSePossivel(cena, join(process.env.HOME ?? '', 'Desktop', `corpo3d-realismo-frente-${info.project.name}.png`));

  // desliga a oclusão pelo gancho de desenvolvimento e espera dois quadros (frameloop="demand": invalidate → rAF)
  await page.evaluate(() => (window as unknown as { __oclusao: (v: number) => void }).__oclusao(0));
  await page.evaluate(doisQuadros);
  const desligada = analisar(await capturar(cena));
  await page.evaluate(() => (window as unknown as { __oclusao: (v: number) => void }).__oclusao(1));

  expect(desligada.p5 - ligada.p5, `p5 ligada ${ligada.p5.toFixed(1)} × desligada ${desligada.p5.toFixed(1)}`).toBeGreaterThanOrEqual(QUEDA_MINIMA_P5);
  expect(desligada.p95 - ligada.p95, `p95 ligada ${ligada.p95.toFixed(1)} × desligada ${desligada.p95.toFixed(1)}`).toBeLessThanOrEqual(QUEDA_MAXIMA_P95);
});
```

Run: `cd apps/web && pnpm test:e2e e2e/realismo.spec.ts --project=desktop --project=tablet` → PASS (2 passed). Se a queda do p5 vier abaixo de 8, **não** mude o limiar: relate os quatro números (p5/p95 ligada e desligada); o controlador decide entre subir `FORCA_OCLUSAO` e rever o alcance.

- [ ] **Step C2: Suíte inteira**

```bash
cd apps/web && pnpm test:e2e
```
Expected: 44 passed / 10 skipped (42 + 2 novos; 9 + 1 pulado no celular), 0 failed, ≈ 5 min.

- [ ] **Step C3: Capturas do portão manual — `Neutral` e `AgX`**

Criar `apps/web/e2e/captura-realismo-tmp.spec.ts` (descartável; **não commitar**):

```ts
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { aguardarModeloRenderizado, capturarSePossivel } from './util';

const ROTULO = process.env.ROTULO_CAPTURA ?? 'neutral';
const doisQuadros = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

test('capturas do estúdio: frente, costas, esquerda, rosto, tronco', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '241');
  await aguardarModeloRenderizado(page);
  const mesa = join(process.env.HOME ?? '', 'Desktop');
  for (const preset of ['Frente', 'Costas', 'Esquerda']) {
    await page.getByRole('button', { name: preset, exact: true }).click();
    await page.evaluate(doisQuadros);
    await capturarSePossivel(cena, join(mesa, `corpo3d-realismo-${ROTULO}-${preset.toLowerCase()}.png`));
  }
  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('globo ocular esquerdo');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option').first().click();
  await aguardarModeloRenderizado(page, cena);
  await capturarSePossivel(cena, join(mesa, `corpo3d-realismo-${ROTULO}-rosto.png`));
  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('esterno');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option').first().click();
  await aguardarModeloRenderizado(page, cena);
  await capturarSePossivel(cena, join(mesa, `corpo3d-realismo-${ROTULO}-tronco.png`));
});
```

```bash
cd apps/web && ROTULO_CAPTURA=neutral pnpm test:e2e e2e/captura-realismo-tmp.spec.ts --project=desktop
```
Depois trocar, em `apps/web/src/lib/luz.ts`, `NeutralToneMapping` por `AgXToneMapping` (as duas ocorrências: import e `TOM`), rodar `ROTULO_CAPTURA=agx pnpm test:e2e e2e/captura-realismo-tmp.spec.ts --project=desktop`, e **reverter** `luz.ts` ao conteúdo do Step B1 (restaurando o arquivo do último commit). Mover o spec descartável para fora do repo (para `/Users/andrecury/.claude/jobs/e31cb360/tmp/`). `git status --short` tem de ficar vazio.

Abrir com Read e descrever em 3–5 frases cada: `corpo3d-realismo-neutral-frente.png`, `corpo3d-realismo-neutral-rosto.png` e `corpo3d-realismo-agx-frente.png` (o que mudou nas axilas, virilha, sob o queixo; tom da pele; separação do fundo).

- [ ] **Step C4: Commit do E2E**

```bash
git add apps/web/e2e/realismo.spec.ts apps/web/e2e/util.ts
git commit -m "test(e2e): realismo — pontos escuros isolados ≤ 20 e oclusão cozida escurece só as dobras (p5/p95)"
```

- [ ] **Step C5: Portão final, revisão e merge (controlador)**

```bash
pnpm --filter @corpo3d/pipeline test && pnpm --filter @corpo3d/pipeline typecheck && pnpm --filter @corpo3d/pipeline portao
pnpm --filter @corpo3d/web test && pnpm --filter @corpo3d/web typecheck
cd apps/web && pnpm test:e2e
```
Revisão de olhar fresco (opus) sobre `git diff 03df108..HEAD` com a lista: recuo nas dobras (vizinhos, zerar, término), normais finais em todas as peças, oclusão (base ortonormal, hemisfério, afastamento, DoubleSide, determinismo, tempo), `_OCLUSAO` Uint8 normalizado × meshopt, `lerGlb` (unidades quantizadas), portão (custo de ler ≈ 750 GLBs), shader (só indireta; atributo ausente = 0; uniform compartilhado), luzes/tom, E2E (limiares, dois rAF), segurança (gancho só fora de produção).

Merge `--no-ff` de `feat/pele-realismo` na `main` com a mensagem `merge: pele — oclusão cozida por vértice, estúdio neutro, inflar sem dobrar e normais finais (fim dos pontinhos)`. Registrar no spec a escolha do tom (`Neutral` ou `AgX`) quando o André decidir; atualizar a memória.

---

## Custo estimado

| Tarefa | Estimativa |
|---|---|
| A. Pipeline (2 módulos novos, ordem do `glb.ts`, portão, 14 testes, `construir` real) | US$ 15–20 |
| B. Web (shader, luz, cena; `pelos.spec` como oráculo) | US$ 8–12 |
| C. E2E, capturas, revisão final, merge | US$ 10–15 |
| **Total** | **US$ 35–50** |
