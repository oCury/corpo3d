# Corpo3D — cabelo raspado, sobrancelhas e pelos no shader da pele

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pôr couro cabeludo raspado, sobrancelhas e uma sugestão de pelos por região na pele do Corpo3D, só com máscaras por posição no shader que a pele já tem, sem peça nova e sem asset.

**Architecture:** Um arquivo novo `apps/web/src/lib/materiais/pelos.ts` guarda os marcos da cabeça do atlas (medidos no manifesto), as constantes de ajuste, três máscaras geométricas em TypeScript puro (gêmeo testável) e o trecho GLSL gerado das mesmas constantes. `pele.ts` só concatena o trecho e usa as três funções nos três pontos de injeção que já existem (cor, rugosidade, normal). O material da pele é singleton e o shader mora no protótipo da subclasse (`Material.copy()` não copia `onBeforeCompile`), então constantes no código bastam. Portão: teste unitário das máscaras em pontos conhecidos, teste dos marcos contra o manifesto, e E2E por pixel no close do olho esquerdo (câmera determinística: `enquadrar(FMA12515)` = 0,3 m do globo, FOV 40°).

**Tech Stack:** o que já existe — three 0.186, R3F, Vitest 5, Playwright 1.63, pngjs. Nada novo.

**Spec:** `docs/superpowers/specs/2026-09-22-corpo3d-cabelo-pelos-design.md`. Branch: `feat/pelos-shader` (já criada, com o spec commitado).

**Fatos verificados em 22/09 (metros, eixos do three: +y cima, +z frente, +x esquerda do paciente):**
- Globo esquerdo `FMA12515`: centro (0,0291; 1,5181; 0,1524), bbox 26 mm. O `FMA12514` "direito" do atlas contém os dois olhos: espelhar o esquerdo em x.
- Crânio `FMA46565`: centro (−0,0007; 1,5293; 0,0864), y 1,422–1,636, z −0,018–0,191. Topo da pele y 1,641.
- `enquadrar(peca)`: `dist = clamp(tamanho·2,5; 0,3; 3)`, câmera em `centro + (0,0,dist)` olhando o centro. Canvas: `fov: 40`, `frameloop="demand"`.
- `materialPara('pele', …)` devolve sempre a mesma instância (cache). `pele.ts` injeta em `<common>`, `<begin_vertex>`, `<color_fragment>`, `<roughnessmap_fragment>`, `<normal_fragment_maps>`; ordem no fragmento do three: color → roughness → normal, todos no escopo do `main()`, então uma variável declarada no `color_fragment` é visível nos outros dois.
- `new Color('#hex')` no three 0.186 converte sRGB → linear (ColorManagement ligado); `diffuseColor` no shader é linear.
- Comandos: `pnpm --filter @corpo3d/web test` (Vitest), `pnpm --filter @corpo3d/web typecheck`, `cd apps/web && pnpm test:e2e` (2 workers; precisa dos modelos: `pnpm --filter @corpo3d/pipeline construir` se `apps/web/public/models/` estiver vazio).

---

## Estrutura de arquivos

```
apps/web/src/lib/materiais/pelos.ts          # NOVO — MARCOS, AJUSTE, máscaras TS, GLSL_PELOS
apps/web/src/lib/materiais/pelos.test.ts     # NOVO — máscaras em pontos conhecidos + marcos × manifesto
apps/web/src/lib/materiais/pele.ts           # concatena GLSL_PELOS, usa as máscaras, chave 'pele-procedural-v2'
apps/web/src/lib/materiais/materiais.test.ts # +1 assert: chave contém 'v2'
apps/web/e2e/pelos.spec.ts                   # NOVO — portão por pixel no close do olho
```

---

### Task 1: Marcos, ajuste e máscaras geométricas em TypeScript (TDD)

**Files:**
- Create: `apps/web/src/lib/materiais/pelos.ts`
- Test: `apps/web/src/lib/materiais/pelos.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/src/lib/materiais/pelos.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @corpo3d/web test -- pelos`
Expected: FAIL — `Cannot find module './pelos'`.

- [ ] **Step 3: Implementar `pelos.ts` (só a parte TS; o GLSL entra na Task 2)**

Criar `apps/web/src/lib/materiais/pelos.ts`:

```ts
import type { Vec3 } from '@/lib/estado/store';

/**
 * Marcos da cabeça do BodyParts3D (um único corpo, 2013), em metros nos eixos do three
 * (+y cima, +z frente, +x esquerda do paciente). Medidos no manifesto em 2026-09-22;
 * `pelos.test.ts` falha se o manifesto se afastar deles.
 */
export const MARCOS = {
  /** Centro do globo ocular esquerdo (`FMA12515`). O direito é o espelho em x. */
  olhoEsquerdo: [0.0291, 1.5181, 0.1524] as Vec3,
  /** Centro do crânio (`FMA46565`), x arredondado para o plano mediano. */
  centroCabeca: [0, 1.53, 0.085] as Vec3,
  /** `bbox.max.y` da pele. */
  topoPele: 1.641,
} as const;

const Y_OLHO = MARCOS.olhoEsquerdo[1];

/** Todas as constantes de forma e intensidade. Ajuste visual = mudar aqui. */
export const AJUSTE = {
  couro: {
    /** Abaixo disto nem avalia (o corpo inteiro não paga o custo). */
    yMinimo: 1.4,
    /** Altura da linha do cabelo por região, interpolada pelo ângulo ao redor da cabeça. */
    testa: Y_OLHO + 0.07,
    tempora: Y_OLHO + 0.03,
    nuca: Y_OLHO - 0.038,
    /** Meia-largura da transição (m) e amplitude do ruído que desalinha a borda (m). */
    bordaM: 0.006,
    ruidoBordaM: 0.012,
    freqRuidoBorda: 90,
    /** Pontilhado de ~1 mm que dá o aspecto raspado. */
    freqPontilhado: 1000,
    forcaBump: 0.25,
    mistura: 0.85,
    rugosidade: 0.85,
  },
  sobrancelha: {
    /** Centro = olho + deslocamento; raios do elipsoide; ponta externa mais alta. */
    deslocamento: [0, 0.022, 0.022] as Vec3,
    raios: [0.026, 0.006, 0.02] as Vec3,
    inclinacaoRad: (8 * Math.PI) / 180,
    /** Fios deitados: frequência alta só em y. */
    freqFiosLateral: 90,
    freqFiosVertical: 1600,
    mistura: 0.9,
    forcaBump: 0.3,
  },
  corpo: {
    peito: { y0: 1.15, y1: 1.36, zMin: 0.1, xMax: 0.14 },
    antebracos: { y0: 0.8, y1: 1.05, xMin: 0.2 },
    pernas: { y0: 0.08, y1: 0.4 },
    bordaM: 0.02,
    freqDensidade: 40,
    freqPontilhado: 900,
    limiarPontilhado: 0.72,
    escurecimento: 0.1,
    rugosidadeExtra: 0.1,
  },
  /** Castanho escuro dos pelos (sRGB). */
  cor: '#3a2a20',
} as const;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Altura-limite da linha do cabelo no ponto (x, z): alta na testa, média nas têmporas,
 * baixa na nuca. Ângulo medido no plano xz a partir de +z (frente) ao redor do centro da cabeça.
 */
export function alturaLinhaDoCabelo(x: number, z: number): number {
  const [cx, , cz] = MARCOS.centroCabeca;
  const dx = x - cx, dz = z - cz;
  const r = Math.hypot(dx, dz);
  const c = r < 1e-6 ? 0 : dz / r;
  const { testa, tempora, nuca } = AJUSTE.couro;
  return tempora + smoothstep(0, 1, Math.max(c, 0)) * (testa - tempora) + smoothstep(0, 1, Math.max(-c, 0)) * (nuca - tempora);
}

/** Couro cabeludo: 1 acima da linha do cabelo, 0 abaixo, transição de ±bordaM. Sem ruído (o ruído é só do shader). */
export function mascaraCouroCabeludo([x, y, z]: Vec3): number {
  if (y < AJUSTE.couro.yMinimo) return 0;
  const lim = alturaLinhaDoCabelo(x, z);
  const b = AJUSTE.couro.bordaM;
  return smoothstep(lim - b, lim + b, y);
}

/** Um elipsoide inclinado por olho; `lado` +1 = esquerdo do paciente (+x), −1 = direito. */
function umaSobrancelha([x, y, z]: Vec3, lado: 1 | -1): number {
  const [ox, oy, oz] = MARCOS.olhoEsquerdo;
  const [dx, dy, dz] = AJUSTE.sobrancelha.deslocamento;
  const lx0 = x - (lado * ox + dx), ly0 = y - (oy + dy), lz = z - (oz + dz);
  // gira o ponto para o espaço local da sobrancelha (ponta externa, de maior |x|, mais alta)
  const ang = lado * AJUSTE.sobrancelha.inclinacaoRad;
  const lx = Math.cos(ang) * lx0 + Math.sin(ang) * ly0;
  const ly = -Math.sin(ang) * lx0 + Math.cos(ang) * ly0;
  const [rx, ry, rz] = AJUSTE.sobrancelha.raios;
  const d = Math.sqrt((lx / rx) ** 2 + (ly / ry) ** 2 + (lz / rz) ** 2);
  return 1 - smoothstep(0.8, 1.0, d);
}

/** Sobrancelhas: máximo das duas. */
export function mascaraSobrancelha(p: Vec3): number {
  if (p[1] < AJUSTE.couro.yMinimo) return 0;
  return Math.max(umaSobrancelha(p, 1), umaSobrancelha(p, -1));
}

/** Faixa [a, b] com bordas suaves de ±borda. */
function faixa(a: number, b: number, borda: number, v: number): number {
  return smoothstep(a - borda, a + borda, v) * (1 - smoothstep(b - borda, b + borda, v));
}

/** Sugestão de pelos: peito (frente), antebraços (braços ao lado do corpo) e pernas abaixo do joelho. Sem ruído. */
export function mascaraPelosCorpo([x, y, z]: Vec3): number {
  const { peito, antebracos, pernas, bordaM: b } = AJUSTE.corpo;
  const ax = Math.abs(x);
  const mPeito = faixa(peito.y0, peito.y1, b, y) * smoothstep(peito.zMin - b, peito.zMin + b, z) * (1 - smoothstep(peito.xMax - b, peito.xMax + b, ax));
  const mAntebracos = faixa(antebracos.y0, antebracos.y1, b, y) * smoothstep(antebracos.xMin - b, antebracos.xMin + b, ax);
  const mPernas = faixa(pernas.y0, pernas.y1, b, y);
  return Math.max(mPeito, mAntebracos, mPernas);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @corpo3d/web test -- pelos`
Expected: PASS — 13 pontos + linha do cabelo + varredura + marcos (o último PULA se não houver manifesto; com os modelos gerados, passa).

Se algum ponto falhar, **não mexa nos pontos**: são os do spec. Confira a conta (por exemplo, `topo da cabeça` tem `r ≈ 0,005` e `c = −1` → limite = nuca = 1,480 < 1,63).

- [ ] **Step 5: Typecheck e commit**

Run: `pnpm --filter @corpo3d/web typecheck`
Expected: sem erros.

```bash
git add apps/web/src/lib/materiais/pelos.ts apps/web/src/lib/materiais/pelos.test.ts
git commit -m "feat(web): marcos da cabeça e máscaras geométricas de couro cabeludo, sobrancelhas e pelos (TS, testadas)"
```

---

### Task 2: GLSL dos pelos e integração no shader da pele

**Files:**
- Modify: `apps/web/src/lib/materiais/pelos.ts` (acrescentar `GLSL_PELOS` no fim)
- Modify: `apps/web/src/lib/materiais/pele.ts` (arquivo inteiro abaixo)
- Modify: `apps/web/src/lib/materiais/materiais.test.ts:19-23`

- [ ] **Step 1: Teste que falha — a chave do programa vira v2**

Em `apps/web/src/lib/materiais/materiais.test.ts`, no teste `'a pele recebe o shader procedural…'`, trocar a última linha por:

```ts
    expect(materialPara('pele', 'Cutis').customProgramCacheKey()).toBe('pele-procedural-v2');
```

Run: `pnpm --filter @corpo3d/web test -- materiais`
Expected: FAIL — recebeu `'pele-procedural-v1'`.

- [ ] **Step 2: Acrescentar `GLSL_PELOS` ao fim de `pelos.ts`**

O GLSL é gerado das MESMAS constantes que as máscaras TS usam. Depende de `ruidoPele`/`fbmPele` (definidas em `GLSL_RUIDO`, em `pele.ts`) e do uniform `viewMatrix` do three; por isso `pele.ts` concatena `GLSL_RUIDO + GLSL_PELOS`, nesta ordem.

```ts
/** Literal GLSL com ponto decimal garantido (`1` viraria int). */
const f = (n: number) => n.toFixed(4);

const [OX, OY, OZ] = MARCOS.olhoEsquerdo;
const [CX, , CZ] = MARCOS.centroCabeca;
const [DX, DY, DZ] = AJUSTE.sobrancelha.deslocamento;
const [RX, RY, RZ] = AJUSTE.sobrancelha.raios;
const { peito, antebracos, pernas } = AJUSTE.corpo;

/**
 * Funções GLSL dos pelos. Requer `ruidoPele`, `fbmPele` (GLSL_RUIDO de pele.ts) e o uniform
 * `viewMatrix`. Cada `pelos*` devolve a máscara em 0–1 já modulada por ruído.
 */
export const GLSL_PELOS = /* glsl */ `
float faixaPelos(float a, float b, float borda, float v) {
  return smoothstep(a - borda, a + borda, v) * (1.0 - smoothstep(b - borda, b + borda, v));
}
float alturaLinhaDoCabelo(vec3 p) {
  vec2 d = p.xz - vec2(${f(CX)}, ${f(CZ)});
  float r = length(d);
  float c = r < 1e-6 ? 0.0 : d.y / r;
  return ${f(AJUSTE.couro.tempora)}
       + smoothstep(0.0, 1.0, max(c, 0.0)) * ${f(AJUSTE.couro.testa - AJUSTE.couro.tempora)}
       + smoothstep(0.0, 1.0, max(-c, 0.0)) * ${f(AJUSTE.couro.nuca - AJUSTE.couro.tempora)};
}
float pelosCouro(vec3 p) {
  if (p.y < ${f(AJUSTE.couro.yMinimo)}) return 0.0;
  float lim = alturaLinhaDoCabelo(p) + (fbmPele(p * ${f(AJUSTE.couro.freqRuidoBorda)}) - 0.5) * ${f(AJUSTE.couro.ruidoBordaM)};
  return smoothstep(lim - ${f(AJUSTE.couro.bordaM)}, lim + ${f(AJUSTE.couro.bordaM)}, p.y);
}
float umaSobrancelhaPelos(vec3 p, float lado) {
  vec3 l = p - vec3(lado * ${f(OX)} + ${f(DX)}, ${f(OY + DY)}, ${f(OZ + DZ)});
  float ang = lado * ${f(AJUSTE.sobrancelha.inclinacaoRad)};
  vec2 g = vec2(cos(ang) * l.x + sin(ang) * l.y, -sin(ang) * l.x + cos(ang) * l.y);
  vec3 q = vec3(g, l.z) / vec3(${f(RX)}, ${f(RY)}, ${f(RZ)});
  return 1.0 - smoothstep(0.8, 1.0, length(q));
}
float pelosSobrancelha(vec3 p) {
  if (p.y < ${f(AJUSTE.couro.yMinimo)}) return 0.0;
  float m = max(umaSobrancelhaPelos(p, 1.0), umaSobrancelhaPelos(p, -1.0));
  if (m <= 0.0) return 0.0;
  float fios = ruidoPele(vec3(p.x * ${f(AJUSTE.sobrancelha.freqFiosLateral)}, p.y * ${f(AJUSTE.sobrancelha.freqFiosVertical)}, p.z * ${f(AJUSTE.sobrancelha.freqFiosLateral)}));
  return m * (0.55 + 0.45 * fios);
}
float pelosCorpo(vec3 p) {
  const float b = ${f(AJUSTE.corpo.bordaM)};
  float ax = abs(p.x);
  float mPeito = faixaPelos(${f(peito.y0)}, ${f(peito.y1)}, b, p.y) * smoothstep(${f(peito.zMin)} - b, ${f(peito.zMin)} + b, p.z) * (1.0 - smoothstep(${f(peito.xMax)} - b, ${f(peito.xMax)} + b, ax));
  float mAnte = faixaPelos(${f(antebracos.y0)}, ${f(antebracos.y1)}, b, p.y) * smoothstep(${f(antebracos.xMin)} - b, ${f(antebracos.xMin)} + b, ax);
  float mPernas = faixaPelos(${f(pernas.y0)}, ${f(pernas.y1)}, b, p.y);
  float faixa = max(mPeito, max(mAnte, mPernas));
  if (faixa <= 0.0) return 0.0;
  float densidade = smoothstep(0.45, 0.70, fbmPele(p * ${f(AJUSTE.corpo.freqDensidade)}));
  float pontilhado = step(${f(AJUSTE.corpo.limiarPontilhado)}, ruidoPele(p * ${f(AJUSTE.corpo.freqPontilhado)}));
  return faixa * densidade * pontilhado;
}
/** Gradiente do ruído por diferenças finitas (espaço de mundo escalado). */
vec3 gradienteRuidoPele(vec3 P, float e) {
  float h0 = ruidoPele(P);
  return vec3(ruidoPele(P + vec3(e, 0.0, 0.0)) - h0, ruidoPele(P + vec3(0.0, e, 0.0)) - h0, ruidoPele(P + vec3(0.0, 0.0, e)) - h0) / e;
}
/** Inclina a normal (espaço de vista) pela componente tangencial de um gradiente em espaço de mundo. */
vec3 inclinarNormalPele(vec3 n, vec3 gradMundo, float forca) {
  vec3 gv = mat3(viewMatrix) * gradMundo;
  gv -= n * dot(n, gv);
  return normalize(n - gv * forca);
}
`;
```

- [ ] **Step 3: Reescrever `pele.ts` integrando as máscaras**

Substituir o arquivo inteiro `apps/web/src/lib/materiais/pele.ts` por:

```ts
import { Color, DoubleSide, MeshPhysicalMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import { AJUSTE, GLSL_PELOS } from './pelos';

/** Ruído de valor 3D barato (hash + interpolação suave), em GLSL. */
const GLSL_RUIDO = /* glsl */ `
float hashPele(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ruidoPele(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hashPele(i), hashPele(i + vec3(1,0,0)), f.x), mix(hashPele(i + vec3(0,1,0)), hashPele(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hashPele(i + vec3(0,0,1)), hashPele(i + vec3(1,0,1)), f.x), mix(hashPele(i + vec3(0,1,1)), hashPele(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbmPele(vec3 p) { return 0.5 * ruidoPele(p) + 0.25 * ruidoPele(p * 2.03) + 0.125 * ruidoPele(p * 4.11); }
/**
 * Altura do microrrelevo. Cada oitava gira os eixos (matriz ortonormal) porque o ruído de valor
 * tem células alinhadas aos eixos: somar oitavas sem girar produz uma trama regular de tecido.
 */
const mat3 GIRO_PELE = mat3(0.8, 0.6, 0.0, -0.36, 0.48, 0.8, 0.48, -0.64, 0.6);
float alturaPele(vec3 p) {
  return 0.55 * ruidoPele(p) + 0.30 * ruidoPele(GIRO_PELE * p * 2.17 + 3.1) + 0.15 * ruidoPele(GIRO_PELE * GIRO_PELE * p * 4.73 + 9.2);
}
`;

/**
 * Coeficientes do detalhe. Posição em METROS, então frequência = ciclos por metro:
 * 450 ≈ 2,2 mm (relevo fino), 220 ≈ 4,5 mm (brilho), 60 ≈ 17 mm (mancha), 25 ≈ 40 mm (vaso).
 */
const FREQ_PORO = 420.0;
const FORCA_BUMP = 0.13;
const FREQ_RUGOSIDADE = 220.0;
const FREQ_MANCHA = 60.0;
const AMPL_MANCHA = 0.20;
const FREQ_VASC = 25.0;
const FORCA_VERMELHO = 0.45;
/** O relevo é sub-pixel de longe e vira cintilação: some entre estas distâncias (metros). */
const DIST_BUMP_CHEIO = 0.4;
const DIST_BUMP_ZERO = 1.1;

/** Literal GLSL com ponto decimal garantido. */
const f = (n: number) => n.toFixed(4);
/** Cor dos pelos em linear (o three converte sRGB → linear no construtor). */
const COR_PELO = new Color(AJUSTE.cor);
const GLSL_COR_PELO = `vec3(${f(COR_PELO.r)}, ${f(COR_PELO.g)}, ${f(COR_PELO.b)})`;

/**
 * Pele sem UV: todo detalhe é função da posição no mundo (metros).
 * - micro-bump (poros) perturbando a normal pelo gradiente do ruído;
 * - rugosidade variando (brilho não uniforme, como pele de verdade);
 * - manchas de cor e leve avermelhado (vascularização) em baixa frequência;
 * - pelos (couro cabeludo raspado, sobrancelhas, sugestão no corpo) por máscaras de posição (`pelos.ts`).
 *
 * O shader mora no PROTÓTIPO, não numa propriedade de instância: `Material.copy()` do three
 * não copia `onBeforeCompile`/`customProgramCacheKey`, e `Peca.tsx` clona o material por peça.
 */
class MaterialPele extends MeshPhysicalMaterial {
  constructor() {
    super({
      color: new Color('#d8a68c'),
      roughness: 0.62,
      metalness: 0,
      sheen: 0.5,
      sheenRoughness: 0.55,
      sheenColor: new Color('#f6d3bf'),
      clearcoat: 0.08,
      clearcoatRoughness: 0.6,
      specularIntensity: 0.55,
      side: DoubleSide,
    });
  }

  override onBeforeCompile(shader: WebGLProgramParametersWithUniforms): void {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundoPele;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosMundoPele = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundoPele;\n' + GLSL_RUIDO + GLSL_PELOS)
      // cor: manchas em baixa frequência + leve vermelho (vasos sob a pele) + pelos.
      // As três máscaras ficam no escopo do main(): os trechos de rugosidade e normal as reusam.
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float mancha = fbmPele(vPosMundoPele * ${FREQ_MANCHA.toFixed(1)});
        float vasc = fbmPele(vPosMundoPele * ${FREQ_VASC.toFixed(1)} + 7.0);
        diffuseColor.rgb *= ${(1 - AMPL_MANCHA / 2).toFixed(3)} + ${AMPL_MANCHA.toFixed(3)} * mancha;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 0.92, 0.90), ${FORCA_VERMELHO.toFixed(3)} * vasc);
        float mCouroPelos = pelosCouro(vPosMundoPele);
        float mSobrPelos = pelosSobrancelha(vPosMundoPele);
        float mCorpoPelos = pelosCorpo(vPosMundoPele);
        float pontilhadoCouro = ruidoPele(vPosMundoPele * ${f(AJUSTE.couro.freqPontilhado)});
        diffuseColor.rgb = mix(diffuseColor.rgb, ${GLSL_COR_PELO}, ${f(AJUSTE.couro.mistura)} * mCouroPelos * (0.6 + 0.4 * pontilhadoCouro));
        diffuseColor.rgb = mix(diffuseColor.rgb, ${GLSL_COR_PELO}, ${f(AJUSTE.sobrancelha.mistura)} * mSobrPelos);
        diffuseColor.rgb *= 1.0 - ${f(AJUSTE.corpo.escurecimento)} * mCorpoPelos;`,
      )
      // rugosidade: variação sutil; couro cabeludo fosco; pelos do corpo um pouco mais foscos
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor *= 0.85 + 0.30 * ruidoPele(vPosMundoPele * ${FREQ_RUGOSIDADE.toFixed(1)});
        roughnessFactor = mix(roughnessFactor, ${f(AJUSTE.couro.rugosidade)}, mCouroPelos);
        roughnessFactor = min(1.0, roughnessFactor + ${f(AJUSTE.corpo.rugosidadeExtra)} * mCorpoPelos);`,
      )
      // micro-bump: gradiente do ruído em espaço de mundo levado ao espaço de vista; depois
      // pontilhado do pelo raspado e fios da sobrancelha, com o mesmo esmaecimento por distância
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float fadeBump = 1.0 - smoothstep(${DIST_BUMP_CHEIO.toFixed(2)}, ${DIST_BUMP_ZERO.toFixed(2)}, length(vViewPosition));
          if (fadeBump > 0.001) {
            vec3 P = vPosMundoPele * ${FREQ_PORO.toFixed(1)};
            const float e = 0.35;
            float h0 = alturaPele(P);
            vec3 g = vec3(alturaPele(P + vec3(e, 0.0, 0.0)) - h0, alturaPele(P + vec3(0.0, e, 0.0)) - h0, alturaPele(P + vec3(0.0, 0.0, e)) - h0) / e;
            normal = inclinarNormalPele(normal, g, ${FORCA_BUMP.toFixed(3)} * fadeBump);
            if (mCouroPelos > 0.001) {
              normal = inclinarNormalPele(normal, gradienteRuidoPele(vPosMundoPele * ${f(AJUSTE.couro.freqPontilhado)}, e), ${f(AJUSTE.couro.forcaBump)} * fadeBump * mCouroPelos);
            }
            if (mSobrPelos > 0.001) {
              vec3 Pf = vPosMundoPele * vec3(${f(AJUSTE.sobrancelha.freqFiosLateral)}, ${f(AJUSTE.sobrancelha.freqFiosVertical)}, ${f(AJUSTE.sobrancelha.freqFiosLateral)});
              normal = inclinarNormalPele(normal, gradienteRuidoPele(Pf, e), ${f(AJUSTE.sobrancelha.forcaBump)} * fadeBump * mSobrPelos);
            }
          }
        }`,
      );
  }

  override customProgramCacheKey(): string {
    return 'pele-procedural-v2';
  }
}

export function materialPele(): MeshPhysicalMaterial {
  return new MaterialPele();
}
```

- [ ] **Step 4: Testes unitários e typecheck**

Run: `pnpm --filter @corpo3d/web test` → PASS (materiais com `v2`, pelos, e os 33 anteriores).
Run: `pnpm --filter @corpo3d/web typecheck` → sem erros.

- [ ] **Step 5: Olhar o resultado (sem código novo)**

O `olho.spec.ts` já produz o close do rosto. Com o servidor de dev no ar ou não (o Playwright sobe um):

```bash
cd apps/web && pnpm test:e2e e2e/olho.spec.ts --project=desktop
cp "$(ls -t test-results/*/olho-close.png | head -1)" ~/Desktop/corpo3d-pelos-olho-close.png
```

Expected: o teste do olho continua passando (a íris e a esclera não mudam). Abrir `~/Desktop/corpo3d-pelos-olho-close.png` e verificar: sobrancelha escura sobre o olho, testa clara, borda escura do couro cabeludo no alto da captura. Se o shader não compilar, o console do navegador mostra `THREE.WebGLProgram: Shader Error` e o corpo fica preto/sem pele: o teste `visualizador.spec` ("sem erro de console") pega isso. Correções de forma/intensidade são só em `AJUSTE` (`pelos.ts`).

Também capturar o corpo inteiro para conferir as faixas do corpo (não devem "manchar" abdômen nem coxas):

```bash
cd apps/web && pnpm test:e2e e2e/visualizador.spec.ts --project=desktop
cp "$(ls -t test-results/*/*.png | head -1)" ~/Desktop/corpo3d-pelos-corpo.png
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/materiais/pelos.ts apps/web/src/lib/materiais/pele.ts apps/web/src/lib/materiais/materiais.test.ts
git commit -m "feat(web): couro cabeludo raspado, sobrancelhas e sugestão de pelos no shader da pele (máscaras por posição)"
```

---

### Task 3: Portão E2E por pixel, desempenho e capturas finais

**Files:**
- Create: `apps/web/e2e/pelos.spec.ts`

- [ ] **Step 1: Escrever o teste E2E**

A câmera é determinística: `enquadrar(FMA12515)` → bbox 26 mm → `dist = max(0,3; 0,065) = 0,3 m` → câmera em (0,0291; 1,5181; 0,4524) olhando o centro do globo, FOV vertical 40°. Cada faixa é um ponto do mundo sobre a pele projetado numa linha da captura pela mesma conta que a câmera faz; a coluna é o centro do canvas (olho e sobrancelha estão em x = 0,0291, o próprio eixo da câmera).

Criar `apps/web/e2e/pelos.spec.ts`:

```ts
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { PNG } from 'pngjs';
import { copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { aguardarModeloRenderizado } from './util';

/**
 * Close do olho esquerdo (`enquadrar(FMA12515)`): câmera a 0,3 m do centro do globo
 * (0,0291; 1,5181; 0,1524), olhando para ele, FOV vertical 40°. Cada faixa é um ponto do mundo
 * sobre a pele (y, z em metros) projetado em linhas da captura; a coluna é o centro do canvas.
 */
const CAMERA = { y: 1.5181, z: 0.1524 + 0.3 };
const FOV_RAD = (40 * Math.PI) / 180;
interface Faixa { y: number; z: number; meiaAlturaM: number }
const FAIXAS: Record<'sobrancelha' | 'testa' | 'couroCabeludo', Faixa> = {
  sobrancelha: { y: 1.54, z: 0.178, meiaAlturaM: 0.004 },   // 2,2 cm acima do olho, sobre a arcada
  testa: { y: 1.568, z: 0.185, meiaAlturaM: 0.006 },        // entre a sobrancelha e a linha do cabelo (1,588)
  couroCabeludo: { y: 1.605, z: 0.16, meiaAlturaM: 0.006 }, // 1,7 cm acima da linha do cabelo, testa já inclinando para trás
};
const LARGURA_JANELA_PX = 60;
const CONTRASTE_MINIMO = 25;      // unidades de luminância (0–255)
const PELE_ILUMINADA_MINIMO = 100; // controle: a testa está iluminada, não está tudo escuro

interface Caixa { x: number; y: number; width: number; height: number }

/** Linha da captura onde cai o ponto (y, z) do mundo, na coluna do eixo da câmera. */
function linhaDe(yM: number, zM: number, canvas: Caixa): number {
  const profundidade = CAMERA.z - zM;
  const pxPorM = canvas.height / (2 * profundidade * Math.tan(FOV_RAD / 2));
  return Math.round(canvas.y + canvas.height / 2 - (yM - CAMERA.y) * pxPorM);
}

function luminanciaMedia(png: PNG, x0: number, y0: number, x1: number, y1: number): number {
  let soma = 0, n = 0;
  for (let y = Math.max(0, y0); y < Math.min(png.height, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(png.width, x1); x++) {
      const i = (png.width * y + x) * 4;
      soma += (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
      n++;
    }
  return n ? soma / n : NaN; // NaN reprova qualquer comparação: janela fora da captura é falha, não zero
}

function medirFaixa(png: PNG, faixa: Faixa, canvas: Caixa): number {
  const cx = Math.round(canvas.x + canvas.width / 2);
  const topo = linhaDe(faixa.y + faixa.meiaAlturaM, faixa.z, canvas);
  const base = linhaDe(faixa.y - faixa.meiaAlturaM, faixa.z, canvas);
  return luminanciaMedia(png, cx - LARGURA_JANELA_PX / 2, topo, cx + LARGURA_JANELA_PX / 2, base);
}

/** Captura para o relatório e uma cópia na Mesa (capturas em pastas temporárias são ilegíveis para revisão). */
async function capturar(page: Page, info: TestInfo, nome: string): Promise<PNG> {
  const caminho = info.outputPath(`${nome}.png`);
  const buf = await page.screenshot({ path: caminho });
  try { copyFileSync(caminho, join(homedir(), 'Desktop', `corpo3d-pelos-${nome}-${info.project.name}.png`)); } catch { /* Mesa opcional */ }
  return PNG.sync.read(buf);
}

test('no close do olho, sobrancelha e couro cabeludo são mais escuros que a testa', async ({ page }, info) => {
  test.skip(info.project.use.viewport!.width < 500, 'no celular o close não cabe as três faixas');
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '241');
  await aguardarModeloRenderizado(page);

  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('olho esquerdo');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Globo ocular esquerdo/ }).click();
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA12515');
  await expect(cena).toHaveAttribute('data-camera', 'livre');
  // frameloop="demand": garante dois quadros depois da câmera mudar antes de medir
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

  const canvas = await page.locator('canvas').first().boundingBox();
  expect(canvas).not.toBeNull();
  // as três faixas têm de cair dentro do canvas; se não caem, câmera/FOV/layout mudaram e a medição seria do painel
  for (const faixa of Object.values(FAIXAS)) {
    expect(linhaDe(faixa.y + faixa.meiaAlturaM, faixa.z, canvas!), 'faixa acima do topo do canvas').toBeGreaterThanOrEqual(canvas!.y);
  }
  const png = await capturar(page, info, 'olho-close');
  const testa = medirFaixa(png, FAIXAS.testa, canvas!);
  const sobrancelha = medirFaixa(png, FAIXAS.sobrancelha, canvas!);
  const couro = medirFaixa(png, FAIXAS.couroCabeludo, canvas!);
  info.annotations.push({ type: 'luminância', description: `testa ${testa.toFixed(0)} · sobrancelha ${sobrancelha.toFixed(0)} · couro ${couro.toFixed(0)}` });

  expect(testa, 'controle: a testa está iluminada').toBeGreaterThan(PELE_ILUMINADA_MINIMO);
  expect(sobrancelha, 'sobrancelha mais escura que a testa').toBeLessThan(testa - CONTRASTE_MINIMO);
  expect(couro, 'couro cabeludo mais escuro que a testa').toBeLessThan(testa - CONTRASTE_MINIMO);
});
```

- [ ] **Step 2: Rodar só este teste, no desktop, e conferir as janelas na captura**

```bash
cd apps/web && pnpm test:e2e e2e/pelos.spec.ts --project=desktop
```

Expected: PASS, com a anotação de luminância no relatório (`pnpm exec playwright show-report` ou o stdout). Abrir `~/Desktop/corpo3d-pelos-olho-close-desktop.png` e confirmar a olho que as três faixas caem onde o nome diz (a sobrancelha ~90 px acima do centro, a testa ~210 px, o couro cabeludo ~360 px). Se uma faixa cair fora do lugar, a causa é a projeção (`CAMERA`, `FOV_RAD`) ou a profundidade `z` do ponto — corrigir a constante da faixa, **nunca afrouxar `CONTRASTE_MINIMO`**.

Se a asserção do couro cabeludo falhar com a faixa no lugar certo, a linha do cabelo está alta demais para esse ângulo: baixar `AJUSTE.couro.testa` em `pelos.ts` (e nada mais), rodar os unitários de novo (o ponto "testa acima da sobrancelha", y 1,575, tem de continuar fora).

- [ ] **Step 3: Rodar a suíte E2E inteira**

```bash
cd apps/web && pnpm test:e2e
```

Expected: 36 + 2 passed (desktop e tablet do novo teste), 6 + 1 skipped (celular). Nenhum teste antigo muda de resultado.

- [ ] **Step 4: Medir o desempenho, à mão**

Com `pnpm --filter @corpo3d/web dev` no ar, abrir `http://localhost:3020`, DevTools → Rendering → "Frame Rendering Stats", preset Frente, girar a câmera por 5 s. Expected: ≥ 55 fps (a fase 1.5 mediu 61). Anotar o número no commit. Se cair abaixo, a suspeita é `pelosCorpo` (avaliado no corpo inteiro): subir o `if (faixa <= 0.0) return 0.0;` para antes das faixas com uma pré-checagem `if (p.y > 1.38 || (p.y > 0.42 && p.y < 0.78)) return 0.0;`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e/pelos.spec.ts
git commit -m "test(e2e): sobrancelha e couro cabeludo mais escuros que a testa no close do olho (pixel real, câmera determinística); fps medido: <substituir pelo número medido no passo 4>"
```

---

### Task 4: Fechar a branch

- [ ] **Step 1: Portão final**

```bash
pnpm --filter @corpo3d/web test && pnpm --filter @corpo3d/web typecheck && pnpm --filter @corpo3d/pipeline test
```
Expected: tudo verde (33 + novos unit web, 32 pipeline).

- [ ] **Step 2: Merge na main**

```bash
git checkout main && git merge --no-ff feat/pelos-shader -m "merge: cabelo raspado, sobrancelhas e pelos no shader da pele"
```

- [ ] **Step 3: Atualizar o spec-mãe**

Em `docs/superpowers/specs/2026-09-21-corpo3d-design.md`, seção 3 ("Fica de fora"), acrescentar uma linha: "Cabelo comprido, barba e cílios. O couro cabeludo raspado, as sobrancelhas e a sugestão de pelos estão no shader da pele (spec de 2026-09-22)." Commit: `docs: spec-mãe aponta para o spec dos pelos`.
