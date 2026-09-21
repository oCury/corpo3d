# Corpo3D — Fase 1.5: realismo (pele, olhos do Olho3D, itens que furam a pele, luz)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o corpo parecer tecido e não plástico: pele sem estruturas furando, com microrrelevo e variação; olhos substituídos pelo olho paramétrico do Olho3D (córnea de vidro, íris com padrão, esclera úmida); oclusão ambiente e sombra suave.

**Architecture:** Três frentes independentes. (1) Pipeline: pele em resolução total e **inflada 2 mm** ao longo das normais (as estruturas superficiais que furavam ficam dentro); as 12 peças de olho do atlas saem do CSV e entram os dois globos oculares (`FMA12515` esquerdo e `FMA12514` direito). (2) Material da pele com detalhe procedural injetado por `onBeforeCompile` (ruído em espaço de mundo: micro-bump, rugosidade e mancha de cor) — os GLBs não têm UV, então tudo é função da posição. (3) Olho paramétrico portado do Olho3D (`~/Projetos/olho3D`, código do próprio dono): esfera unitária com eixo visual em +z, escalada para 12,5 mm e posicionada nos centros derivados do globo esquerdo do atlas (o "direito" do BodyParts3D contém os dois olhos, 81 mm de largura — dado, não bug nosso). O `Peca` renderiza o olho paramétrico no lugar da malha quando o `fmaId` é um globo ocular; seleção, arrasto, fantasma e painel continuam iguais. Luz: N8AO + luz direcional com sombra suave, com portão de desempenho.

**Tech Stack:** o que já existe + `@react-three/postprocessing@3.1.1`, `postprocessing@^6.36`, `n8ao@^2.0.1` (peers compatíveis com three 0.186 / R3F 9.7). Texturas do olho geradas em canvas com **PRNG com semente** (mulberry32), não `Math.random`.

**Fatos verificados em 21/09:**
- Pele FMA7163: 203.382 tri originais, hoje 61.012 (razão 0,3), 251 KB; centro (−0,6, 781,6, 100,8) mm; a simplificação afunda a superfície onde vasos/músculos encostam → furam.
- Globo ocular esquerdo FMA12515 (partof, 9 elementos): x 16,0..42,3, y −166,0..−138,8, z 1505,0..1531,2 mm (BP3D) → centro three.js **(0,02915; 1,5181; 0,1524) m**, raio ≈ 13 mm. Direito FMA12514 = 8 elementos com os dois olhos (x −43,6..37,4): **não usar sua geometria**; espelhar o esquerdo em x.
- Olho3D (`~/Projetos/olho3D`, branch `feat/patient-eye-realism`): `src/lib/eye-geometry.ts` (`createScleraGeometry(radius=1, openingAngle=0.62)`, `createCorneaGeometry(radius=0.7, angularExtent=1)`, `createIrisGeometry(pupilRadius, outerRadius=0.58, bulge=0.045)`, `createLensGeometry()`), `src/lib/textures.ts` (`generateIrisTexture(color, size)`, `generateIrisBumpMap`, `generateScleraTexture(size)`, `generateScleraBumpMap` — 177 `Math.random`), `src/components/viewer/EyeModel.tsx` (materiais: esclera `#f8f4ee` roughness 0,42 sheen 0,12 clearcoat 1; córnea transmission 0,985 ior 1,376 thickness 0,1 clearcoat 1 depthWrite false; íris map+bump roughness 0,55 iridescence 0,08; posições: córnea z 0,44, íris z 0,80, cristalino z 0,58; rotação X +90° na esclera/córnea/cristalino). three lá é 0.184; aqui 0.186 — mesma API.
- Contagens após a troca do CSV: **241 peças** (251 − 12 + 2). Testes com números: `visualizador.spec` (`data-pecas`, ≥ GLBs), `interacao.spec` (251/250/196/197 → 241/240/186/187), `acessibilidade.spec`, `arrasto.spec` (196 → 186).

---

## Estrutura de arquivos

```
conteudo/estruturas.csv                       # −12 linhas de olho, +2 globos, pele com razao 1 e inflar 2
packages/pipeline/src/catalogo.ts             # + coluna inflarMm (opcional)
packages/pipeline/src/glb.ts                  # + op.inflarM: desloca posições ao longo das normais
packages/pipeline/src/constantes.ts           # orçamento por peça 1 MB
apps/web/src/lib/materiais/pele.ts            # NOVO — onBeforeCompile com ruído (bump, rugosidade, mancha)
apps/web/src/lib/materiais/index.ts           # pele usa materialPele()
apps/web/src/lib/olho/geometria.ts            # NOVO — porte de eye-geometry (esclera, córnea, íris, cristalino)
apps/web/src/lib/olho/texturas.ts             # NOVO — porte de textures (íris, esclera) com PRNG semeado
apps/web/src/lib/olho/prng.ts                 # NOVO — mulberry32
apps/web/src/components/viewer/OlhoParametrico.tsx   # NOVO — o olho montado (props: raio, corIris)
apps/web/src/components/viewer/Peca.tsx       # renderiza OlhoParametrico para FMA12514/FMA12515
apps/web/src/components/viewer/Cena.tsx       # luz direcional com sombra + EffectComposer/N8AO (portão)
apps/web/e2e/*.spec.ts                        # contagens 241; novo teste de olho
```

---

### Task 1: Pipeline — pele inflada em alta resolução, olhos do atlas fora, globos dentro

**Files:**
- Modify: `conteudo/estruturas.csv`, `packages/pipeline/src/catalogo.ts`, `packages/pipeline/src/glb.ts`, `packages/pipeline/src/construir.ts`, `packages/pipeline/src/constantes.ts`
- Test: `packages/pipeline/tests/glb.test.ts`, `tests/catalogo.test.ts`
- Modify: `apps/web/e2e/{visualizador,interacao,acessibilidade,arrasto}.spec.ts` (contagens)

- [ ] **Step 1: Testes primeiro**

Em `packages/pipeline/tests/glb.test.ts`, acrescentar:
```ts
  it('inflar desloca cada vértice ao longo da sua normal (cubo cresce 2 mm por lado)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'glb-'));
    const semInflar = await escreverGlb(cubo(), join(dir, 'a.glb'), { razao: 1, nome: 'A' });
    const inflado = await escreverGlb(cubo(), join(dir, 'b.glb'), { razao: 1, nome: 'B', inflarM: 0.002 });
    // bbox do manifesto é da geometria de entrada (antes de inflar): igual nos dois
    expect(inflado.bbox).toEqual(semInflar.bbox);
    // mas a geometria gravada é maior: lê de volta e mede a extensão em x
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const extensao = async (f: string) => {
      const doc = await io.read(f); const p = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION')!;
      const no = doc.getRoot().listNodes()[0]; const esc = no.getScale()[0];   // quantização: escala no nó
      return (p.getMax([])[0] - p.getMin([])[0]) * esc;
    };
    expect(await extensao(join(dir, 'b.glb'))).toBeGreaterThan((await extensao(join(dir, 'a.glb'))) + 0.003);  // +2 mm de cada lado ≈ +4 mm (tolerância)
  });
```
Em `packages/pipeline/tests/catalogo.test.ts`, no teste "lê o CSV respeitando aspas com vírgula", acrescentar `expect(linhas[0].inflarMm).toBeUndefined();` e, na fixture `tests/fixtures/estruturas.csv`, acrescentar a coluna `inflarMm` ao cabeçalho e o valor `2` na linha `FMA1` (as outras vazias); e o `expect(linhas[0].inflarMm).toBe(2)`.

Run: `pnpm --filter @corpo3d/pipeline test` → FAIL nos novos asserts.

- [ ] **Step 2: Implementar**

`constantes.ts`: `ORCAMENTO_BYTES_POR_PECA = 1024 * 1024` (a pele em resolução total passa de 500 KB).

`catalogo.ts`: em `LinhaEstrutura` acrescentar `inflarMm?: number;`; em `lerCsvEstruturas` ler `v.inflarMm` (número ≥ 0, opcional, erro com linha se inválido) e devolver no objeto. `SISTEMAS`/validações inalteradas.

`glb.ts`: `escreverGlb(g, saida, op: { razao: number; nome: string; inflarM?: number })`. Depois de calcular as normais suaves (`const n = normaisSuaves(pos, idx)`) e ANTES de `setAttribute('NORMAL', …)`:
```ts
  if (op.inflarM) {
    const p = pos as Float32Array;               // array do accessor POSITION (mutável)
    for (let i = 0; i < p.length; i++) p[i] += n[i] * op.inflarM;
    posAcc.setArray(p);                          // posAcc = p.getAttribute('POSITION')!, para o gltf-transform marcar como alterado
  }
```
(`bbox`/`centro` continuam vindo da geometria de entrada.) Se `getArray()` devolver uma cópia e não a referência, criar `new Float32Array(pos)` alterada e `setArray` nela.

`construir.ts`: passar `inflarM: p.inflarMm ? p.inflarMm / 1000 : undefined` para `escreverGlb`.

`conteudo/estruturas.csv`: acrescentar a coluna `inflarMm` ao cabeçalho (última); linha da pele vira `FMA7163,partof,,,Cutis,Pele,pele,pele,-,,1,2` (razão 1, inflar 2 mm). **Remover** as 12 linhas com `sistema=olho` de córnea, esclera, íris, cristalino, corpo vítreo e coroide (FMA58239, 58240, 58271, 58272, 58236, 58237, 58242, 58243, 58828, 58829, 58299, 58300). **Acrescentar** (mantendo músculos do olho e glândulas lacrimais):
```
FMA12515,partof,,,Bulbus oculi,Globo ocular esquerdo,olho esquerdo,olho,E,,0.6,
FMA12514,partof,,,Bulbus oculi,Globo ocular direito,olho direito,olho,D,,0.6,
```
`conteudo/gerar-estruturas.py` fica como registro histórico; acrescentar no docstring: "a partir de 21/09 (fase 1.5) o CSV é editado à mão; olhos = globos FMA12514/12515".

- [ ] **Step 3: Reconstruir e portão**

Run: `pnpm --filter @corpo3d/pipeline test` (esperado 31 passed) `&& pnpm --filter @corpo3d/pipeline construir 2>&1 | grep -v '^prune\|^reorder\|^simplify\|^weld' | tail -3 && pnpm --filter @corpo3d/pipeline portao`
Expected: `241 peças, ~8-9 MB`, portão `0 problema(s)`; a pele com ~150-200k tri e < 1 MB (anotar o número).

- [ ] **Step 4: Atualizar contagens dos E2E e rodar**

`visualizador.spec.ts`: `'251'` → `'241'` e `toBeGreaterThanOrEqual(251)` → `241`. `interacao.spec.ts`: 251→241, 250→240, 196→186, 197→187 (e `data-visiveis` 250/251 do ocultar/mostrar → 240/241). `acessibilidade.spec.ts`: 251→241. `arrasto.spec.ts`: 251→241, 196→186. Run: `cd apps/web && pnpm test:e2e` → `34 passed, 5 skipped`. Verificar a olho (screenshot 1440×900 de frente, `/tmp/corpo3d-pele-inflada.png`): as manchas vermelhas no pescoço/coxas devem ter sumido; se ainda houver pontos furando, subir `inflarMm` da pele para 3 e reconstruir; reportar o valor final.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(pipeline): pele inflada em alta resolução; olhos do atlas dão lugar aos globos oculares"`

---

### Task 2: Material de pele procedural

**Files:**
- Create: `apps/web/src/lib/materiais/pele.ts`
- Modify: `apps/web/src/lib/materiais/index.ts`
- Test: `apps/web/src/lib/materiais/materiais.test.ts`

- [ ] **Step 1: Teste**

```ts
  it('a pele recebe o shader procedural (onBeforeCompile definido) e os demais não', () => {
    expect(materialPara('pele', 'Cutis').onBeforeCompile).not.toBe(MeshPhysicalMaterial.prototype.onBeforeCompile);
    expect(materialPara('esqueleto', 'Femur').onBeforeCompile).toBe(MeshPhysicalMaterial.prototype.onBeforeCompile);
    expect(materialPara('pele', 'Cutis').customProgramCacheKey()).toContain('pele');
  });
```
(import `MeshPhysicalMaterial` from 'three' no teste.) Run → FAIL.

- [ ] **Step 2: Implementar `pele.ts`**

```ts
import { Color, DoubleSide, MeshPhysicalMaterial } from 'three';

/** Ruído de valor 3D barato (hash + interpolação suave), em GLSL. */
const GLSL_RUIDO = /* glsl */ `
float hashPele(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ruidoPele(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hashPele(i), hashPele(i + vec3(1,0,0)), f.x), mix(hashPele(i + vec3(0,1,0)), hashPele(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hashPele(i + vec3(0,0,1)), hashPele(i + vec3(1,0,1)), f.x), mix(hashPele(i + vec3(0,1,1)), hashPele(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbmPele(vec3 p) { return 0.5 * ruidoPele(p) + 0.25 * ruidoPele(p * 2.03) + 0.125 * ruidoPele(p * 4.11); }
`;

/**
 * Pele sem UV: todo detalhe é função da posição no mundo (metros).
 * - micro-bump (poros ~1 mm) perturbando a normal por gradiente de ruído;
 * - rugosidade variando (testa/nariz mais oleosos que o resto seria UV; aqui só variação sutil);
 * - manchas de cor e leve avermelhado (vascularização) em baixa frequência.
 */
export function materialPele(): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: new Color('#d8a68c'), roughness: 0.62, metalness: 0,
    sheen: 0.5, sheenRoughness: 0.55, sheenColor: new Color('#f6d3bf'),
    clearcoat: 0.08, clearcoatRoughness: 0.6, specularIntensity: 0.55,
    side: DoubleSide,
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundoPele;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosMundoPele = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundoPele;\n' + GLSL_RUIDO)
      // cor: manchas em baixa frequência + leve vermelho (vasos sob a pele)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float mancha = fbmPele(vPosMundoPele * 60.0);
        float vasc = fbmPele(vPosMundoPele * 25.0 + 7.0);
        diffuseColor.rgb *= 0.93 + 0.14 * mancha;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 0.92, 0.90), 0.35 * vasc);`)
      // rugosidade: variação sutil
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor *= 0.88 + 0.24 * ruidoPele(vPosMundoPele * 220.0);`)
      // micro-bump: gradiente do ruído em espaço de mundo levado ao espaço de vista
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float e = 0.0004; vec3 P = vPosMundoPele * 1400.0;
          float h0 = ruidoPele(P);
          vec3 g = vec3(ruidoPele(P + vec3(e * 1400.0, 0.0, 0.0)) - h0, ruidoPele(P + vec3(0.0, e * 1400.0, 0.0)) - h0, ruidoPele(P + vec3(0.0, 0.0, e * 1400.0)) - h0) / e;
          vec3 gv = normalize(mat3(viewMatrix) * g + vec3(1e-6));
          normal = normalize(normal - gv * 0.05 * length(g) * 0.0004);
        }`);
  };
  m.customProgramCacheKey = () => 'pele-procedural-v1';
  return m;
}
```
Em `index.ts`, em `materialPara`: se `sistema === 'pele'`, devolver (com cache) `materialPele()` em vez da receita genérica. `RECEITAS.pele` continua existindo (é lida em outros lugares? não — pode ficar).

⚠ Nota para o implementador: `Peca.tsx` faz `materialPara(...).clone()`. `clone()` de um material com `onBeforeCompile` e `customProgramCacheKey` **preserva** os dois (three copia as funções). Verificar no navegador que a pele compila sem erro de GLSL (console limpo) — um erro de shader aparece como `THREE.WebGLProgram: Shader Error` e a pele fica preta/invisível. Ajustar os coeficientes (`0.05`, `1400.0`, `60.0`) a olho: os poros devem ser sutis a 1 m de distância e visíveis num close no rosto.

- [ ] **Step 3: Verificar e commitar**

Run: `cd apps/web && pnpm test` (33 passed) `&& pnpm exec playwright test e2e/visualizador.spec.ts --project=desktop` (2 passed, sem erro de console). Screenshot de close no rosto (câmera a 0,5 m, `/tmp/corpo3d-pele-close.png`) e olhar: relevo fino, variação de tom, sem "plástico" liso.
`git add -A && git commit -m "feat(web): pele com detalhe procedural (micro-bump, rugosidade e mancha por posição)"`

---

### Task 3: Olho paramétrico do Olho3D

**Files:**
- Create: `apps/web/src/lib/olho/prng.ts`, `apps/web/src/lib/olho/geometria.ts`, `apps/web/src/lib/olho/texturas.ts`
- Create: `apps/web/src/components/viewer/OlhoParametrico.tsx`
- Modify: `apps/web/src/components/viewer/Peca.tsx`
- Test: `apps/web/src/lib/olho/prng.test.ts`, `apps/web/e2e/olho.spec.ts`

- [ ] **Step 1: PRNG com semente + teste**

`prng.ts`:
```ts
/** mulberry32: determinístico, rápido, suficiente para textura procedural. */
export function criarPrng(semente: number): () => number {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
```
`prng.test.ts`: mesma semente → mesma sequência de 5 números; sementes diferentes → sequências diferentes; valores em [0,1).

- [ ] **Step 2: Portar geometria e texturas**

Copiar de `~/Projetos/olho3D/src/lib/eye-geometry.ts` para `geometria.ts` **somente** `createScleraGeometry`, `createCorneaGeometry`, `createIrisGeometry`, `createLensGeometry` e o que elas usam (`SEG`, helpers), renomeando para `geometriaEsclera`, `geometriaCornea`, `geometriaIris`, `geometriaCristalino`; sem `useViewerStore`, sem ceratocone/toricidade.
Copiar de `~/Projetos/olho3D/src/lib/textures.ts` para `texturas.ts` `generateIrisTexture`, `generateIrisBumpMap`, `generateScleraTexture`, `generateScleraBumpMap` → `texturaIris(cor, semente, size=1024)`, `bumpIris(semente, size)`, `texturaEsclera(semente, size=1024)`, `bumpEsclera(semente, size)`: substituir TODO `Math.random()` por `rnd()` onde `const rnd = criarPrng(semente)` no início de cada função (grep deve dar 0 ocorrências de `Math.random` no arquivo). Manter o crédito: comentário no topo "Portado do Olho3D (mesmo autor), 2026-09-21".

- [ ] **Step 3: `OlhoParametrico.tsx`**

```tsx
'use client';
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { DoubleSide, FrontSide, type Texture } from 'three';
import { geometriaCornea, geometriaCristalino, geometriaEsclera, geometriaIris } from '@/lib/olho/geometria';
import { bumpEsclera, bumpIris, texturaEsclera, texturaIris } from '@/lib/olho/texturas';

const IRIS_Z = 0.80, IRIS_BULGE = 0.045, IRIS_RAIO = 0.58, PUPILA = 0.17, CORNEA_Z = 0.44, CRISTALINO_Z = 0.58;
const ROT_X = Math.PI / 2;   // as geometrias do Olho3D têm o polo em +y; o eixo visual do corpo é +z

/**
 * Olho do Olho3D em unidades de esfera unitária, escalado para `raio` metros.
 * Eixo visual = +z do grupo pai (o corpo olha para +z). `semente` fixa as texturas.
 */
export function OlhoParametrico({ raio, corIris = '#5a3a22', semente = 7, material }: { raio: number; corIris?: string; semente?: number; material?: { opacity: number; transparent: boolean } }) {
  const gl = useThree((s) => s.gl); const invalidate = useThree((s) => s.invalidate);
  const geos = useMemo(() => ({ esclera: geometriaEsclera(), cornea: geometriaCornea(), iris: geometriaIris(PUPILA, IRIS_RAIO, IRIS_BULGE), cristalino: geometriaCristalino() }), []);
  const texs = useMemo(() => ({ iris: texturaIris(corIris, semente), irisBump: bumpIris(semente), esclera: texturaEsclera(semente), escleraBump: bumpEsclera(semente) }), [corIris, semente]);
  useEffect(() => { Object.values(texs).forEach((t: Texture) => { t.anisotropy = gl.capabilities.getMaxAnisotropy(); gl.initTexture(t); }); invalidate();
    return () => { Object.values(texs).forEach((t: Texture) => t.dispose()); }; }, [texs, gl, invalidate]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const op = material?.opacity ?? 1, tr = material?.transparent ?? false;
  return (
    <group scale={raio}>
      <mesh geometry={geos.esclera} rotation={[ROT_X, 0, 0]} renderOrder={3}>
        <meshPhysicalMaterial map={texs.esclera} bumpMap={texs.escleraBump} bumpScale={0.03} color="#f8f4ee" roughness={0.42} sheen={0.12} sheenRoughness={0.4} sheenColor="#ffe8dd" clearcoat={1} clearcoatRoughness={0.07} specularIntensity={0.7} side={DoubleSide} transparent={tr} opacity={op} />
      </mesh>
      <mesh geometry={geos.iris} position={[0, 0, IRIS_Z]} renderOrder={6}>
        <meshPhysicalMaterial map={texs.iris} bumpMap={texs.irisBump} bumpScale={0.02} color="#ffffff" roughness={0.55} sheen={0.15} sheenRoughness={0.6} sheenColor={corIris} iridescence={0.08} iridescenceIOR={1.3} specularIntensity={0.3} side={DoubleSide} transparent={tr} opacity={op} />
      </mesh>
      <mesh position={[0, 0, IRIS_Z + IRIS_BULGE]} renderOrder={7}>
        <torusGeometry args={[PUPILA + 0.004, 0.0075, 8, 96]} />
        <meshStandardMaterial color="#1a0f0a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, IRIS_Z - 0.06]} renderOrder={5}>
        <circleGeometry args={[PUPILA + 0.01, 48]} />
        <meshBasicMaterial color="#050303" />
      </mesh>
      <mesh geometry={geos.cristalino} position={[0, 0, CRISTALINO_Z]} rotation={[ROT_X, 0, 0]} renderOrder={12}>
        <meshPhysicalMaterial color="#ffffff" transmission={0.9} thickness={0.2} roughness={0.05} ior={1.41} transparent depthWrite={false} />
      </mesh>
      <mesh geometry={geos.cornea} position={[0, 0, CORNEA_Z]} rotation={[ROT_X, 0, 0]} renderOrder={13}>
        <meshPhysicalMaterial color="#ffffff" transmission={0.985} thickness={0.1} roughness={0} ior={1.376} transparent envMapIntensity={1.3} clearcoat={1} clearcoatRoughness={0.04} specularIntensity={1} side={FrontSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
```
Conferir no Olho3D (`EyeModel.tsx`) as posições/rotações reais de esclera, córnea, íris, pupila e cristalino e usar exatamente as de lá se diferirem das constantes acima.

- [ ] **Step 4: `Peca.tsx` — globos oculares usam o olho paramétrico**

No topo: `const OLHOS: Record<string, { espelharX: boolean }> = { FMA12515: { espelharX: false }, FMA12514: { espelharX: true } };` e `const RAIO_OLHO = 0.0125;`. Como o globo direito do atlas contém os dois olhos, a posição dos DOIS vem do esquerdo: `Cena` passa para `Peca` a peça esquerda como referência? Mais simples: em `Peca`, `const centroOlho = useLoja((s) => { const e = s.manifesto?.pecas.find((p) => p.fmaId === 'FMA12515'); return e ? e.centro : null; })` (referência estável: `centro` é o array do manifesto). Posição do olho no grupo da peça: `[espelharX ? -centro[0] : centro[0], centro[1], centro[2]]`.
Render: se `OLHOS[peca.fmaId]`, em vez de `<group matrix…><mesh geometry…/></group>` renderizar
```tsx
<group position={posicaoOlho}>
  <OlhoParametrico raio={RAIO_OLHO} material={{ opacity: opacidade, transparent: opacidade < 1 }} semente={peca.fmaId === 'FMA12515' ? 7 : 11} />
  {/* colisor invisível para clique/arrasto/hover: o raio bate aqui, não nos materiais transparentes */}
  <mesh userData={{ fmaId: peca.fmaId, interativo: opacidade >= OPACIDADE_MINIMA_INTERATIVA }} visible={false}><sphereGeometry args={[RAIO_OLHO * 1.05, 24, 24]} /><meshBasicMaterial /></mesh>
</group>
```
⚠ `visible={false}` tira do raycast do R3F? Não: R3F ignora objetos invisíveis no raycast por padrão? (O raycaster do three testa `visible`? `Object3D.raycast` do Mesh não checa `visible`, mas o R3F filtra `object.visible`… ) Se o clique não pegar o olho, trocar por `<mesh …><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>` visível com opacidade zero. O fantasma (`Fantasma`) do olho pode continuar usando a geometria do GLB do atlas (`geometria`/`matriz` já carregadas) — para o direito ficará no lugar errado (duas esferas); aceitar e registrar, ou usar uma esfera simples em `posicaoOlho` como fantasma quando `OLHOS[peca.fmaId]`.
O destaque (`cor`) e hover: aplicar emissivo no material da esclera via prop extra `emissivo?: { cor: string; intensidade: number }` em `OlhoParametrico`.

- [ ] **Step 5: E2E `olho.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { aguardarModeloRenderizado } from './util';

test('os dois olhos são peças selecionáveis e o close do rosto mostra íris escura com esclera clara', async ({ page }) => {
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '241');
  await aguardarModeloRenderizado(page);
  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('olho esquerdo');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Globo ocular esquerdo/ }).click();
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA12515');
  await expect(cena).toHaveAttribute('data-camera', 'livre');   // enquadrou o olho
  const png = PNG.sync.read(await page.screenshot({ path: test.info().outputPath('olho-close.png') }));
  // no centro da tela (o olho enquadrado): deve haver pixels escuros (pupila/íris) E claros (esclera)
  let escuros = 0, claros = 0; const cx = png.width >> 1, cy = png.height >> 1;
  for (let y = cy - 120; y < cy + 120; y++) for (let x = cx - 120; x < cx + 120; x++) { const i = (png.width * y + x) * 4; const l = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3; if (l < 60) escuros++; if (l > 170) claros++; }
  expect(escuros).toBeGreaterThan(300); expect(claros).toBeGreaterThan(2000);
  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('olho direito');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Globo ocular direito/ }).click();
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA12514');
});
```
⚠ O enquadramento usa `enquadrar(peca)` com `peca.centro`/`bbox` do MANIFESTO: para o globo direito (bbox dos dois olhos) o foco cai entre os olhos; o teste só verifica seleção do direito. Para o esquerdo, `bbox` de 26 mm → distância 0,3 m: o olho ocupa o centro.
Run: `cd apps/web && pnpm exec playwright test e2e/olho.spec.ts --project=desktop` → `1 passed`; olhar `olho-close.png`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(web): olhos paramétricos portados do Olho3D no lugar das malhas do atlas"`

---

### Task 4: Oclusão ambiente e sombra suave (com portão)

**Files:** `apps/web/package.json`, `apps/web/src/components/viewer/Cena.tsx`, `Peca.tsx` (castShadow/receiveShadow)

- [ ] **Step 1:** `cd apps/web && pnpm add @react-three/postprocessing@3.1.1 postprocessing@^6.36.0 n8ao@^2.0.1`
- [ ] **Step 2:** em `Cena.tsx`: `<Canvas shadows …>`; dentro: `<directionalLight position={[1.5, 3, 2]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.02}><orthographicCamera attach="shadow-camera" args={[-1.2, 1.2, 2, -0.2, 0.5, 8]} /></directionalLight>`; após `<Camera />`: `<EffectComposer enableNormalPass={false} multisampling={4}><N8AO aoRadius={0.05} intensity={2.2} distanceFalloff={0.6} quality="performance" halfRes /></EffectComposer>`. Em `Peca.tsx`, `<mesh … castShadow receiveShadow>` (e nos meshes do olho).
- [ ] **Step 3 (portão):** medir uma órbita de 3 s no desktop 1440×900 (`performance.now()` em volta de 30 `invalidate()` forçados, ou o painel de FPS do DevTools): ≥ 30 fps mantém; < 30 → primeiro tirar as sombras, depois o N8AO; reportar o que ficou. Halos escuros em torno de peças soltas → reduzir `aoRadius` para 0,03. `pnpm test:e2e` inteiro continua verde (as capturas mudam de tom).
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(web): oclusão ambiente N8AO e sombra direcional suave"`

---

### Task 5: Portão visual e docs

- [ ] Suíte completa: `pnpm typecheck && pnpm test && (cd apps/web && pnpm test:e2e)` → verde (unit 31 pipeline + 34 web; e2e 37 passed / 5 skipped).
- [ ] Capturas para revisão humana: corpo de frente a 2,6 m; close do rosto a 0,4 m; pele a 40% com explosão 30% — `/tmp/corpo3d-fase1b-{corpo,rosto,camadas}.png`.
- [ ] Spec §4.2: registrar pele procedural, olhos do Olho3D (créditos: mesmo autor), inflação de 2 mm, N8AO/sombra (ou o que passou no portão). §2: nota de que os conceitos "direitos" do olho no BP3D contêm os dois olhos.
- [ ] `git add -A && git commit -m "docs: spec — fase 1.5 realismo"`
