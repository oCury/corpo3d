# Corpo3D — Fase 1: interação (desmontar, remontar, camadas, painel, anotação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o visualizador mínimo da fase 0 no estúdio do médico: camadas por sistema, seleção com painel, desmontar por arrasto com fantasma, encaixe, explosão, remontar tudo, desfazer/refazer, anotação, busca, presets de câmera e navegação por teclado, tudo dirigido por um único estado serializável.

**Architecture:** Um objeto `EstadoCena` (Zod) é a fonte da verdade: vive num store Zustand com pilha de histórico (50 snapshots); estado transitório de interface (seleção, hover, arrasto) fica no mesmo store mas fora do objeto serializável. Cada `<Peca>` lê do store o que a afeta (opacidade do sistema, isolada, solta, explosão, destaque) e anima sua posição com um tween próprio que chama `invalidate()` a cada quadro (o Canvas continua `frameloop="demand"`). Painéis HTML ao redor do canvas despacham ações; a geometria de interação (plano de arrasto, raio de encaixe, deslocamento de explosão, enquadramento) é código puro e testado em Node.

**Tech Stack:** o que já existe (Next 16.3, React 19.2, three 0.186, R3F 9.7, drei 10.7, Playwright 1.63) + `zustand@5`, `zod@4`, `vitest@5` no app web, `@axe-core/playwright`. HDRI local CC0 do Poly Haven. Oclusão ambiente (`n8ao`) só na tarefa opcional final.

**Spec:** `docs/superpowers/specs/2026-09-21-corpo3d-design.md` §4.2 (restante), §4.3, §5.

**Desvios deliberados do spec (registrar no spec ao fechar a fase):**
- `sistemasVisiveis` sai do estado: `opacidade[sistema] === 0` já significa oculto (o spec diz isso), então o campo era redundante.
- "normal map procedural de fibras" nos músculos fica para depois (YAGNI: nada depende disso).
- Olho do Olho3D: fora deste plano (spec já previa portão); vira plano próprio se e quando valer.
- Os três blocos de descrição do painel mostram "Descrição em revisão médica" até a fase 4 produzir conteúdo.

**Fatos que este plano assume (verificados em 21/09):**
- drei 10.7.8 exporta `Outlines`, `Html`, `Bvh`, `Environment` (aceita `files`), `OrbitControls` (aceita `onEnd`, `makeDefault`), `useCursor`.
- GLBs da fase 0 são um `Mesh` por arquivo, posições quantizadas (`KHR_mesh_quantization`) com a desquantização na transformação do nó → o `Mesh` carregado tem `matrixWorld` ≠ identidade; a "casa" da peça é a identidade **do grupo externo**.
- Coordenadas em metros, Y para cima, frente do corpo em +z, `+x` = esquerda do paciente; corpo de y≈0 a y≈1,64.
- `manifest.json` traz `centro`, `bbox` e `vetorExplosao` por peça (comprimento do vetor = peso do sistema).
- Aviso atual do three: `sheenColor` recebendo `undefined` em `materialPara` (corrigir na Tarefa 1).

---

## Estrutura de arquivos

```
apps/web/
├── package.json                      # + zustand, zod, vitest, @axe-core/playwright
├── vitest.config.ts                  # NOVO — testes de lógica pura (node)
├── public/hdri/studio_small_09_1k.hdr   # NOVO — CC0 Poly Haven (~1,5 MB)
├── src/lib/
│   ├── manifesto.ts                  # + export SISTEMAS
│   ├── materiais/index.ts            # fix sheenColor; + materialFantasma()
│   ├── estado/
│   │   ├── schema.ts                 # NOVO — EstadoCenaSchema (Zod), ESTADO_INICIAL, serializar/desserializar
│   │   ├── store.ts                  # NOVO — zustand: estado + histórico + transitório + ações
│   │   └── geometria.ts              # NOVO — explosão, encaixe, plano de arrasto, presets, enquadrar
│   ├── busca.ts                      # NOVO — filtro por nome
│   └── hooks/
│       ├── useReducedMotion.ts       # NOVO
│       ├── useAnimarPosicao.ts       # NOVO — tween de posição com invalidate()
│       └── useAtalhos.ts             # NOVO — Escape, Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z
├── src/components/
│   ├── viewer/
│   │   ├── Cena.tsx                  # MODIFICAR — Bvh, controles, data-attributes, HDRI local
│   │   ├── Peca.tsx                  # REESCREVER — mesh próprio, opacidade, destaque, arrasto, fantasma
│   │   ├── Fantasma.tsx              # NOVO
│   │   ├── Nota.tsx                  # NOVO — Html ancorado
│   │   └── Camera.tsx                # NOVO — aplica presets/enquadramento ao OrbitControls
│   └── estudio/
│       ├── Estudio.tsx               # NOVO — layout: painel esquerdo, cena, painel direito
│       ├── PainelCamadas.tsx         # NOVO — 12 sliders
│       ├── Controles.tsx             # NOVO — explosão, remontar tudo, desfazer/refazer, câmera
│       ├── PainelPeca.tsx            # NOVO — nomes, blocos, destaque, nota, ações
│       ├── Busca.tsx                 # NOVO
│       └── ListaPecas.tsx            # NOVO — navegação por teclado
├── src/app/page.tsx                  # MODIFICAR — renderiza <Estudio/>
├── src/app/globals.css               # MODIFICAR — layout e controles
└── e2e/
    ├── visualizador.spec.ts          # (fase 0, mantém)
    ├── interacao.spec.ts             # NOVO — camadas, seleção, isolar, explosão, undo, painel, busca
    ├── arrasto.spec.ts               # NOVO — desmontar/encaixar com o mouse; reduced motion
    └── acessibilidade.spec.ts        # NOVO — teclado + axe
```

Regra de fronteira: `src/lib/**` não importa React nem R3F (só `three` para vetores) e é 100% testado em Node. Componentes só compõem o store e a lib.

---

### Task 1: Dependências, vitest no web, fix do `sheenColor`, HDRI local

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/src/lib/materiais/index.ts`
- Modify: `apps/web/src/lib/manifesto.ts`
- Create: `apps/web/public/hdri/studio_small_09_1k.hdr` (download)
- Modify: `apps/web/src/components/viewer/Cena.tsx` (só a linha do `Environment`)
- Modify: `apps/web/src/app/atribuicao/page.tsx` (crédito do HDRI)
- Test: `apps/web/src/lib/materiais/materiais.test.ts`

- [ ] **Step 1: Instalar**

```bash
cd ~/Projetos/corpo3d/apps/web && pnpm add zustand@^5.0.15 zod@^4.6.5 && pnpm add -D vitest@^5.0.1 @axe-core/playwright@^4
```

Acrescentar em `apps/web/package.json` → `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 2: Config do vitest**

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 3: Teste que reproduz o aviso do `sheenColor`**

`apps/web/src/lib/materiais/materiais.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { materialPara, corPorNome } from './index';

describe('materialPara', () => {
  it('não passa sheenColor undefined ao three (que avisa no console)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    materialPara('esqueleto', 'Femur');
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('sheenColor'))).toEqual([]);
    warn.mockRestore();
  });
  it('reusa o material por sistema+cor', () => {
    expect(materialPara('esqueleto', 'Femur')).toBe(materialPara('esqueleto', 'Tibia'));
    expect(materialPara('cardiovascular', 'Vena cava')).not.toBe(materialPara('cardiovascular', 'Aorta'));
  });
  it('colore veias de azul e artérias de vermelho pelo nome em latim', () => {
    expect(corPorNome('cardiovascular', 'Vena cava superior')).toBe('#3f5fa8');
    expect(corPorNome('cardiovascular', 'Arteria femoralis')).toBe('#c4322d');
    expect(corPorNome('cardiovascular', 'Cor')).toBe('#b3312e');
  });
});
```

- [ ] **Step 4: Rodar e ver o primeiro teste falhar**

Run: `cd apps/web && pnpm test`
Expected: FAIL no teste do `sheenColor` (o three avisa `parameter 'sheenColor' has value of undefined`).

- [ ] **Step 5: Corrigir `materialPara` e adicionar o material do fantasma**

Em `apps/web/src/lib/materiais/index.ts`, substituir a construção do material por (só monta as chaves que existem):
```ts
export function materialPara(sistema: Sistema, nomeLatim: string): MeshPhysicalMaterial {
  const cor = corPorNome(sistema, nomeLatim);
  const chave = `${sistema}:${cor}`;
  const existente = cache.get(chave);
  if (existente) return existente;
  const r = RECEITAS[sistema];
  const m = new MeshPhysicalMaterial({
    color: new Color(cor),
    roughness: r.roughness,
    metalness: r.metalness ?? 0,
    clearcoat: r.clearcoat ?? 0,
    clearcoatRoughness: r.clearcoatRoughness ?? 0.3,
    sheen: r.sheen ?? 0,
    ...(r.sheenColor ? { sheenColor: new Color(r.sheenColor) } : {}),
    transmission: r.transmission ?? 0,
    ior: r.ior ?? 1.45,
    transparent: (r.opacity ?? 1) < 1,
    opacity: r.opacity ?? 1,
    side: DoubleSide,
  });
  cache.set(chave, m);
  return m;
}

let fantasma: MeshBasicMaterial | undefined;
/** Wireframe translúcido que marca a posição de casa de uma peça solta. Compartilhado. */
export function materialFantasma(): MeshBasicMaterial {
  fantasma ??= new MeshBasicMaterial({ color: new Color('#9ecbff'), wireframe: true, transparent: true, opacity: 0.25, depthWrite: false });
  return fantasma;
}
```
e no import: `import { MeshPhysicalMaterial, MeshBasicMaterial, Color, DoubleSide } from 'three';`.

Em `apps/web/src/lib/manifesto.ts`, logo após o `type Sistema`, acrescentar:
```ts
export const SISTEMAS = ['pele', 'esqueleto', 'musculos', 'cardiovascular', 'respiratorio', 'digestivo',
  'linfatico', 'urinario', 'reprodutor', 'endocrino', 'nervoso', 'olho'] as const satisfies readonly Sistema[];
```

- [ ] **Step 6: Rodar os testes**

Run: `cd apps/web && pnpm test`
Expected: `3 passed`

- [ ] **Step 7: HDRI local**

```bash
mkdir -p ~/Projetos/corpo3d/apps/web/public/hdri && curl -sSL -o ~/Projetos/corpo3d/apps/web/public/hdri/studio_small_09_1k.hdr "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr" && ls -la ~/Projetos/corpo3d/apps/web/public/hdri/ && head -c 11 ~/Projetos/corpo3d/apps/web/public/hdri/studio_small_09_1k.hdr
```
Expected: arquivo de ~1,3–1,6 MB começando com `#?RADIANCE`. Se o download falhar (URL mudou), tentar `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr` e ajustar o nome nos passos seguintes; se nada baixar, manter `preset="studio"` e reportar.

Em `Cena.tsx`, trocar `<Environment preset="studio" />` por `<Environment files="/hdri/studio_small_09_1k.hdr" />`.

Em `apps/web/src/app/atribuicao/page.tsx`, antes do parágrafo "Material educativo…", acrescentar:
```tsx
      <p>Iluminação: HDRI "Studio Small 09" de Poly Haven, CC0 (domínio público).</p>
```

- [ ] **Step 8: CI passa a rodar os testes unitários dos dois pacotes**

Em `.github/workflows/ci.yml`, trocar a última linha `- run: pnpm --filter @corpo3d/pipeline test` por `- run: pnpm test` (o script da raiz roda `vitest` no pipeline e no web).

- [ ] **Step 9: Verificar no navegador e commitar**

Run: `cd ~/Projetos/corpo3d && pnpm typecheck && (cd apps/web && pnpm test:e2e)`
Expected: typecheck limpo; `6 passed` (o e2e da fase 0 continua valendo; sem `sheenColor` no console, e sem requisição a CDN externa).

```bash
git add -A && git commit -m "chore(web): zustand, zod, vitest; fix sheenColor; HDRI local CC0"
```

---

### Task 2: Schema do estado da cena (Zod) e serialização

**Files:**
- Create: `apps/web/src/lib/estado/schema.ts`
- Test: `apps/web/src/lib/estado/schema.test.ts`

- [ ] **Step 1: Teste**

`apps/web/src/lib/estado/schema.test.ts`:
```ts
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
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `cd apps/web && pnpm test src/lib/estado`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar**

`apps/web/src/lib/estado/schema.ts`:
```ts
import { z } from 'zod';
import { SISTEMAS, type Sistema } from '@/lib/manifesto';

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
const FmaId = z.string().regex(/^FMA\d+$/);
export const CORES_DESTAQUE = ['#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#c77dff'] as const;
export const MAX_NOTA = 280;
export const MAX_HISTORICO = 50;

export const EstadoCenaSchema = z.object({
  v: z.literal(1),
  opacidade: z.record(z.enum(SISTEMAS), z.number().min(0).max(1)),   // exaustivo: os 12 sistemas
  ocultas: z.array(FmaId),
  soltas: z.array(z.object({ fmaId: FmaId, pos: Vec3 })),
  destacadas: z.array(z.object({ fmaId: FmaId, cor: z.enum(CORES_DESTAQUE) })),
  notas: z.array(z.object({ fmaId: FmaId, texto: z.string().max(MAX_NOTA) })),
  isolada: FmaId.nullable(),
  explosao: z.number().min(0).max(1),
  camera: z.object({ pos: Vec3, alvo: Vec3 }),
});
export type EstadoCena = z.infer<typeof EstadoCenaSchema>;

export const CAMERA_INICIAL = { pos: [0, 1.0, 2.6] as [number, number, number], alvo: [0, 0.85, 0] as [number, number, number] };

export const ESTADO_INICIAL: EstadoCena = {
  v: 1,
  opacidade: Object.fromEntries(SISTEMAS.map((s) => [s, 1])) as Record<Sistema, number>,
  ocultas: [], soltas: [], destacadas: [], notas: [], isolada: null, explosao: 0,
  camera: CAMERA_INICIAL,
};

export const serializar = (e: EstadoCena): string => JSON.stringify(EstadoCenaSchema.parse(e));

export function desserializar(texto: string): EstadoCena {
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { throw new Error('estado inválido: não é JSON'); }
  const r = EstadoCenaSchema.safeParse(bruto);
  if (!r.success) throw new Error(`estado inválido: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return r.data;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd apps/web && pnpm test src/lib/estado`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): schema Zod do estado da cena com serialização"
```

---

### Task 3: Store Zustand com histórico e ações de domínio

**Files:**
- Create: `apps/web/src/lib/estado/store.ts`
- Test: `apps/web/src/lib/estado/store.test.ts`

- [ ] **Step 1: Teste**

`apps/web/src/lib/estado/store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
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
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `cd apps/web && pnpm test src/lib/estado/store`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar**

`apps/web/src/lib/estado/store.ts`:
```ts
import { create } from 'zustand';
import type { Sistema, Manifesto } from '@/lib/manifesto';
import { EstadoCenaSchema, ESTADO_INICIAL, MAX_HISTORICO, MAX_NOTA, type EstadoCena, type CORES_DESTAQUE } from './schema';

export type CorDestaque = (typeof CORES_DESTAQUE)[number];
export type Vec3 = [number, number, number];
export type PresetCamera = 'frente' | 'costas' | 'esquerda' | 'direita' | 'superior' | 'livre';

interface Loja {
  // serializável (vai no link)
  estado: EstadoCena;
  historico: EstadoCena[];
  futuro: EstadoCena[];
  // transitório (não vai no link)
  manifesto: Manifesto | null;
  erroManifesto: string | null;
  selecionada: string | null;
  hover: string | null;
  arrastando: string | null;
  presetCamera: PresetCamera;
  // genéricas
  reiniciar(): void;
  definirManifesto(m: Manifesto): void;
  definirErroManifesto(m: string | null): void;
  aplicar(parcial: Partial<EstadoCena>, op?: { historico?: boolean }): void;
  /** Empilha `anterior` no histórico (uma entrada por gesto de slider), se o estado mudou desde ele. */
  registrarSnapshot(anterior: EstadoCena): void;
  desfazer(): void;
  refazer(): void;
  selecionar(fmaId: string | null): void;
  passarMouse(fmaId: string | null): void;
  definirArrastando(fmaId: string | null): void;
  definirPreset(p: PresetCamera): void;
  // domínio
  definirOpacidade(sistema: Sistema, valor: number, op?: { historico?: boolean }): void;
  alternarOculta(fmaId: string): void;
  soltar(fmaId: string, pos: Vec3): void;
  encaixar(fmaId: string): void;
  remontarTudo(): void;
  definirExplosao(valor: number, op?: { historico?: boolean }): void;
  isolar(fmaId: string | null): void;
  destacar(fmaId: string, cor: CorDestaque | null): void;
  anotar(fmaId: string, texto: string): void;
  definirCamera(pos: Vec3, alvo: Vec3): void;
}

export const useLoja = create<Loja>()((set, get) => ({
  estado: ESTADO_INICIAL, historico: [], futuro: [],
  manifesto: null, erroManifesto: null, selecionada: null, hover: null, arrastando: null, presetCamera: 'frente',

  reiniciar: () => set({ estado: ESTADO_INICIAL, historico: [], futuro: [], erroManifesto: null, selecionada: null, hover: null, arrastando: null, presetCamera: 'frente' }),
  definirManifesto: (manifesto) => set({ manifesto }),
  definirErroManifesto: (erroManifesto) => set({ erroManifesto }),
  registrarSnapshot: (anterior) => {
    const { estado, historico } = get();
    if (anterior === estado) return;
    set({ historico: [...historico, anterior].slice(-MAX_HISTORICO), futuro: [] });
  },

  aplicar: (parcial, op) => {
    const { estado, historico } = get();
    const novo = EstadoCenaSchema.parse({ ...estado, ...parcial });   // valida: lança se inválido
    if (op?.historico === false) return set({ estado: novo });
    set({ estado: novo, historico: [...historico, estado].slice(-MAX_HISTORICO), futuro: [] });
  },
  desfazer: () => {
    const { estado, historico, futuro } = get();
    if (!historico.length) return;
    set({ estado: historico[historico.length - 1], historico: historico.slice(0, -1), futuro: [estado, ...futuro] });
  },
  refazer: () => {
    const { estado, historico, futuro } = get();
    if (!futuro.length) return;
    set({ estado: futuro[0], futuro: futuro.slice(1), historico: [...historico, estado].slice(-MAX_HISTORICO) });
  },
  selecionar: (selecionada) => set({ selecionada }),
  passarMouse: (hover) => set({ hover }),
  definirArrastando: (arrastando) => set({ arrastando }),
  definirPreset: (presetCamera) => set({ presetCamera }),

  definirOpacidade: (sistema, valor, op) => get().aplicar({ opacidade: { ...get().estado.opacidade, [sistema]: valor } }, op),
  alternarOculta: (fmaId) => {
    const { ocultas } = get().estado;
    get().aplicar({ ocultas: ocultas.includes(fmaId) ? ocultas.filter((i) => i !== fmaId) : [...ocultas, fmaId] });
  },
  soltar: (fmaId, pos) => get().aplicar({ soltas: [...get().estado.soltas.filter((s) => s.fmaId !== fmaId), { fmaId, pos }] }),
  encaixar: (fmaId) => get().aplicar({ soltas: get().estado.soltas.filter((s) => s.fmaId !== fmaId) }),
  remontarTudo: () => get().aplicar({ soltas: [], explosao: 0 }),
  definirExplosao: (explosao, op) => get().aplicar({ explosao }, op),
  isolar: (isolada) => get().aplicar({ isolada }),
  destacar: (fmaId, cor) => {
    const resto = get().estado.destacadas.filter((d) => d.fmaId !== fmaId);
    get().aplicar({ destacadas: cor ? [...resto, { fmaId, cor }] : resto });
  },
  anotar: (fmaId, texto) => {
    const resto = get().estado.notas.filter((n) => n.fmaId !== fmaId);
    const t = texto.trim().slice(0, MAX_NOTA);
    get().aplicar({ notas: t ? [...resto, { fmaId, texto: t }] : resto });
  },
  definirCamera: (pos, alvo) => get().aplicar({ camera: { pos, alvo } }, { historico: false }),
}));

/** Seletores derivados, memoizáveis pelos componentes. */
export const estaSolta = (e: EstadoCena, fmaId: string) => e.soltas.find((s) => s.fmaId === fmaId) ?? null;
export const corDestaqueDe = (e: EstadoCena, fmaId: string) => e.destacadas.find((d) => d.fmaId === fmaId)?.cor ?? null;
export const notaDe = (e: EstadoCena, fmaId: string) => e.notas.find((n) => n.fmaId === fmaId)?.texto ?? '';
```

- [ ] **Step 4: Rodar os testes**

Run: `cd apps/web && pnpm test src/lib/estado`
Expected: `14 passed` (4 do schema + 10 da loja)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): store Zustand com histórico de 50 passos e ações de domínio"
```

---

### Task 4: Geometria de interação (pura) — explosão, encaixe, plano de arrasto, câmera

**Files:**
- Create: `apps/web/src/lib/estado/geometria.ts`
- Test: `apps/web/src/lib/estado/geometria.test.ts`

- [ ] **Step 1: Teste**

`apps/web/src/lib/estado/geometria.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Ray, Vector3 } from 'three';
import { posicaoAlvo, estaEmCasa, projetarNoPlanoDaCamera, PRESETS_CAMERA, enquadrar, RAIO_ENCAIXE, DESLOCAMENTO_MAXIMO } from './geometria';
import { ESTADO_INICIAL } from './schema';
import type { PecaManifesto } from '@/lib/manifesto';

const peca: PecaManifesto = {
  fmaId: 'FMA1', nomeLatim: 'Cor', nomePt: 'Coração', nomeLeigo: 'coração', sistema: 'cardiovascular', lado: '-',
  glb: 'cardiovascular/FMA1.glb', bytes: 1, triangulos: 1, elementos: 1,
  bbox: { min: [-0.05, 1.15, 0.0], max: [0.07, 1.27, 0.12] }, centro: [0.01, 1.21, 0.06], vetorExplosao: [0.6, 0, 0.8],
};

describe('posicaoAlvo', () => {
  it('em casa e sem explosão é a origem', () => {
    expect(posicaoAlvo(peca, ESTADO_INICIAL)).toEqual([0, 0, 0]);
  });
  it('explosão desloca ao longo do vetorExplosao até DESLOCAMENTO_MAXIMO', () => {
    const p = posicaoAlvo(peca, { ...ESTADO_INICIAL, explosao: 1 });
    expect(p[0]).toBeCloseTo(0.6 * DESLOCAMENTO_MAXIMO); expect(p[1]).toBe(0); expect(p[2]).toBeCloseTo(0.8 * DESLOCAMENTO_MAXIMO);
  });
  it('peça solta ignora a explosão e fica onde foi largada', () => {
    expect(posicaoAlvo(peca, { ...ESTADO_INICIAL, explosao: 1, soltas: [{ fmaId: 'FMA1', pos: [0.3, 0, 0.1] }] })).toEqual([0.3, 0, 0.1]);
  });
});

describe('estaEmCasa', () => {
  it('dentro do raio de encaixe é casa; fora não', () => {
    expect(estaEmCasa([0.02, 0, 0])).toBe(true);
    expect(estaEmCasa([RAIO_ENCAIXE + 0.001, 0, 0])).toBe(false);
  });
});

describe('projetarNoPlanoDaCamera', () => {
  it('devolve o ponto onde o raio cruza o plano paralelo à câmera que passa pelo ponto de referência', () => {
    const raio = new Ray(new Vector3(0, 0, 5), new Vector3(0.1, 0, -1).normalize());
    const direcaoCamera = new Vector3(0, 0, -1);     // câmera olha para -z
    const ref = new Vector3(0, 0, 0);
    const p = projetarNoPlanoDaCamera(raio, direcaoCamera, ref)!;
    expect(p.z).toBeCloseTo(0); expect(p.x).toBeCloseTo(0.5);
  });
  it('devolve null quando o raio é paralelo ao plano', () => {
    const raio = new Ray(new Vector3(0, 0, 5), new Vector3(1, 0, 0));
    expect(projetarNoPlanoDaCamera(raio, new Vector3(0, 0, -1), new Vector3())).toBeNull();
  });
});

describe('câmera', () => {
  it('presets: frente vê +z, esquerda do paciente está em +x', () => {
    expect(PRESETS_CAMERA.frente.pos[2]).toBeGreaterThan(0);
    expect(PRESETS_CAMERA.costas.pos[2]).toBeLessThan(0);
    expect(PRESETS_CAMERA.esquerda.pos[0]).toBeGreaterThan(0);
    expect(PRESETS_CAMERA.direita.pos[0]).toBeLessThan(0);
    expect(PRESETS_CAMERA.superior.pos[1]).toBeGreaterThan(2);
  });
  it('enquadrar mira o centro e afasta proporcional ao tamanho, com limites', () => {
    const q = enquadrar(peca);
    expect(q.alvo).toEqual(peca.centro);
    expect(q.pos[2]).toBeGreaterThan(peca.centro[2]);
    const dist = Math.hypot(q.pos[0] - q.alvo[0], q.pos[1] - q.alvo[1], q.pos[2] - q.alvo[2]);
    expect(dist).toBeGreaterThanOrEqual(0.3); expect(dist).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `cd apps/web && pnpm test src/lib/estado/geometria`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar**

`apps/web/src/lib/estado/geometria.ts`:
```ts
import { Plane, Ray, Vector3 } from 'three';
import type { PecaManifesto } from '@/lib/manifesto';
import type { EstadoCena } from './schema';
import type { PresetCamera, Vec3 } from './store';

/** Deslocamento máximo da vista explodida, em metros, quando `explosao === 1` (spec §5). */
export const DESLOCAMENTO_MAXIMO = 0.4;
/** Raio, em metros, dentro do qual soltar a peça a devolve para casa (spec §5: 3 cm). */
export const RAIO_ENCAIXE = 0.03;
/** Distância em px que o ponteiro precisa andar para virar arrasto, e não clique. */
export const LIMIAR_ARRASTO_PX = 4;
export const DURACAO_ENCAIXE_MS = 250;

/** Posição do grupo da peça (casa = origem): solta → onde foi largada; senão, explosão. */
export function posicaoAlvo(peca: PecaManifesto, e: EstadoCena): Vec3 {
  const solta = e.soltas.find((s) => s.fmaId === peca.fmaId);
  if (solta) return solta.pos;
  const k = e.explosao * DESLOCAMENTO_MAXIMO;
  return [peca.vetorExplosao[0] * k, peca.vetorExplosao[1] * k, peca.vetorExplosao[2] * k];
}

export const estaEmCasa = (pos: Vec3): boolean => Math.hypot(pos[0], pos[1], pos[2]) <= RAIO_ENCAIXE;

/**
 * Ponto onde `raio` cruza o plano com normal `direcaoCamera` que passa por `referencia`
 * (o plano "paralelo à câmera" do spec). `null` se o raio for paralelo ao plano.
 */
export function projetarNoPlanoDaCamera(raio: Ray, direcaoCamera: Vector3, referencia: Vector3): Vector3 | null {
  const plano = new Plane().setFromNormalAndCoplanarPoint(direcaoCamera.clone().normalize(), referencia);
  return raio.intersectPlane(plano, new Vector3());
}

const ALVO_CORPO: Vec3 = [0, 0.85, 0];
export const PRESETS_CAMERA: Record<Exclude<PresetCamera, 'livre'>, { pos: Vec3; alvo: Vec3 }> = {
  frente:   { pos: [0, 1.0, 2.6],  alvo: ALVO_CORPO },
  costas:   { pos: [0, 1.0, -2.6], alvo: ALVO_CORPO },
  esquerda: { pos: [2.6, 1.0, 0],  alvo: ALVO_CORPO },   // +x = esquerda do paciente
  direita:  { pos: [-2.6, 1.0, 0], alvo: ALVO_CORPO },
  superior: { pos: [0, 3.4, 0.01], alvo: ALVO_CORPO },
};

/** Câmera de frente para a peça, a uma distância proporcional ao seu tamanho (0,3–3 m). */
export function enquadrar(peca: PecaManifesto): { pos: Vec3; alvo: Vec3 } {
  const { min, max } = peca.bbox;
  const tamanho = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const dist = Math.min(3, Math.max(0.3, tamanho * 2.5));
  const [cx, cy, cz] = peca.centro;
  return { pos: [cx, cy, cz + dist], alvo: [cx, cy, cz] };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd apps/web && pnpm test src/lib/estado/geometria`
Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): geometria de interação — explosão, encaixe, plano de arrasto, presets"
```

---

### Task 5: Busca e hooks utilitários

**Files:**
- Create: `apps/web/src/lib/busca.ts`
- Create: `apps/web/src/lib/hooks/useReducedMotion.ts`
- Create: `apps/web/src/lib/hooks/useAnimarPosicao.ts`
- Create: `apps/web/src/lib/hooks/useAtalhos.ts`
- Create: `apps/web/src/lib/hooks/useDeslizador.ts`
- Test: `apps/web/src/lib/busca.test.ts`

- [ ] **Step 1: Teste da busca**

`apps/web/src/lib/busca.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `cd apps/web && pnpm test src/lib/busca`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar a busca**

`apps/web/src/lib/busca.ts`:
```ts
import type { PecaManifesto } from './manifesto';

export const MAX_RESULTADOS = 20;
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function buscarPecas(pecas: PecaManifesto[], consulta: string): PecaManifesto[] {
  const q = normalizar(consulta);
  if (!q) return [];
  return pecas.filter((p) => [p.nomeLeigo, p.nomePt, p.nomeLatim].some((n) => normalizar(n).includes(q))).slice(0, MAX_RESULTADOS);
}
```

- [ ] **Step 4: Hooks (sem teste unitário: dependem de DOM/R3F; cobertos pelos E2E)**

`apps/web/src/lib/hooks/useReducedMotion.ts`:
```ts
'use client';
import { useEffect, useState } from 'react';
/** true quando o sistema pede menos movimento; as animações viram troca imediata. */
export function useReducedMotion(): boolean {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const atualizar = () => setReduzido(mq.matches);
    atualizar(); mq.addEventListener('change', atualizar);
    return () => mq.removeEventListener('change', atualizar);
  }, []);
  return reduzido;
}
```

`apps/web/src/lib/hooks/useAnimarPosicao.ts`:
```ts
'use client';
import { useEffect, useRef, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import type { Vec3 } from '@/lib/estado/store';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Leva `grupo.position` até `alvo` em `duracaoMs` com easing, chamando `invalidate()` a cada
 * quadro (o Canvas é `frameloop="demand"`). Duração 0 → aplica de imediato. Um alvo novo
 * cancela a animação em curso. `pausado` (arrasto em andamento) não anima nem aplica.
 */
export function useAnimarPosicao(grupo: RefObject<Group | null>, alvo: Vec3, duracaoMs: number, pausado = false) {
  const invalidate = useThree((s) => s.invalidate);
  const quadro = useRef<number | null>(null);
  useEffect(() => {
    const g = grupo.current;
    if (!g || pausado) return;
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    const de = g.position.clone();
    const [x, y, z] = alvo;
    if (duracaoMs <= 0 || de.distanceTo(new Vector3(x, y, z)) < 1e-6) { g.position.set(x, y, z); invalidate(); return; }
    const t0 = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - t0) / duracaoMs), k = easeOutCubic(t);
      g.position.set(de.x + (x - de.x) * k, de.y + (y - de.y) * k, de.z + (z - de.z) * k);
      invalidate();
      quadro.current = t < 1 ? requestAnimationFrame(passo) : null;
    };
    quadro.current = requestAnimationFrame(passo);
    return () => { if (quadro.current !== null) cancelAnimationFrame(quadro.current); };
  }, [grupo, alvo[0], alvo[1], alvo[2], duracaoMs, pausado, invalidate]);
}
```

`apps/web/src/lib/hooks/useAtalhos.ts`:
```ts
'use client';
import { useEffect } from 'react';
import { useLoja } from '@/lib/estado/store';

const emCampoDeTexto = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

/** Escape: sai da isolação e limpa a seleção. Cmd/Ctrl+Z desfaz; Shift+Cmd/Ctrl+Z ou Ctrl+Y refaz. */
export function useAtalhos() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const loja = useLoja.getState();
      if (e.key === 'Escape') { loja.isolar(null); loja.selecionar(null); return; }
      if (emCampoDeTexto(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? loja.refazer() : loja.desfazer(); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); loja.refazer(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
```

`apps/web/src/lib/hooks/useDeslizador.ts`:
```ts
'use client';
import { useEffect, useRef, type ChangeEvent } from 'react';
import { useLoja } from '@/lib/estado/store';
import type { EstadoCena } from '@/lib/estado/schema';

/**
 * Para `<input type="range">`: cada movimento aplica o valor SEM histórico (React `onChange`
 * dispara a cada `input`); o evento nativo `change` (soltar o mouse, ou o `fill` do Playwright)
 * registra UMA entrada de histórico com o estado de antes do gesto.
 */
export function useDeslizador(aplicar: (valor: number) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const antes = useRef<EstadoCena | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onChange = () => { if (antes.current) { useLoja.getState().registrarSnapshot(antes.current); antes.current = null; } };
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!antes.current) antes.current = useLoja.getState().estado;
    aplicar(Number(e.currentTarget.value));
  };
  return { ref, onChange };
}
```

- [ ] **Step 5: Rodar tudo**

Run: `cd apps/web && pnpm test && cd ../.. && pnpm typecheck`
Expected: `17 passed`; typecheck limpo.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): busca por nome; hooks de reduced-motion, animação de posição e atalhos"
```

---

### Task 6: `Peca` interativa, `Fantasma`, `Nota`, `Camera` e `Cena` ligada ao store

**Files:**
- Rewrite: `apps/web/src/components/viewer/Peca.tsx`
- Create: `apps/web/src/components/viewer/Fantasma.tsx`
- Create: `apps/web/src/components/viewer/Nota.tsx`
- Create: `apps/web/src/components/viewer/Camera.tsx`
- Modify: `apps/web/src/components/viewer/Cena.tsx`

- [ ] **Step 1: `Fantasma.tsx`**

```tsx
'use client';
import type { BufferGeometry, Matrix4 } from 'three';
import { materialFantasma } from '@/lib/materiais';

/** Wireframe translúcido na posição de casa (origem) de uma peça solta. */
export function Fantasma({ geometria, matriz }: { geometria: BufferGeometry; matriz: Matrix4 }) {
  return (
    <group matrix={matriz} matrixAutoUpdate={false}>
      <mesh geometry={geometria} material={materialFantasma()} raycast={() => null} />
    </group>
  );
}
```

- [ ] **Step 2: `Nota.tsx`**

```tsx
'use client';
import { Html } from '@react-three/drei';
import type { Vec3 } from '@/lib/estado/store';

/** Etiqueta HTML ancorada a um ponto 3D (nota do médico e/ou destaque). */
export function Nota({ posicao, texto, cor }: { posicao: Vec3; texto: string; cor: string | null }) {
  return (
    <Html position={posicao} center distanceFactor={1.2} zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
      <div className="nota" style={{ borderColor: cor ?? 'var(--muted)' }} data-testid="nota">{texto}</div>
    </Html>
  );
}
```

- [ ] **Step 3: `Camera.tsx` — presets e enquadramento aplicados ao OrbitControls**

```tsx
'use client';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useLoja } from '@/lib/estado/store';

/** Forma mínima do OrbitControls (three-stdlib) que usamos; o tipo real não é importável com pnpm estrito. */
export interface ControlesOrbita { enabled: boolean; target: Vector3; update(): void; }

/**
 * Sem UI: observa `estado.camera` e move câmera + alvo do OrbitControls quando ele muda por
 * ação nossa (preset, enquadrar, link). Mudanças feitas pelo mouse chegam ao store via `onEnd`
 * na Cena, com os mesmos valores, então não há laço.
 */
export function Camera() {
  const camera = useLoja((s) => s.estado.camera);
  const cam = useThree((s) => s.camera);
  const controlesBrutos = useThree((s) => s.controls);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const controles = controlesBrutos as unknown as ControlesOrbita | null;
    const pos = new Vector3(...camera.pos), alvo = new Vector3(...camera.alvo);
    if (cam.position.distanceTo(pos) < 1e-6 && controles && controles.target.distanceTo(alvo) < 1e-6) return;
    cam.position.copy(pos);
    if (controles) { controles.target.copy(alvo); controles.update(); } else cam.lookAt(alvo);
    invalidate();
  }, [camera, cam, controlesBrutos, invalidate]);
  return null;
}
```

- [ ] **Step 4: `Peca.tsx` (reescrever)**

```tsx
'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGLTF, Outlines, useCursor } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, Group, Mesh, Vector3, type BufferGeometry, type Matrix4, type MeshPhysicalMaterial } from 'three';
import { MeshoptDecoder } from 'meshoptimizer';
import { materialPara } from '@/lib/materiais';
import type { PecaManifesto } from '@/lib/manifesto';
import { useLoja, corDestaqueDe, notaDe, type Vec3 } from '@/lib/estado/store';
import { posicaoAlvo, estaEmCasa, projetarNoPlanoDaCamera, LIMIAR_ARRASTO_PX, DURACAO_ENCAIXE_MS } from '@/lib/estado/geometria';
import { useAnimarPosicao } from '@/lib/hooks/useAnimarPosicao';
import type { ControlesOrbita } from './Camera';
import { Fantasma } from './Fantasma';
import { Nota } from './Nota';

type EstenderLoader = NonNullable<Parameters<typeof useGLTF>[3]>;
const registrarDecodificador: EstenderLoader = (loader) => loader.setMeshoptDecoder(MeshoptDecoder);
const OPACIDADE_FORA_DA_ISOLACAO = 0.1;
const BRANCO = new Color('#ffffff');

/** Extrai geometria e matriz de desquantização do único Mesh do GLB. */
function malhaDoGltf(scene: Group): { geometria: BufferGeometry; matriz: Matrix4 } {
  scene.updateMatrixWorld(true);
  let malha: Mesh | null = null;
  scene.traverse((o) => { if (!malha && o instanceof Mesh) malha = o; });
  if (!malha) throw new Error('GLB sem Mesh');
  return { geometria: (malha as Mesh).geometry, matriz: (malha as Mesh).matrixWorld.clone() };
}

export const Peca = memo(function Peca({ peca, reduzirMovimento }: { peca: PecaManifesto; reduzirMovimento: boolean }) {
  const { scene } = useGLTF(`/models/${peca.glb}`, false, false, registrarDecodificador);
  const { geometria, matriz } = useMemo(() => malhaDoGltf(scene), [scene]);
  const three = useThree();
  const grupo = useRef<Group>(null);

  // --- estado que afeta esta peça (seletores finos: só re-renderiza quando algo dela muda)
  const opacidadeSistema = useLoja((s) => s.estado.opacidade[peca.sistema]);
  const isolada = useLoja((s) => s.estado.isolada);
  const alvo = useLoja(useShallow((s) => posicaoAlvo(peca, s.estado)));   // igualdade rasa: [x,y,z] iguais → sem re-render
  const solta = useLoja((s) => s.estado.soltas.some((x) => x.fmaId === peca.fmaId));
  const cor = useLoja((s) => corDestaqueDe(s.estado, peca.fmaId));
  const nota = useLoja((s) => notaDe(s.estado, peca.fmaId));
  const selecionada = useLoja((s) => s.selecionada === peca.fmaId);
  const emHover = useLoja((s) => s.hover === peca.fmaId);
  const arrastando = useLoja((s) => s.arrastando === peca.fmaId);
  const { selecionar, passarMouse, definirArrastando, soltar, encaixar, isolar } = useLoja.getState();

  // --- material próprio (opacidade/emissivo por peça), derivado do material do sistema
  const material = useMemo(() => materialPara(peca.sistema, peca.nomeLatim).clone() as MeshPhysicalMaterial, [peca.sistema, peca.nomeLatim]);
  useEffect(() => () => material.dispose(), [material]);
  const opacidade = opacidadeSistema * (isolada && isolada !== peca.fmaId ? OPACIDADE_FORA_DA_ISOLACAO : 1);
  useEffect(() => {
    material.opacity = opacidade;
    material.transparent = opacidade < 1;
    material.depthWrite = opacidade >= 1;
    material.needsUpdate = true;
    three.invalidate();
  }, [material, opacidade, three]);
  useEffect(() => {
    const intensidade = cor ? 0.45 : emHover ? 0.18 : 0;
    material.emissive.copy(cor ? new Color(cor) : BRANCO);
    material.emissiveIntensity = intensidade;
    three.invalidate();
  }, [material, cor, emHover, three]);

  // --- posição: animada, exceto durante o arrasto
  useAnimarPosicao(grupo, alvo, reduzirMovimento ? 0 : DURACAO_ENCAIXE_MS, arrastando);
  useCursor(emHover && !arrastando, 'grab', 'auto');

  // --- arrasto (spec §5): plano paralelo à câmera pelo centro da peça
  const inicio = useRef<{ x: number; y: number; deslocamento: Vector3; plano: Vector3 } | null>(null);
  const [virouArrasto, setVirouArrasto] = useState(false);

  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || opacidade < 0.5) return;           // peças quase invisíveis não capturam
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const g = grupo.current!;
    const direcao = three.camera.getWorldDirection(new Vector3());   // normal do plano de arrasto
    inicio.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, deslocamento: e.point.clone().sub(g.position), plano: direcao };
    setVirouArrasto(false);
  }, [opacidade, three.camera]);

  const onPointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    const ini = inicio.current; const g = grupo.current;
    if (!ini || !g) return;
    const dx = e.nativeEvent.clientX - ini.x, dy = e.nativeEvent.clientY - ini.y;
    if (!virouArrasto) {
      if (Math.hypot(dx, dy) < LIMIAR_ARRASTO_PX) return;
      setVirouArrasto(true); definirArrastando(peca.fmaId);
      const c = three.controls as unknown as ControlesOrbita | null; if (c) c.enabled = false;
    }
    const referencia = g.position.clone().add(ini.deslocamento);
    const p = projetarNoPlanoDaCamera(e.ray, ini.plano, referencia);
    if (!p) return;
    g.position.copy(p.sub(ini.deslocamento));
    three.invalidate();
  }, [virouArrasto, definirArrastando, peca.fmaId, three]);

  const onPointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    const g = grupo.current; const ini = inicio.current; inicio.current = null;
    if (!g || !ini) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    if (!virouArrasto) { selecionar(peca.fmaId); return; }    // foi clique
    const c = three.controls as unknown as ControlesOrbita | null; if (c) c.enabled = true;
    const pos: Vec3 = [g.position.x, g.position.y, g.position.z];
    // primeiro o destino novo, depois liberar a animação: assim ela parte para o alvo certo
    if (estaEmCasa(pos)) encaixar(peca.fmaId); else soltar(peca.fmaId, pos);
    setVirouArrasto(false); definirArrastando(null);
  }, [virouArrasto, selecionar, definirArrastando, encaixar, soltar, peca.fmaId, three]);

  const onDoubleClick = useCallback((e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); isolar(isolada === peca.fmaId ? null : peca.fmaId); }, [isolar, isolada, peca.fmaId]);
  const onPointerOver = useCallback((e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); passarMouse(peca.fmaId); }, [passarMouse, peca.fmaId]);
  const onPointerOut = useCallback(() => { if (useLoja.getState().hover === peca.fmaId) passarMouse(null); }, [passarMouse, peca.fmaId]);

  const centroNoGrupo = useMemo<Vec3>(() => [peca.centro[0], peca.bbox.max[1] + 0.03, peca.centro[2]], [peca]);

  return (
    <>
      {solta && <Fantasma geometria={geometria} matriz={matriz} />}
      <group ref={grupo} name={peca.fmaId}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
        <group matrix={matriz} matrixAutoUpdate={false}>
          <mesh geometry={geometria} material={material}>
            {(selecionada || emHover) && <Outlines thickness={selecionada ? 0.006 : 0.003} color={selecionada ? '#ffffff' : '#cfd8e3'} />}
          </mesh>
        </group>
        {(nota || cor) && <Nota posicao={centroNoGrupo} texto={nota || peca.nomeLeigo} cor={cor} />}
      </group>
    </>
  );
});
```

Observações para quem implementa:
- `Outlines` desenha uma cópia expandida da malha; em malhas de duas faces pode aparecer "sujo". Se acontecer, remover o `Outlines` e manter só o emissivo de hover (já existe). Reportar a decisão.
- Se `e.target.setPointerCapture` não existir no alvo (R3F devolve o `canvas`), o arrasto continua funcionando porque o R3F reenvia `pointermove` para o objeto que iniciou o `pointerdown` enquanto o botão estiver pressionado; nesse caso remover as duas linhas de captura.

- [ ] **Step 5: `Cena.tsx` (modificar) — store, Bvh, controles com `onEnd`, atributos de teste**

```tsx
'use client';
import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Bvh, Environment, OrbitControls } from '@react-three/drei';
import { carregarManifesto } from '@/lib/manifesto';
import { useLoja } from '@/lib/estado/store';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { Peca } from './Peca';
import { Camera, type ControlesOrbita } from './Camera';

/** Espelha câmera/alvo do OrbitControls no store ao fim de cada gesto (sem histórico). */
function SincronizarCamera() {
  const three = useThree();
  const definirCamera = useLoja((s) => s.definirCamera);
  const definirPreset = useLoja((s) => s.definirPreset);
  return (
    <OrbitControls target={[0, 0.85, 0]} makeDefault enableDamping={false}
      onEnd={() => {
        const c = three.controls as unknown as ControlesOrbita | null; if (!c) return;
        const p = three.camera.position, t = c.target;
        definirCamera([p.x, p.y, p.z], [t.x, t.y, t.z]); definirPreset('livre');
      }} />
  );
}

export function Cena() {
  const manifesto = useLoja((s) => s.manifesto);
  const definirManifesto = useLoja((s) => s.definirManifesto);
  const estado = useLoja((s) => s.estado);
  const selecionada = useLoja((s) => s.selecionada);
  const presetCamera = useLoja((s) => s.presetCamera);
  const historico = useLoja((s) => s.historico.length);
  const reduzir = useReducedMotion();
  const erro = useLoja((s) => s.erroManifesto);
  const setErro = useLoja((s) => s.definirErroManifesto);

  useEffect(() => {
    if (manifesto) return;
    let ativo = true;
    carregarManifesto().then((m) => { if (ativo) definirManifesto(m); }).catch((e: Error) => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, [manifesto, definirManifesto, setErro]);

  if (erro) return <p role="alert" data-testid="erro">Não foi possível carregar os modelos: {erro}</p>;
  if (!manifesto) return <p data-testid="carregando">Carregando manifesto…</p>;

  const visiveis = manifesto.pecas.filter((p) => estado.opacidade[p.sistema] > 0 && !estado.ocultas.includes(p.fmaId));

  return (
    <div data-testid="cena" data-pecas={manifesto.pecas.length} data-visiveis={visiveis.length}
      data-selecionada={selecionada ?? ''} data-isolada={estado.isolada ?? ''} data-soltas={estado.soltas.length}
      data-explosao={estado.explosao} data-historico={historico} data-camera={presetCamera}
      style={{ position: 'absolute', inset: 0 }}>
      <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 1.0, 2.6], fov: 40, near: 0.01, far: 20 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => useLoja.getState().selecionar(null)}>
        <color attach="background" args={['#101214']} />
        <Environment files="/hdri/studio_small_09_1k.hdr" />
        <Suspense fallback={null}>
          <Bvh firstHitOnly>
            {visiveis.map((p) => <Peca key={p.fmaId} peca={p} reduzirMovimento={reduzir} />)}
          </Bvh>
        </Suspense>
        <SincronizarCamera />
        <Camera />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 6: `page.tsx` provisório e verificação manual**

Por enquanto `page.tsx` continua renderizando `<Cena />` (o `Estudio` chega na Tarefa 7). Rodar:

Run: `cd ~/Projetos/corpo3d && pnpm typecheck && (cd apps/web && pnpm test:e2e)`
Expected: typecheck limpo; `6 passed` (a fase 0 continua: 251 GLBs, pixels, atribuição). Se `Bvh` lançar erro com geometria quantizada (posições `Int16`), remover o `<Bvh>` (manter os filhos) e reportar; o arrasto fica um pouco mais pesado mas funciona.

Verificação no navegador (`pnpm --filter @corpo3d/web dev`, abrir `http://localhost:3020`): passar o mouse contorna a peça sob o cursor; clique seleciona (contorno branco); duplo clique isola (resto a 10%); Escape desfaz a isolação; arrastar a pele para fora deixa um fantasma azul no lugar; arrastar de volta encaixa. Tirar um screenshot com uma peça solta e olhar.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(web): peça interativa — hover, seleção, isolação, arrasto com fantasma e encaixe"
```

---

### Task 7: Estúdio — layout, camadas, controles (explosão, remontar, desfazer/refazer, câmera)

**Files:**
- Create: `apps/web/src/components/estudio/Estudio.tsx`, `PainelCamadas.tsx`, `Controles.tsx`
- Modify: `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`
- Test: `apps/web/e2e/interacao.spec.ts` (parte 1)

- [ ] **Step 1: E2E primeiro (falha até o estúdio existir)**

`apps/web/e2e/interacao.spec.ts`:
```ts
import { test, expect, type Page } from '@playwright/test';

async function abrir(page: Page) {
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '251');
  await expect(cena).toHaveAttribute('data-visiveis', '251');
  return cena;
}

test('camadas: opacidade 0 desmonta as peças do sistema; 1 remonta', async ({ page }) => {
  const cena = await abrir(page);
  await page.getByLabel('Pele').fill('0');
  await expect(cena).toHaveAttribute('data-visiveis', '250');
  await page.getByLabel('Músculos').fill('0');
  await expect(cena).toHaveAttribute('data-visiveis', '196');      // 250 - 54 músculos
  await page.getByLabel('Pele').fill('1');
  await expect(cena).toHaveAttribute('data-visiveis', '197');
});

test('explosão, remontar tudo e desfazer/refazer', async ({ page }) => {
  const cena = await abrir(page);
  await page.getByLabel('Explosão').fill('0.5');
  await expect(cena).toHaveAttribute('data-explosao', '0.5');
  await page.getByRole('button', { name: 'Remontar tudo' }).click();
  await expect(cena).toHaveAttribute('data-explosao', '0');
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(cena).toHaveAttribute('data-explosao', '0.5');
  await page.getByRole('button', { name: 'Refazer' }).click();
  await expect(cena).toHaveAttribute('data-explosao', '0');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(cena).toHaveAttribute('data-explosao', '0.5');
});

test('presets de câmera', async ({ page }) => {
  const cena = await abrir(page);
  await expect(cena).toHaveAttribute('data-camera', 'frente');
  await page.getByRole('button', { name: 'Costas' }).click();
  await expect(cena).toHaveAttribute('data-camera', 'costas');
  await page.getByRole('button', { name: 'Superior' }).click();
  await expect(cena).toHaveAttribute('data-camera', 'superior');
  await page.getByRole('button', { name: 'Recentrar' }).click();
  await expect(cena).toHaveAttribute('data-camera', 'frente');
});
```

Run: `cd apps/web && pnpm exec playwright test e2e/interacao.spec.ts --project=desktop`
Expected: FAIL (não existe `Pele` como label etc.)

- [ ] **Step 2: `PainelCamadas.tsx`**

```tsx
'use client';
import { SISTEMAS, ROTULO_SISTEMA, type Sistema } from '@/lib/manifesto';
import { useLoja } from '@/lib/estado/store';
import { useDeslizador } from '@/lib/hooks/useDeslizador';

function Camada({ sistema }: { sistema: Sistema }) {
  const valor = useLoja((s) => s.estado.opacidade[sistema]);
  const definirOpacidade = useLoja((s) => s.definirOpacidade);
  const deslizador = useDeslizador((v) => definirOpacidade(sistema, v, { historico: false }));
  return (
    <label className="camada">
      <span>{ROTULO_SISTEMA[sistema]}</span>
      <input type="range" min={0} max={1} step={0.05} value={valor} aria-label={ROTULO_SISTEMA[sistema]} {...deslizador} />
      <output aria-hidden>{Math.round(valor * 100)}%</output>
    </label>
  );
}

export function PainelCamadas() {
  return (
    <section aria-labelledby="camadas-titulo" className="painel-bloco">
      <h2 id="camadas-titulo">Camadas</h2>
      {SISTEMAS.map((s) => <Camada key={s} sistema={s} />)}
    </section>
  );
}
```

- [ ] **Step 3: `Controles.tsx`**

```tsx
'use client';
import { useLoja } from '@/lib/estado/store';
import { PRESETS_CAMERA } from '@/lib/estado/geometria';
import { useDeslizador } from '@/lib/hooks/useDeslizador';

const ROTULO_PRESET = { frente: 'Frente', costas: 'Costas', esquerda: 'Esquerda', direita: 'Direita', superior: 'Superior' } as const;

export function Controles() {
  const explosao = useLoja((s) => s.estado.explosao);
  const podeDesfazer = useLoja((s) => s.historico.length > 0);
  const podeRefazer = useLoja((s) => s.futuro.length > 0);
  const soltas = useLoja((s) => s.estado.soltas.length);
  const { definirExplosao, remontarTudo, desfazer, refazer, definirCamera, definirPreset } = useLoja.getState();
  const deslizador = useDeslizador((v) => definirExplosao(v, { historico: false }));
  const irPara = (p: keyof typeof PRESETS_CAMERA) => { definirCamera(PRESETS_CAMERA[p].pos, PRESETS_CAMERA[p].alvo); definirPreset(p); };
  return (
    <section aria-labelledby="controles-titulo" className="painel-bloco">
      <h2 id="controles-titulo">Montagem</h2>
      <label className="camada"><span>Explosão</span>
        <input type="range" min={0} max={1} step={0.05} value={explosao} aria-label="Explosão" {...deslizador} />
      </label>
      <div className="linha-botoes">
        <button type="button" onClick={remontarTudo} disabled={explosao === 0 && soltas === 0}>Remontar tudo</button>
        <button type="button" onClick={desfazer} disabled={!podeDesfazer} aria-keyshortcuts="Meta+Z Control+Z">Desfazer</button>
        <button type="button" onClick={refazer} disabled={!podeRefazer} aria-keyshortcuts="Shift+Meta+Z Shift+Control+Z">Refazer</button>
      </div>
      <h2>Câmera</h2>
      <div className="linha-botoes">
        {(Object.keys(ROTULO_PRESET) as (keyof typeof ROTULO_PRESET)[]).map((p) => (
          <button key={p} type="button" onClick={() => irPara(p)}>{ROTULO_PRESET[p]}</button>
        ))}
        <button type="button" onClick={() => irPara('frente')}>Recentrar</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: `Estudio.tsx` e `page.tsx`**

`apps/web/src/components/estudio/Estudio.tsx`:
```tsx
'use client';
import { Cena } from '@/components/viewer/Cena';
import { useAtalhos } from '@/lib/hooks/useAtalhos';
import { PainelCamadas } from './PainelCamadas';
import { Controles } from './Controles';

export function Estudio() {
  useAtalhos();
  return (
    <div className="estudio">
      <aside className="painel painel-esquerdo" aria-label="Camadas e montagem">
        <PainelCamadas />
        <Controles />
      </aside>
      <section className="palco" aria-label="Modelo 3D">
        <Cena />
      </section>
      <aside className="painel painel-direito" aria-label="Peça selecionada" data-testid="painel-peca" />
    </div>
  );
}
```

`apps/web/src/app/page.tsx`:
```tsx
import Link from 'next/link';
import { Estudio } from '@/components/estudio/Estudio';

export default function Pagina() {
  return (
    <main>
      <h1 className="titulo">Corpo3D</h1>
      <Estudio />
      <p className="rodape">
        Modelos: BodyParts3D, © The Database Center for Life Science, CC BY 4.0 · <Link href="/atribuicao">atribuição</Link>
      </p>
    </main>
  );
}
```

`apps/web/src/app/globals.css` (substituir o conteúdo):
```css
:root { color-scheme: dark; --bg: #101214; --painel: #171a1e; --borda: #2a2f36; --fg: #e9e6e1; --muted: #9a958e; --acento: #ffd166; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; }
main { position: relative; height: 100vh; }
.titulo { position: absolute; margin: 0; padding: 12px 16px; font-size: 16px; z-index: 2; pointer-events: none; }
.estudio { display: grid; grid-template-columns: 280px 1fr 320px; height: 100vh; }
.painel { overflow-y: auto; background: var(--painel); border-color: var(--borda); padding: 48px 14px 14px; font-size: 13px; }
.painel-esquerdo { border-right: 1px solid var(--borda); }
.painel-direito { border-left: 1px solid var(--borda); }
.palco { position: relative; min-width: 0; }
.painel-bloco h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 16px 0 8px; }
.camada { display: grid; grid-template-columns: 1fr 90px 40px; align-items: center; gap: 8px; margin: 4px 0; }
.camada output { text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
input[type="range"] { width: 100%; accent-color: var(--acento); }
.linha-botoes { display: flex; flex-wrap: wrap; gap: 6px; }
button { background: #22262c; color: var(--fg); border: 1px solid var(--borda); border-radius: 6px; padding: 6px 10px; font: inherit; cursor: pointer; }
button:hover:not(:disabled) { border-color: var(--acento); }
button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }
button:disabled { opacity: .45; cursor: default; }
.nota { max-width: 220px; padding: 4px 8px; border: 1.5px solid; border-radius: 6px; background: rgba(16,18,20,.85); color: var(--fg); font-size: 12px; white-space: pre-wrap; }
.rodape { position: absolute; left: 292px; bottom: 10px; font-size: 12px; color: var(--muted); z-index: 2; }
.rodape a { color: inherit; }
@media (max-width: 900px) {
  .estudio { grid-template-columns: 1fr; grid-template-rows: 60vh auto auto; height: auto; }
  .palco { height: 60vh; }
  .painel { padding-top: 14px; border: 0; }
  .painel-esquerdo { order: 2; } .painel-direito { order: 3; }
  .titulo { position: static; padding: 10px 14px; }
  .rodape { position: static; padding: 8px 14px; }
}
```

- [ ] **Step 5: Rodar os E2E**

Run: `cd apps/web && pnpm exec playwright test e2e/interacao.spec.ts --project=desktop`
Expected: `3 passed`. Depois a suíte inteira: `pnpm test:e2e` → `15 passed` (5 testes × 3 projetos). O `fill()` do Playwright dispara `input` e depois `change`, que é o que o `useDeslizador` espera; se `data-historico` não subir depois de um `fill`, verificar se o listener nativo de `change` está registrado (o `ref` precisa chegar ao `<input>`).

Os dois E2E da fase 0 (`visualizador.spec.ts`) continuam passando: o `data-pecas` e o canvas ainda existem.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): estúdio com camadas, explosão, remontar tudo, desfazer/refazer e presets de câmera"
```

---

### Task 8: Painel da peça — nomes, blocos, destaque, nota, ações

**Files:**
- Create: `apps/web/src/components/estudio/PainelPeca.tsx`
- Modify: `apps/web/src/components/estudio/Estudio.tsx`
- Test: `apps/web/e2e/interacao.spec.ts` (parte 2)

- [ ] **Step 1: E2E**

Acrescentar em `apps/web/e2e/interacao.spec.ts`:
```ts
test('selecionar pelo clique abre o painel; isolar; ocultar; destaque e nota', async ({ page }) => {
  const cena = await abrir(page);
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);   // tronco: acerta a pele
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA7163');
  const painel = page.getByTestId('painel-peca');
  await expect(painel.getByRole('heading', { level: 2 })).toHaveText('pele');
  await expect(painel.getByText('Cutis')).toBeVisible();
  await expect(painel.getByText('Descrição em revisão médica')).toHaveCount(3);

  await painel.getByRole('button', { name: 'Isolar' }).click();
  await expect(cena).toHaveAttribute('data-isolada', 'FMA7163');
  await page.keyboard.press('Escape');
  await expect(cena).toHaveAttribute('data-isolada', '');
  await expect(cena).toHaveAttribute('data-selecionada', '');

  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);
  await painel.getByRole('button', { name: 'Ocultar peça' }).click();
  await expect(cena).toHaveAttribute('data-visiveis', '250');
  await painel.getByRole('button', { name: 'Mostrar peça' }).click();
  await expect(cena).toHaveAttribute('data-visiveis', '251');

  await painel.getByRole('radio', { name: 'Destaque amarelo' }).check();
  await painel.getByLabel('Nota para o paciente').fill('Aqui é a pele.');
  await expect(page.getByTestId('nota')).toHaveText('Aqui é a pele.');
  await expect(painel.getByText('Não escreva nome, CPF')).toBeVisible();
  await expect(painel.getByLabel('Nota para o paciente')).toHaveAttribute('maxlength', '280');
});
```

Run: `cd apps/web && pnpm exec playwright test e2e/interacao.spec.ts --project=desktop -g "selecionar"`
Expected: FAIL (painel vazio)

- [ ] **Step 2: `PainelPeca.tsx`**

```tsx
'use client';
import { useLoja, corDestaqueDe, notaDe, type CorDestaque } from '@/lib/estado/store';
import { CORES_DESTAQUE, MAX_NOTA } from '@/lib/estado/schema';
import { enquadrar } from '@/lib/estado/geometria';
import { ROTULO_SISTEMA } from '@/lib/manifesto';

const NOME_COR: Record<CorDestaque, string> = { '#ffd166': 'amarelo', '#06d6a0': 'verde', '#118ab2': 'azul', '#ef476f': 'rosa', '#c77dff': 'roxo' };
const BLOCOS = ['O que é', 'O que faz', 'O que costuma dar errado'] as const;

export function PainelPeca() {
  const fmaId = useLoja((s) => s.selecionada);
  const peca = useLoja((s) => s.manifesto?.pecas.find((p) => p.fmaId === fmaId) ?? null);
  const estado = useLoja((s) => s.estado);
  const { isolar, alternarOculta, soltar, encaixar, destacar, anotar, definirCamera, definirPreset } = useLoja.getState();
  if (!peca) return <p className="dica">Clique numa peça do modelo, ou busque pelo nome, para ver os detalhes.</p>;

  const cor = corDestaqueDe(estado, peca.fmaId);
  const nota = notaDe(estado, peca.fmaId);
  const oculta = estado.ocultas.includes(peca.fmaId);
  const solta = estado.soltas.some((s) => s.fmaId === peca.fmaId);
  const isolada = estado.isolada === peca.fmaId;
  const focar = () => { const q = enquadrar(peca); definirCamera(q.pos, q.alvo); definirPreset('livre'); };
  const desmontar = () => {
    const [x, y, z] = peca.vetorExplosao; const k = 0.25;
    soltar(peca.fmaId, [x * k, y * k, z * k]);
  };

  return (
    <div className="painel-peca">
      <p className="sistema">{ROTULO_SISTEMA[peca.sistema]}{peca.lado !== '-' && ` · lado ${peca.lado === 'D' ? 'direito' : 'esquerdo'}`}</p>
      <h2 className="nome-leigo">{peca.nomeLeigo}</h2>
      <p className="nomes"><span>{peca.nomePt}</span> · <i lang="la">{peca.nomeLatim}</i></p>
      {BLOCOS.map((b) => (
        <section key={b} className="bloco"><h3>{b}</h3><p className="rascunho">Descrição em revisão médica</p></section>
      ))}
      <div className="linha-botoes">
        <button type="button" onClick={focar}>Focar</button>
        <button type="button" onClick={() => isolar(isolada ? null : peca.fmaId)}>{isolada ? 'Sair da isolação' : 'Isolar'}</button>
        <button type="button" onClick={() => alternarOculta(peca.fmaId)}>{oculta ? 'Mostrar peça' : 'Ocultar peça'}</button>
        <button type="button" onClick={() => (solta ? encaixar(peca.fmaId) : desmontar())}>{solta ? 'Encaixar' : 'Desmontar'}</button>
      </div>
      <fieldset className="destaque">
        <legend>Destaque</legend>
        <label><input type="radio" name="destaque" checked={cor === null} onChange={() => destacar(peca.fmaId, null)} aria-label="Sem destaque" /> nenhum</label>
        {CORES_DESTAQUE.map((c) => (
          <label key={c} className="cor"><input type="radio" name="destaque" checked={cor === c} onChange={() => destacar(peca.fmaId, c)} aria-label={`Destaque ${NOME_COR[c]}`} />
            <span style={{ background: c }} aria-hidden /></label>
        ))}
      </fieldset>
      <label className="nota-campo">
        <span>Nota para o paciente</span>
        <textarea rows={3} maxLength={MAX_NOTA} value={nota} onChange={(e) => anotar(peca.fmaId, e.currentTarget.value)} />
        <small>Não escreva nome, CPF ou dados que identifiquem o paciente. {nota.length}/{MAX_NOTA}</small>
      </label>
    </div>
  );
}
```

Em `Estudio.tsx`, importar `PainelPeca` e renderizar dentro do `<aside … data-testid="painel-peca">`.

Acrescentar em `globals.css`:
```css
.dica, .rascunho { color: var(--muted); }
.sistema { margin: 0; font-size: 12px; color: var(--muted); }
.nome-leigo { margin: 4px 0 2px; font-size: 22px; text-transform: none; letter-spacing: 0; color: var(--fg); }
.nomes { margin: 0 0 12px; color: var(--muted); }
.bloco h3 { margin: 10px 0 2px; font-size: 13px; }
.bloco p { margin: 0; }
.destaque { border: 1px solid var(--borda); border-radius: 6px; margin: 12px 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.destaque .cor span { display: inline-block; width: 18px; height: 18px; border-radius: 50%; vertical-align: middle; }
.nota-campo { display: grid; gap: 4px; }
.nota-campo textarea { font: inherit; background: #0d0f12; color: var(--fg); border: 1px solid var(--borda); border-radius: 6px; padding: 6px; resize: vertical; }
.nota-campo small { color: var(--muted); }
```

- [ ] **Step 3: Rodar**

Run: `cd apps/web && pnpm exec playwright test e2e/interacao.spec.ts --project=desktop`
Expected: `4 passed`. Se o clique no tronco não selecionar `FMA7163` (pele) em algum viewport, o problema é o ponto de clique, não a lógica: ajustar `0.45` para a altura do abdome no screenshot da fase 0 (o corpo ocupa ~5%–100% da altura; o tronco está entre 25% e 55%).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(web): painel da peça — nomes, blocos, focar, isolar, ocultar, desmontar, destaque e nota"
```

---

### Task 9: Busca, lista de peças navegável por teclado, axe

**Files:**
- Create: `apps/web/src/components/estudio/Busca.tsx`, `ListaPecas.tsx`
- Modify: `apps/web/src/components/estudio/Estudio.tsx`
- Test: `apps/web/e2e/acessibilidade.spec.ts`

- [ ] **Step 1: E2E**

`apps/web/e2e/acessibilidade.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('busca por nome seleciona e foca a peça', async ({ page }) => {
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '251');
  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('figado');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Fígado/ }).click();
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA7197');
  await expect(cena).toHaveAttribute('data-camera', 'livre');
  await expect(page.getByTestId('painel-peca').getByRole('heading', { level: 2 })).toHaveText('fígado');
});

test('lista de peças: teclado seleciona (Enter) e desmonta/encaixa (Espaço)', async ({ page }) => {
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '251');
  const item = page.getByRole('listbox', { name: 'Peças' }).getByRole('option', { name: /Coração/ });
  await item.focus();
  await page.keyboard.press('Enter');
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA7088');
  await page.keyboard.press('Space');
  await expect(cena).toHaveAttribute('data-soltas', '1');
  await page.keyboard.press('Space');
  await expect(cena).toHaveAttribute('data-soltas', '0');
});

test('sem violações sérias do axe nos painéis', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('cena')).toHaveAttribute('data-pecas', '251');
  const r = await new AxeBuilder({ page }).exclude('canvas').analyze();
  const serias = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serias.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});
```

Run: `cd apps/web && pnpm exec playwright test e2e/acessibilidade.spec.ts --project=desktop`
Expected: FAIL (não há busca nem lista)

- [ ] **Step 2: `Busca.tsx`**

```tsx
'use client';
import { useId, useState } from 'react';
import { buscarPecas } from '@/lib/busca';
import { enquadrar } from '@/lib/estado/geometria';
import { useLoja } from '@/lib/estado/store';
import type { PecaManifesto } from '@/lib/manifesto';

export function Busca() {
  const [consulta, setConsulta] = useState('');
  const pecas = useLoja((s) => s.manifesto?.pecas ?? []);
  const id = useId();
  const resultados = buscarPecas(pecas, consulta);
  const escolher = (p: PecaManifesto) => {
    const { selecionar, definirCamera, definirPreset } = useLoja.getState();
    selecionar(p.fmaId); const q = enquadrar(p); definirCamera(q.pos, q.alvo); definirPreset('livre'); setConsulta('');
  };
  return (
    <section className="painel-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`}>Buscar</h2>
      <input type="search" role="searchbox" aria-label="Buscar peça" placeholder="fígado, fêmur, hepar…" value={consulta}
        onChange={(e) => setConsulta(e.currentTarget.value)} aria-controls={`${id}-lista`} />
      {resultados.length > 0 && (
        <ul id={`${id}-lista`} role="listbox" aria-label="Resultados" className="resultados">
          {resultados.map((p) => (
            <li key={p.fmaId} role="option" aria-selected={false} tabIndex={0}
              onClick={() => escolher(p)} onKeyDown={(e) => { if (e.key === 'Enter') escolher(p); }}>
              <b>{p.nomePt}</b> <span>{p.nomeLeigo}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 3: `ListaPecas.tsx`**

```tsx
'use client';
import { useLoja } from '@/lib/estado/store';
import { enquadrar } from '@/lib/estado/geometria';
import { SISTEMAS, ROTULO_SISTEMA, type PecaManifesto } from '@/lib/manifesto';

/** Todas as peças, agrupadas por sistema: Enter seleciona e foca, Espaço desmonta/encaixa. */
export function ListaPecas() {
  const pecas = useLoja((s) => s.manifesto?.pecas ?? []);
  const selecionada = useLoja((s) => s.selecionada);
  const soltas = useLoja((s) => s.estado.soltas);
  const agir = (p: PecaManifesto, acao: 'selecionar' | 'alternar') => {
    const loja = useLoja.getState();
    if (acao === 'selecionar') { loja.selecionar(p.fmaId); const q = enquadrar(p); loja.definirCamera(q.pos, q.alvo); loja.definirPreset('livre'); return; }
    if (soltas.some((s) => s.fmaId === p.fmaId)) loja.encaixar(p.fmaId);
    else { const [x, y, z] = p.vetorExplosao; loja.soltar(p.fmaId, [x * 0.25, y * 0.25, z * 0.25]); }
  };
  return (
    <details className="painel-bloco" open>
      <summary>Todas as peças ({pecas.length})</summary>
      <ul role="listbox" aria-label="Peças" className="lista-pecas">
        {SISTEMAS.map((s) => (
          <li key={s} role="presentation">
            <p className="grupo">{ROTULO_SISTEMA[s]}</p>
            <ul role="group" aria-label={ROTULO_SISTEMA[s]}>
              {pecas.filter((p) => p.sistema === s).map((p) => (
                <li key={p.fmaId} role="option" tabIndex={0} aria-selected={selecionada === p.fmaId}
                  onClick={() => agir(p, 'selecionar')}
                  onKeyDown={(e) => { if (e.key === 'Enter') agir(p, 'selecionar'); if (e.key === ' ') { e.preventDefault(); agir(p, 'alternar'); } }}>
                  {p.nomePt}{soltas.some((x) => x.fmaId === p.fmaId) && <span aria-label="solta"> ⇢</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}
```

Em `Estudio.tsx`, o painel esquerdo passa a ser: `<Busca />`, `<PainelCamadas />`, `<Controles />`, `<ListaPecas />` (nessa ordem).

`globals.css`, acrescentar:
```css
input[type="search"] { width: 100%; box-sizing: border-box; font: inherit; background: #0d0f12; color: var(--fg); border: 1px solid var(--borda); border-radius: 6px; padding: 6px 8px; }
.resultados, .lista-pecas, .lista-pecas ul { list-style: none; margin: 4px 0 0; padding: 0; }
.resultados li, .lista-pecas [role="option"] { padding: 4px 6px; border-radius: 4px; cursor: pointer; }
.resultados li:hover, .lista-pecas [role="option"]:hover { background: #22262c; }
.lista-pecas [aria-selected="true"] { background: #2b2f36; outline: 1px solid var(--acento); }
.resultados span { color: var(--muted); }
.grupo { margin: 8px 0 2px; font-size: 11px; color: var(--muted); text-transform: uppercase; }
details > summary { cursor: pointer; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; margin: 16px 0 8px; }
```

- [ ] **Step 4: Rodar e corrigir o que o axe apontar**

Run: `cd apps/web && pnpm exec playwright test e2e/acessibilidade.spec.ts --project=desktop`
Expected: `3 passed`. Se o axe acusar `color-contrast` em `--muted` sobre `--painel`, escurecer o painel ou clarear `--muted` para `#a8a39c` e reportar; se acusar `aria-required-children` no listbox aninhado, trocar os `role="group"` internos por `role="presentation"` e mover `aria-label` para um `p` visível.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): busca por nome, lista de peças com teclado, verificação axe"
```

---

### Task 10: E2E do arrasto com o mouse e do `prefers-reduced-motion`

**Files:**
- Test: `apps/web/e2e/arrasto.spec.ts`

- [ ] **Step 1: Teste**

`apps/web/e2e/arrasto.spec.ts`:
```ts
import { test, expect, type Page } from '@playwright/test';

/** Deixa o esterno exposto e centralizado: pele e músculos a 0, busca "esterno", foca. */
async function prepararEsterno(page: Page) {
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '251');
  await page.getByLabel('Pele').fill('0');
  await page.getByLabel('Músculos').fill('0');
  await expect(cena).toHaveAttribute('data-visiveis', '196');
  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('esterno');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Esterno osso/ }).click();
  await expect(cena).toHaveAttribute('data-selecionada', 'FMA7485');
  const box = (await page.locator('canvas').boundingBox())!;
  return { cena, cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

test('arrastar para fora solta a peça (fantasma no lugar); arrastar de volta encaixa', async ({ page }) => {
  const { cena, cx, cy } = await prepararEsterno(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 220, cy - 40, { steps: 12 });
  await page.mouse.up();
  await expect(cena).toHaveAttribute('data-soltas', '1');
  await expect(cena).toHaveAttribute('data-historico', '3');          // pele, músculos, soltar
  // de volta: pega onde ela está agora e devolve ao centro (a casa está no centro da tela)
  await page.mouse.move(cx + 220, cy - 40);
  await page.mouse.down();
  await page.mouse.move(cx, cy, { steps: 12 });
  await page.mouse.up();
  await expect(cena).toHaveAttribute('data-soltas', '0');
});

test('clique sem movimento seleciona, não solta', async ({ page }) => {
  const { cena, cx, cy } = await prepararEsterno(page);
  await page.getByRole('button', { name: 'Recentrar' }).click();
  await page.keyboard.press('Escape');
  await expect(cena).toHaveAttribute('data-selecionada', '');
  await page.mouse.click(cx, cy + 60);                                   // tronco sem pele/músculos: costela, esterno ou órgão
  await expect(cena).not.toHaveAttribute('data-selecionada', '');
  await expect(cena).toHaveAttribute('data-soltas', '0');
});

test('com prefers-reduced-motion a explosão aplica a posição sem animar', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { cena } = await prepararEsterno(page);
  await page.getByLabel('Explosão').fill('1');
  await expect(cena).toHaveAttribute('data-explosao', '1');
  // sem animação a posição final vale já no commit seguinte. O esterno é mediano (vetorExplosao ≈ +z)
  // e o vetor vem ponderado pelo peso do esqueleto (0,6): 0,6 × 0,4 m = 0,24 m.
  const lerZ = () => page.evaluate(() => {
    const g = (window as unknown as { __cena?: { getObjectByName(n: string): { position: { z: number } } | undefined } }).__cena;
    return g?.getObjectByName('FMA7485')?.position.z ?? null;
  });
  await expect.poll(lerZ, { timeout: 5_000 }).not.toBeNull();
  await expect.poll(lerZ, { timeout: 5_000 }).toBeCloseTo(0.24, 2);
});
```

Para o `evaluate` enxergar a cena, expor a `scene` fora de produção: em `Cena.tsx`, dentro do `Canvas`, adicionar o componente:
```tsx
function ExporCena() { const scene = useThree((s) => s.scene); useEffect(() => { (window as unknown as { __cena?: unknown }).__cena = scene; }, [scene]); return null; }
```
e renderizá-lo (`<ExporCena />`) só quando `process.env.NODE_ENV !== 'production'`.

- [ ] **Step 2: Rodar**

Run: `cd apps/web && pnpm exec playwright test e2e/arrasto.spec.ts --project=desktop`
Expected: `3 passed`. Se o primeiro teste falhar no `data-soltas` porque o `mouse.down` caiu em outra peça (costela) e ela foi solta em vez do esterno, o teste continua correto (uma peça foi solta) — mas se `data-soltas` ficar `0`, o `pointerdown` não capturou: verificar no navegador se o cursor vira "grab" sobre o esterno depois de focar, e se `LIMIAR_ARRASTO_PX` está sendo cruzado (12 passos de ~18 px).

- [ ] **Step 3: Suíte completa nos 3 viewports**

Run: `cd apps/web && pnpm test:e2e`
Expected: `33 passed, 3 skipped` — 12 testes × 3 projetos, com `arrasto.spec.ts` marcado no topo com `test.skip(({ viewport }) => viewport!.width < 500, 'canvas estreito demais para o arrasto de 220 px');`. Em 320 e 768 px o layout empilha (canvas em cima, painéis embaixo), então os testes de camadas, painel, busca e teclado rodam em todos os viewports. Se algum teste ficar instável só no celular, marcar o `skip` nele com a razão e reportar.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(web): e2e de arrasto (soltar/encaixar), clique sem movimento e reduced-motion"
```

---

### Task 11 (opcional, com portão): oclusão ambiente (N8AO)

**Files:**
- Modify: `apps/web/package.json`, `apps/web/src/components/viewer/Cena.tsx`

- [ ] **Step 1: Instalar e ligar**

```bash
cd apps/web && pnpm add @react-three/postprocessing@3.1.1 postprocessing@^6.36.0 n8ao@^1.9
```
Em `Cena.tsx`: `import { EffectComposer, N8AO } from '@react-three/postprocessing';` e, dentro do `Canvas`, após `<Camera />`:
```tsx
        <EffectComposer enableNormalPass={false} multisampling={4}>
          <N8AO aoRadius={0.06} intensity={2.5} distanceFalloff={0.5} quality="performance" halfRes />
        </EffectComposer>
```

- [ ] **Step 2: Portão**

Medir no navegador (DevTools → Rendering → Frame rendering stats, ou `performance.now()` em volta de `invalidate()` numa órbita): se a órbita ficar abaixo de 30 fps no MacBook local em 1440×900, ou se surgirem halos escuros nos contornos das peças soltas, **remover** a dependência e o componente (`pnpm remove …`) e registrar no relatório. Se passar: `pnpm test:e2e` inteiro continua verde (as capturas mudam de tom mas a fração de pixels não-fundo continua > 20%).

- [ ] **Step 3: Commit (só se passou no portão)**

```bash
git add -A && git commit -m "feat(web): oclusão ambiente N8AO com portão de desempenho"
```

---

## Portão da fase 1 (spec §11)

- [ ] `pnpm typecheck` e `cd apps/web && pnpm test` (17 unitários) e `pnpm --filter @corpo3d/pipeline test` (29) verdes
- [ ] `cd apps/web && pnpm test:e2e` verde nos 3 viewports (33 passed, 3 skipped)
- [ ] Verificação a olho, gravando um screenshot com: pele a 40%, uma peça solta com fantasma, uma destacada com nota, explosão a 30%
- [ ] Atualizar o spec: remover `sistemasVisiveis` do §4.3; registrar em §12 que descrições seguem placeholder até a fase 4

Ao fechar: escrever o plano das fases 2–3 (login, link opaco, snapshot, celular/fallback) a partir do spec §6 e §7.
