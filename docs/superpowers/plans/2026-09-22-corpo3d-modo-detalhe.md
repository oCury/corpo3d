# Corpo3D — modo detalhe (partes de cada órgão) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicar num órgão abre as partes dele (e cada parte nas partes dela), com as partes sendo peças comuns do visualizador, escolhidas automaticamente por continência de elementos do BodyParts3D e corrigidas por curadoria num CSV; carregadas sob demanda; caminho guardado no estado (e no link futuro).

**Architecture:** (1) Pipeline: `partes.ts` calcula, para cada nó (peça ou parte), as candidatas = conceitos do atlas cujos elementos são subconjunto estrito dos elementos próprios do nó, tira lista negra de nomes e exceções, escolhe gulosamente sem repetir elemento, aplica a curadoria de `conteudo/partes.csv` e cria um "resto"; `propor-partes` escreve o CSV preservando curadoria; `construir-partes.ts` gera `models/partes/<pai>/<parte>.glb` + `models/partes/<pai>.json` a partir do CSV; o manifesto principal ganha `numPartes`. (2) Web: estado ganha `detalhe: FmaId[]` (pilha); store carrega JSONs de partes sob demanda; `pecasVisiveis` (pura) decide o que renderiza; `Peca` esmaece o que está fora do nó mais fundo; painel ganha "Ver partes (N)", um `Caminho` (breadcrumb) e a lista ganha o grupo "Partes de X". (3) Conteúdo: agente rascunha `nomePt`/`nomeLeigo` no CSV com `status=auto`.

**Tech Stack:** o que já existe: pipeline em TypeScript (tsx, gltf-transform, Vitest), web Next 16 + R3F + Zustand + Zod 4 + Playwright.

**Spec:** `docs/superpowers/specs/2026-09-22-corpo3d-modo-detalhe-design.md`. Branch `feat/modo-detalhe` (já criada com o spec).

**Fatos verificados em 22/09 que o código abaixo assume:**
- `lerElementos(texto)` (catalogo.ts) devolve `Map<fmaId, Set<FJ>>` e ignora os nomes; `dividirCsv` é privada em catalogo.ts; `resolverPecas` devolve `Peca` com `elementos: Set<string>` e `arvoreUsada`.
- `escreverGlb(g, saida, { razao, nome, inflarM?, confinarEm?, devolverGeometria? })` devolve `{ bytes, triangulosAntes, triangulosDepois, bbox, centro }`; `bboxDe(pos)`; `parseObj(texto, g)` acumula em `Geometria`.
- `construir.ts` monta `PecaManifesto` e escreve `manifest.json`; `portao.ts` tem `verificarOrcamento(m, idsCsv, orc)` e CLI.
- Web: `EstadoCenaSchema` Zod com `FmaId = /^FMA\d+$/`; store Zustand com `aplicar(parcial, {historico})`; `Cena.tsx` calcula `visiveis` e expõe `data-*`; `Peca.tsx` calcula `opacidade = opacidadeSistema * (isolada && isolada !== fmaId ? 0.1 : 1)`; `PainelPeca` acha a peça em `manifesto.pecas`; `ListaPecas` é um `<ul role="listbox">` achatado; `useAtalhos` trata Escape; `enquadrar(peca)` em geometria.ts.
- Dados (corrigido em 22/09 ao executar a Tarefa A): coração `FMA7088` tem 83 elementos, mas 54 são das coronárias D/E (`FMA50039`/`FMA50040`), que já são peças de nível 1 → 29 elementos próprios → **6 partes automáticas** no nível 1 (ventrículos D/E, veia marginal direita, veia cardíaca pequena, seio coronário, veia cardíaca magna) + resto de 4 elementos (cavidades e paredes dos átrios). No total: 503 linhas, 138 pais (50 de nível 1), 445 nomes distintos, 6,2 MB de partes. Os E2E leem `public/models/partes/FMA7088.json` para saber N.
- Comandos: `pnpm --filter @corpo3d/pipeline test|typecheck|construir|portao`; `pnpm --filter @corpo3d/web test|typecheck`; `cd apps/web && pnpm test:e2e`.

---

## Estrutura de arquivos

```
packages/pipeline/src/constantes.ts          # + CSV_PARTES, DIR_PARTES, NIVEL_MAXIMO, DESLOCAMENTO_MAXIMO_M, ORCAMENTO_BYTES_PARTES_TOTAL, PECAS_SEM_PARTES
packages/pipeline/src/catalogo.ts            # exporta dividirCsv; + lerNomesConceitos
packages/pipeline/src/partes.ts              # NOVO — regra das partes, curadoria, CSV de partes, vetorExplosaoParte
packages/pipeline/src/propor-partes.ts       # NOVO — CLI: gera/atualiza conteudo/partes.csv
packages/pipeline/src/construir-partes.ts    # NOVO — GLBs + JSON por pai a partir do CSV
packages/pipeline/src/construir.ts           # chama construirPartes; numPartes no manifesto
packages/pipeline/src/manifesto.ts           # + numPartes, PartePeca, ManifestoPartes
packages/pipeline/src/portao.ts              # + verificarPartes
packages/pipeline/package.json               # + script propor-partes
packages/pipeline/tests/partes.test.ts       # NOVO
packages/pipeline/tests/construir.test.ts    # + partes na fixture
packages/pipeline/tests/fixtures/partes.csv  # NOVO
conteudo/partes.csv                          # NOVO (gerado + curado)
apps/web/src/lib/manifesto.ts                # + numPartes?, PartePeca, ManifestoPartes, carregarManifestoPartes
apps/web/src/lib/estado/schema.ts            # FmaId aceita -resto; + detalhe
apps/web/src/lib/estado/detalhe.ts           # NOVO — pecasVisiveis, dentroDoDetalhe (puras)
apps/web/src/lib/estado/store.ts             # + partes, carregarPartes, abrirPartes, fecharPartes, pecaDe
apps/web/src/components/viewer/Cena.tsx      # visiveis via pecasVisiveis; carga da pilha; data-detalhe
apps/web/src/components/viewer/Peca.tsx      # esmaecimento fora do detalhe
apps/web/src/components/estudio/PainelPeca.tsx   # botão Ver partes; tarja nome automático; pecaDe
apps/web/src/components/estudio/Caminho.tsx      # NOVO — breadcrumb
apps/web/src/components/estudio/ListaPecas.tsx   # grupo "Partes de X"
apps/web/src/components/estudio/Estudio.tsx      # monta Caminho
apps/web/src/lib/hooks/useAtalhos.ts         # Esc fecha um nível
apps/web/src/app/globals.css                 # .caminho, .tarja
apps/web/e2e/detalhe.spec.ts                 # NOVO
```

---

### Task A: Pipeline — regra das partes, CSV de curadoria, construção e portão

**Files:**
- Modify: `packages/pipeline/src/constantes.ts`, `packages/pipeline/src/catalogo.ts`, `packages/pipeline/src/manifesto.ts`, `packages/pipeline/src/construir.ts`, `packages/pipeline/src/portao.ts`, `packages/pipeline/package.json`
- Create: `packages/pipeline/src/partes.ts`, `packages/pipeline/src/propor-partes.ts`, `packages/pipeline/src/construir-partes.ts`
- Test: `packages/pipeline/tests/partes.test.ts` (novo), `packages/pipeline/tests/construir.test.ts`, `packages/pipeline/tests/fixtures/partes.csv` (novo)

- [ ] **Step A1: Constantes e catálogo**

Em `packages/pipeline/src/constantes.ts`, acrescentar ao fim:

```ts
/** Fonte da verdade das partes (curadoria); gerado/atualizado por `propor-partes`. */
export const CSV_PARTES = resolve(RAIZ, 'conteudo', 'partes.csv');
/** Subpasta de DIR_SAIDA: models/partes/<pai>/<parte>.glb e models/partes/<pai>.json */
export const DIR_PARTES = 'partes';
/** Nível 1 = peça do CSV de estruturas; até quatro aberturas (níveis 2–5). */
export const NIVEL_MAXIMO = 5;
/** Espelha DESLOCAMENTO_MAXIMO do web (geometria.ts): alcance da explosão com o slider em 1. */
export const DESLOCAMENTO_MAXIMO_M = 0.4;
export const ORCAMENTO_BYTES_PARTES_TOTAL = 12 * 1024 * 1024;
/**
 * Peças que nunca têm partes, com o motivo. FMA12514 (globo ocular direito): cada arquivo
 * "direito" do atlas já traz OS DOIS olhos dentro de si (córnea direita = 81 mm de largura) sem
 * repetir elemento do esquerdo, então nenhuma regra por elementos o pega; o olho é desenhado
 * paramétrico de qualquer jeito (Peca.tsx).
 */
export const PECAS_SEM_PARTES = new Set(['FMA12514']);
```

Em `packages/pipeline/src/catalogo.ts`: trocar `function dividirCsv(` por `export function dividirCsv(` e acrescentar logo após `lerElementos`:

```ts
/** `concept id \t name \t element file id`, com cabeçalho → nome em inglês por conceito. */
export function lerNomesConceitos(texto: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const linha of texto.split('\n').slice(1)) {
    const c = linha.split('\t');
    if (c.length < 3) continue;
    const [fma, nome] = c.map((s) => s.trim());
    if (!m.has(fma)) m.set(fma, nome);
  }
  return m;
}
```

Em `packages/pipeline/src/manifesto.ts`: em `PecaManifesto` acrescentar `numPartes: number;` (depois de `elementos: number;`) e ao fim do arquivo:

```ts
/** Uma parte é uma peça comum, mais o pai, o nível (2–5), o estado da curadoria e quantas partes ela mesma tem. */
export interface PartePeca extends PecaManifesto { paiFmaId: string; nivel: number; status: 'auto' | 'revisado' }
export interface ManifestoPartes { versao: 1; paiFmaId: string; partes: PartePeca[] }
```

- [ ] **Step A2: Testes da regra das partes (RED)**

Criar `packages/pipeline/tests/partes.test.ts`:

```ts
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
```

Run: `pnpm --filter @corpo3d/pipeline test -- partes`
Expected: FAIL — `Cannot find module '../src/partes'`.

- [ ] **Step A3: `partes.ts` (GREEN)**

Criar `packages/pipeline/src/partes.ts`:

```ts
import { dividirCsv, type Lado } from './catalogo';
import { DESLOCAMENTO_MAXIMO_M, NIVEL_MAXIMO, PECAS_SEM_PARTES } from './constantes';
import type { Bbox } from './glb';

export type StatusParte = 'auto' | 'revisado' | 'excluida';
export interface LinhaParte { paiFmaId: string; fmaId: string; nomeEn: string; nomePt: string; nomeLeigo: string; status: StatusParte }
export interface Conceito { fmaId: string; nome: string; elementos: Set<string> }
/** Um nó da recursão: peça (nível 1) ou parte. `raiz` é a peça de nível 1 de onde ele descende. */
export interface No { fmaId: string; nome: string; nomePt: string; elementos: Set<string>; nivel: number; raiz: string }
export interface Atlas { conceitos: Map<string, Conceito>; porElemento: Map<string, Set<string>> }

/** Nomes do atlas que não são estruturas visíveis (cavidades, paredes, zonas, agrupamentos). Palavra inteira, sem maiúsculas. */
export const NAO_VISUAL = /\b(cavity|lumen|space|surface|region|zone|wall|part of|set of|side of|septum|apex|base of|border|margin|line|point|content|layer|myocardium|endocardium|epicardium|parenchyma|tree|proper|hemi|segment|division|trunk of)\b/i;
export const SUFIXO_RESTO = '-resto';
export const ehResto = (id: string): boolean => id.endsWith(SUFIXO_RESTO);
export const ID_VALIDO = /^FMA\d+(-resto)?$/;
export const CABECALHO_PARTES = ['paiFmaId', 'fmaId', 'nomeEn', 'nomePt', 'nomeLeigo', 'status'] as const;

/** Une as duas árvores por FMA (mesmo conceito, mesmos elementos) e guarda o nome em inglês. */
export function unirConceitos(mapas: { partof: Map<string, Set<string>>; isa: Map<string, Set<string>> }, nomes: Map<string, string>): Map<string, Conceito> {
  const out = new Map<string, Conceito>();
  for (const arv of ['partof', 'isa'] as const) {
    for (const [id, el] of mapas[arv]) {
      const c = out.get(id);
      if (c) for (const e of el) c.elementos.add(e);
      else out.set(id, { fmaId: id, nome: nomes.get(id) ?? id, elementos: new Set(el) });
    }
  }
  return out;
}

export function indexarAtlas(conceitos: Map<string, Conceito>): Atlas {
  const porElemento = new Map<string, Set<string>>();
  for (const c of conceitos.values()) for (const e of c.elementos) {
    if (!porElemento.has(e)) porElemento.set(e, new Set());
    porElemento.get(e)!.add(c.fmaId);
  }
  return { conceitos, porElemento };
}

/** Elementos próprios de cada peça de nível 1: elemento que está em 2+ peças não pertence a nenhuma para fins de partes. */
export function elementosProprios(pecas: { fmaId: string; elementos: Set<string> }[]): Map<string, Set<string>> {
  const donos = new Map<string, number>();
  for (const p of pecas) for (const e of p.elementos) donos.set(e, (donos.get(e) ?? 0) + 1);
  return new Map(pecas.map((p) => [p.fmaId, new Set([...p.elementos].filter((e) => donos.get(e) === 1))]));
}

const ehSubconjuntoEstrito = (a: Set<string>, b: Set<string>): boolean => a.size > 0 && a.size < b.size && [...a].every((e) => b.has(e));
const ordemPartes = (a: Conceito, b: Conceito): number => b.elementos.size - a.elementos.size || (a.fmaId < b.fmaId ? -1 : a.fmaId > b.fmaId ? 1 : 0);

/** Conceitos cujos elementos são subconjunto ESTRITO dos próprios do nó, fora da lista negra e de `excluir`. */
export function candidatas(proprios: Set<string>, atlas: Atlas, excluir: Set<string>): Conceito[] {
  const ids = new Set<string>();
  for (const e of proprios) for (const c of atlas.porElemento.get(e) ?? []) ids.add(c);
  const out: Conceito[] = [];
  for (const id of ids) {
    if (excluir.has(id)) continue;
    const c = atlas.conceitos.get(id)!;
    if (!ehSubconjuntoEstrito(c.elementos, proprios)) continue;
    if (NAO_VISUAL.test(c.nome)) continue;
    out.push(c);
  }
  return out.sort(ordemPartes);
}

export interface Escolha { partes: Conceito[]; resto: Set<string> }

/**
 * Guloso (maiores primeiro, sem repetir elemento), depois a curadoria: `revisado` entra mesmo
 * sobrepondo, `excluida` sai. Falha alto se um `revisado` não existir ou não for subconjunto do pai.
 */
export function escolherPartes(no: No, proprios: Set<string>, cands: Conceito[], curadoria: LinhaParte[], atlas: Atlas): Escolha {
  const linhas = curadoria.filter((l) => l.paiFmaId === no.fmaId);
  const excluidas = new Set(linhas.filter((l) => l.status === 'excluida').map((l) => l.fmaId));
  const revisadas = linhas.filter((l) => l.status === 'revisado' && !ehResto(l.fmaId)).map((l) => l.fmaId);
  const cobertos = new Set<string>();
  const partes: Conceito[] = [];
  const cobrir = (c: Conceito) => { partes.push(c); for (const e of c.elementos) cobertos.add(e); };
  for (const c of cands) {
    if (excluidas.has(c.fmaId) || revisadas.includes(c.fmaId)) continue;
    if ([...c.elementos].some((e) => cobertos.has(e))) continue;
    cobrir(c);
  }
  for (const id of revisadas) {
    const c = atlas.conceitos.get(id);
    if (!c) throw new Error(`partes.csv: ${no.fmaId} → ${id} (revisado) não existe no atlas`);
    if (!ehSubconjuntoEstrito(c.elementos, proprios)) throw new Error(`partes.csv: ${no.fmaId} → ${id} (revisado, ${c.nome}) não é subconjunto estrito dos elementos próprios do pai`);
    cobrir(c);
  }
  partes.sort(ordemPartes);
  return { partes, resto: new Set([...proprios].filter((e) => !cobertos.has(e))) };
}

export const nomeResto = (nomePai: string): string => `Outras partes de ${nomePai}`;

/**
 * Percorre as raízes (peças) em largura, escolhe partes por nó e emite as linhas do CSV: `auto`
 * recalculadas (nomes pt já rascunhados são mantidos), `revisado`/`excluida` existentes preservadas,
 * `auto` órfãs removidas. Um conceito reaproveitado sob dois pais é expandido uma vez só (nível mais raso).
 */
export function proporArvore(raizes: No[], atlas: Atlas, propriosPorRaiz: Map<string, Set<string>>, curadoria: LinhaParte[]): LinhaParte[] {
  const saida: LinhaParte[] = [];
  const anterior = new Map(curadoria.map((l) => [`${l.paiFmaId}|${l.fmaId}`, l]));
  const fila = [...raizes];
  const vistos = new Set<string>();
  while (fila.length) {
    const no = fila.shift()!;
    if (vistos.has(no.fmaId) || no.nivel >= NIVEL_MAXIMO || ehResto(no.fmaId) || PECAS_SEM_PARTES.has(no.fmaId)) continue;
    vistos.add(no.fmaId);
    const propriosRaiz = propriosPorRaiz.get(no.raiz) ?? new Set<string>();
    const proprios = new Set([...no.elementos].filter((e) => propriosRaiz.has(e)));
    const { partes, resto } = escolherPartes(no, proprios, candidatas(proprios, atlas, new Set([no.fmaId])), curadoria, atlas);
    if (partes.length + (resto.size ? 1 : 0) < 2) continue;
    for (const c of partes) {
      const velha = anterior.get(`${no.fmaId}|${c.fmaId}`);
      const linha: LinhaParte = velha?.status === 'revisado' ? velha
        : { paiFmaId: no.fmaId, fmaId: c.fmaId, nomeEn: c.nome, nomePt: velha?.nomePt ?? '', nomeLeigo: velha?.nomeLeigo ?? '', status: 'auto' };
      saida.push(linha);
      fila.push({ fmaId: c.fmaId, nome: c.nome, nomePt: linha.nomePt, elementos: c.elementos, nivel: no.nivel + 1, raiz: no.raiz });
    }
    if (resto.size) {
      const id = no.fmaId + SUFIXO_RESTO;
      const velha = anterior.get(`${no.fmaId}|${id}`);
      saida.push(velha?.status === 'revisado' ? velha
        : { paiFmaId: no.fmaId, fmaId: id, nomeEn: `rest of ${no.nome}`, nomePt: nomeResto(no.nomePt || no.nome), nomeLeigo: velha?.nomeLeigo ?? '', status: 'auto' });
    }
    for (const l of curadoria) if (l.paiFmaId === no.fmaId && l.status === 'excluida') saida.push(l);
  }
  return saida;
}

const STATUS: StatusParte[] = ['auto', 'revisado', 'excluida'];

export function lerCsvPartes(texto: string): LinhaParte[] {
  const linhas = texto.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim());
  if (!linhas.length) return [];
  const cab = dividirCsv(linhas[0]);
  if (cab.join(',') !== CABECALHO_PARTES.join(',')) throw new Error(`partes.csv: cabeçalho esperado "${CABECALHO_PARTES.join(',')}", veio "${cab.join(',')}"`);
  const vistos = new Set<string>();
  return linhas.slice(1).map((l, i) => {
    const v = Object.fromEntries(cab.map((k, j) => [k, (dividirCsv(l)[j] ?? '').trim()]));
    const n = i + 2;
    if (!ID_VALIDO.test(v.paiFmaId) || ehResto(v.paiFmaId)) throw new Error(`partes.csv linha ${n}: paiFmaId inválido "${v.paiFmaId}"`);
    if (!ID_VALIDO.test(v.fmaId)) throw new Error(`partes.csv linha ${n}: fmaId inválido "${v.fmaId}"`);
    if (!STATUS.includes(v.status as StatusParte)) throw new Error(`partes.csv linha ${n}: status inválido "${v.status}" (auto | revisado | excluida)`);
    const chave = `${v.paiFmaId}|${v.fmaId}`;
    if (vistos.has(chave)) throw new Error(`partes.csv linha ${n}: par duplicado ${v.paiFmaId} → ${v.fmaId}`);
    vistos.add(chave);
    return { paiFmaId: v.paiFmaId, fmaId: v.fmaId, nomeEn: v.nomeEn, nomePt: v.nomePt, nomeLeigo: v.nomeLeigo, status: v.status as StatusParte };
  });
}

const campoCsv = (s: string): string => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Mantém a ordem recebida (por pai, maiores primeiro): o diff fica legível. */
export function escreverCsvPartes(linhas: LinhaParte[]): string {
  return [CABECALHO_PARTES.join(','), ...linhas.map((l) => CABECALHO_PARTES.map((k) => campoCsv(l[k])).join(','))].join('\n') + '\n';
}

/** Direção do centro do pai ao da parte, com alcance = diagonal do pai (com o slider em 1). No centro, sai para +z. */
export function vetorExplosaoParte(centroPai: [number, number, number], bboxPai: Bbox, centroParte: [number, number, number]): [number, number, number] {
  const diag = Math.hypot(bboxPai.max[0] - bboxPai.min[0], bboxPai.max[1] - bboxPai.min[1], bboxPai.max[2] - bboxPai.min[2]);
  const mag = diag / DESLOCAMENTO_MAXIMO_M;
  const d = [centroParte[0] - centroPai[0], centroParte[1] - centroPai[1], centroParte[2] - centroPai[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  if (len < 1e-6) return [0, 0, mag];
  return [(d[0] / len) * mag, (d[1] / len) * mag, (d[2] / len) * mag];
}

export function ladoPeloNome(nomeEn: string, ladoPai: Lado): Lado {
  if (/^right\b/i.test(nomeEn)) return 'D';
  if (/^left\b/i.test(nomeEn)) return 'E';
  return ladoPai;
}
```

Nota sobre `dividirCsv` importada de `catalogo.ts` (Step A1) — o ciclo `partes.ts → catalogo.ts` não volta, então não há import circular.

Run: `pnpm --filter @corpo3d/pipeline test -- partes` → PASS. Se `candidatas` devolver `FMA14` no teste, confira a lista negra (`proper`) e o subconjunto estrito (`a.size < b.size`).

- [ ] **Step A4: `propor-partes.ts` (CLI) e script**

Criar `packages/pipeline/src/propor-partes.ts`:

```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSV_ESTRUTURAS, CSV_PARTES, DIR_CACHE } from './constantes';
import { lerCsvEstruturas, lerElementos, lerNomesConceitos, resolverPecas } from './catalogo';
import { elementosProprios, escreverCsvPartes, indexarAtlas, lerCsvPartes, proporArvore, unirConceitos, type LinhaParte, type No } from './partes';

export interface OpcoesPropor { csvEstruturas: string; csvPartes: string; elementParts: { partof: string; isa: string } }

/** Regra do spec §3 para as 241 peças e descendentes; preserva a curadoria do CSV existente. */
export function proporPartes(op: OpcoesPropor): { linhas: LinhaParte[]; texto: string } {
  const partofTxt = readFileSync(op.elementParts.partof, 'utf8');
  const isaTxt = readFileSync(op.elementParts.isa, 'utf8');
  const mapas = { partof: lerElementos(partofTxt), isa: lerElementos(isaTxt) };
  const nomes = new Map([...lerNomesConceitos(partofTxt), ...lerNomesConceitos(isaTxt)]);
  const pecas = resolverPecas(lerCsvEstruturas(readFileSync(op.csvEstruturas, 'utf8')), mapas);
  const atlas = indexarAtlas(unirConceitos(mapas, nomes));
  const raizes: No[] = pecas.map((p) => ({ fmaId: p.fmaId, nome: p.nomeLatim, nomePt: p.nomePt, elementos: p.elementos, nivel: 1, raiz: p.fmaId }));
  const curadoria = existsSync(op.csvPartes) ? lerCsvPartes(readFileSync(op.csvPartes, 'utf8')) : [];
  const linhas = proporArvore(raizes, atlas, elementosProprios(pecas), curadoria);
  return { linhas, texto: escreverCsvPartes(linhas) };
}

if (process.argv[1] && process.argv[1].endsWith('propor-partes.ts')) {
  const { linhas, texto } = proporPartes({
    csvEstruturas: CSV_ESTRUTURAS, csvPartes: CSV_PARTES,
    elementParts: { partof: join(DIR_CACHE, 'partof_element_parts.txt'), isa: join(DIR_CACHE, 'isa_element_parts.txt') },
  });
  writeFileSync(CSV_PARTES, texto);
  const pais = new Set(linhas.map((l) => l.paiFmaId));
  const por = (s: string) => linhas.filter((l) => l.status === s).length;
  console.log(`${CSV_PARTES}: ${linhas.length} linhas, ${pais.size} pais, auto ${por('auto')} · revisado ${por('revisado')} · excluida ${por('excluida')}`);
}
```

Em `packages/pipeline/package.json`, em `scripts`, acrescentar `"propor-partes": "tsx src/propor-partes.ts",` depois de `"construir"`.

- [ ] **Step A5: Teste de `construir` com partes (RED)**

Criar `packages/pipeline/tests/fixtures/partes.csv` (o coração da fixture `FMA1` tem elementos FJ10 e FJ11; o "ventrículo" `FMA7` = {FJ10} vem da fixture `isa_element_parts.txt` — confira com `grep FMA7 packages/pipeline/tests/fixtures/isa_element_parts.txt`; se não existir, acrescente a linha `FMA7\tventriculo\tFJ10` ao fim dessa fixture):

```csv
paiFmaId,fmaId,nomeEn,nomePt,nomeLeigo,status
FMA1,FMA7,ventriculo,Ventrículo,câmara,auto
FMA1,FMA1-resto,rest of coracao,Outras partes de Coração,,auto
```

Em `packages/pipeline/tests/construir.test.ts`, acrescentar no `describe('construir')`:

```ts
  it('gera partes do CSV: GLB por parte, JSON por pai, numPartes no manifesto e vetor radial', async () => {
    const saida = mkdtempSync(join(tmpdir(), 'models-'));
    const manifesto = await construir({
      csv: join(FX, 'estruturas.csv'), csvPartes: join(FX, 'partes.csv'),
      elementParts: { partof: join(FX, 'partof_element_parts.txt'), isa: join(FX, 'isa_element_parts.txt') },
      dirObj: join(FX, 'obj'), dirSaida: saida,
    });
    expect(manifesto.pecas.find((p) => p.fmaId === 'FMA1')!.numPartes).toBe(2);
    expect(manifesto.pecas.find((p) => p.fmaId === 'FMA4')!.numPartes).toBe(0);
    const json = JSON.parse(readFileSync(join(saida, 'partes', 'FMA1.json'), 'utf8'));
    expect(json.versao).toBe(1); expect(json.paiFmaId).toBe('FMA1');
    expect(json.partes.map((p: { fmaId: string }) => p.fmaId)).toEqual(['FMA7', 'FMA1-resto']);
    const v = json.partes[0];
    expect(v.glb).toBe('partes/FMA1/FMA7.glb'); expect(existsSync(join(saida, v.glb))).toBe(true);
    expect(v.sistema).toBe('cardiovascular'); expect(v.paiFmaId).toBe('FMA1'); expect(v.nivel).toBe(2); expect(v.status).toBe('auto'); expect(v.numPartes).toBe(0);
    expect(v.nomePt).toBe('Ventrículo'); expect(v.nomeLatim).toBe('ventriculo');
    expect(Math.hypot(...(v.vetorExplosao as [number, number, number]))).toBeGreaterThan(0);
    expect(existsSync(join(saida, 'partes', 'FMA1', 'FMA1-resto.glb'))).toBe(true);
    expect(json.partes[1].elementos).toBe(1);                                  // FJ11
  });
```

Run: `pnpm --filter @corpo3d/pipeline test -- construir` → FAIL (`csvPartes` não existe nas opções / `numPartes` undefined).

- [ ] **Step A6: `construir-partes.ts` e integração em `construir.ts` (GREEN)**

Criar `packages/pipeline/src/construir-partes.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Peca } from './catalogo';
import { DIR_PARTES, RAZAO_PADRAO } from './constantes';
import { escreverGlb, type Bbox } from './glb';
import type { ManifestoPartes, PartePeca, PecaManifesto } from './manifesto';
import { novaGeometria, parseObj } from './obj';
import { ehResto, elementosProprios, ladoPeloNome, lerCsvPartes, vetorExplosaoParte, type Conceito, type LinhaParte } from './partes';

export interface OpcoesConstruirPartes {
  csvPartes: string; dirObj: string; dirSaida: string;
  pecas: Peca[]; manifestoPecas: PecaManifesto[]; conceitos: Map<string, Conceito>;
  log?: (m: string) => void;
}

/** Quantas partes (não excluídas) cada id tem no CSV. */
export function contarPartes(linhas: LinhaParte[]): Map<string, number> {
  const n = new Map<string, number>();
  for (const l of linhas) if (l.status !== 'excluida') n.set(l.paiFmaId, (n.get(l.paiFmaId) ?? 0) + 1);
  return n;
}

/**
 * Lê `partes.csv` e gera, por pai, os GLBs das partes e o `partes/<pai>.json`. Pais são
 * processados dos níveis rasos aos fundos (uma parte precisa da bbox/centro do pai já calculados).
 * Falha alto se uma linha apontar para conceito inexistente ou fora dos elementos próprios do pai:
 * ou a curadoria está errada, ou o CSV está velho (rode `propor-partes`).
 */
export async function construirPartes(op: OpcoesConstruirPartes): Promise<{ porPai: Map<string, ManifestoPartes>; bytesTotal: number }> {
  const log = op.log ?? (() => {});
  const linhas = lerCsvPartes(readFileSync(op.csvPartes, 'utf8')).filter((l) => l.status !== 'excluida');
  const contagem = contarPartes(linhas);
  const pecaPorId = new Map(op.pecas.map((p) => [p.fmaId, p]));
  const manifestoPorId = new Map(op.manifestoPecas.map((p) => [p.fmaId, p]));
  const paiDe = new Map<string, string>();
  for (const l of linhas) if (!paiDe.has(l.fmaId)) paiDe.set(l.fmaId, l.paiFmaId);
  const raizDe = (id: string): string => { let x = id; while (paiDe.has(x)) x = paiDe.get(x)!; return x; };
  const nivelDe = (id: string): number => { let n = 1, x = id; while (paiDe.has(x)) { x = paiDe.get(x)!; n++; } return n; };
  const proprios = elementosProprios(op.pecas);
  const elementosDe = (id: string): Set<string> => {
    const p = pecaPorId.get(id); if (p) return p.elementos;
    const c = op.conceitos.get(id); if (c) return c.elementos;
    throw new Error(`partes.csv: ${id} não é peça nem conceito do atlas`);
  };
  /** bbox/centro/sistema/lado de cada nó já construído (peças vêm do manifesto principal). */
  const geo = new Map<string, { bbox: Bbox; centro: [number, number, number]; sistema: PecaManifesto['sistema']; lado: PecaManifesto['lado'] }>();
  for (const p of op.manifestoPecas) geo.set(p.fmaId, { bbox: p.bbox, centro: p.centro, sistema: p.sistema, lado: p.lado });
  const textos = new Map<string, string>();
  const lerElemento = (fj: string): string => {
    let t = textos.get(fj);
    if (t === undefined) { t = readFileSync(join(op.dirObj, `${fj}.obj`), 'utf8'); textos.set(fj, t); }
    return t;
  };
  const pais = [...new Set(linhas.map((l) => l.paiFmaId))].sort((a, b) => nivelDe(a) - nivelDe(b) || (a < b ? -1 : 1));
  const porPai = new Map<string, ManifestoPartes>();
  let bytesTotal = 0;
  for (const pai of pais) {
    const raiz = raizDe(pai);
    const g0 = geo.get(pai);
    if (!g0) throw new Error(`partes.csv: pai ${pai} não foi construído antes das suas partes (ordem por nível quebrada?)`);
    const propriosPai = new Set([...elementosDe(pai)].filter((e) => proprios.get(raiz)?.has(e)));
    const doPai = linhas.filter((l) => l.paiFmaId === pai);
    const cobertos = new Set<string>();
    const elementosDaParte = new Map<string, Set<string>>();
    for (const l of doPai.filter((l) => !ehResto(l.fmaId))) {
      const c = op.conceitos.get(l.fmaId);
      if (!c) throw new Error(`partes.csv: ${pai} → ${l.fmaId} não existe no atlas`);
      const fora = [...c.elementos].filter((e) => !propriosPai.has(e));
      if (fora.length || c.elementos.size >= propriosPai.size) throw new Error(`partes.csv: ${pai} → ${l.fmaId} (${l.nomeEn}) não é subconjunto estrito dos elementos próprios do pai (fora: ${fora.slice(0, 5).join(', ')}); curadoria errada ou CSV velho — rode propor-partes`);
      elementosDaParte.set(l.fmaId, c.elementos);
      for (const e of c.elementos) cobertos.add(e);
    }
    for (const l of doPai.filter((l) => ehResto(l.fmaId))) {
      const resto = new Set([...propriosPai].filter((e) => !cobertos.has(e)));
      if (!resto.size) { log(`aviso: ${pai} tem linha de resto mas nada sobra (CSV velho?)`); continue; }
      elementosDaParte.set(l.fmaId, resto);
    }
    mkdirSync(join(op.dirSaida, DIR_PARTES, pai), { recursive: true });
    const partes: PartePeca[] = [];
    for (const l of doPai) {
      const el = elementosDaParte.get(l.fmaId);
      if (!el) continue;
      const g = novaGeometria();
      for (const fj of el) parseObj(lerElemento(fj), g);
      const glb = `${DIR_PARTES}/${pai}/${l.fmaId}.glb`;
      const st = await escreverGlb(g, join(op.dirSaida, glb), { razao: RAZAO_PADRAO[g0.sistema], nome: l.fmaId });
      const lado = ladoPeloNome(l.nomeEn, g0.lado);
      geo.set(l.fmaId, { bbox: st.bbox, centro: st.centro, sistema: g0.sistema, lado });
      partes.push({
        fmaId: l.fmaId, nomeLatim: l.nomeEn, nomePt: l.nomePt || l.nomeEn, nomeLeigo: l.nomeLeigo || l.nomePt || l.nomeEn,
        sistema: g0.sistema, lado, glb, bytes: st.bytes, triangulos: st.triangulosDepois, elementos: el.size,
        numPartes: contagem.get(l.fmaId) ?? 0, bbox: st.bbox, centro: st.centro,
        vetorExplosao: vetorExplosaoParte(g0.centro, g0.bbox, st.centro),
        paiFmaId: pai, nivel: nivelDe(l.fmaId), status: l.status === 'revisado' ? 'revisado' : 'auto',
      });
      bytesTotal += st.bytes;
    }
    const m: ManifestoPartes = { versao: 1, paiFmaId: pai, partes };
    writeFileSync(join(op.dirSaida, DIR_PARTES, `${pai}.json`), JSON.stringify(m, null, 1));
    porPai.set(pai, m);
    log(`partes de ${pai}: ${partes.length} (${(partes.reduce((a, p) => a + p.bytes, 0) / 1024).toFixed(0)} KB)`);
  }
  return { porPai, bytesTotal };
}
```

Em `packages/pipeline/src/construir.ts`:
1. Imports: acrescentar `existsSync` ao import de `node:fs`; `CSV_PARTES` ao import de `./constantes`; `lerNomesConceitos` ao import de `./catalogo`; e `import { construirPartes, contarPartes } from './construir-partes';` e `import { indexarAtlas, lerCsvPartes, unirConceitos } from './partes';`.
2. Em `OpcoesConstruir`, acrescentar `csvPartes?: string;`.
3. Logo depois de `const pecas = resolverPecas(...)`, trocar a leitura dos dois arquivos para variáveis reutilizáveis e montar os conceitos:

```ts
  const partofTxt = readFileSync(op.elementParts.partof, 'utf8');
  const isaTxt = readFileSync(op.elementParts.isa, 'utf8');
  const mapas = { partof: lerElementos(partofTxt), isa: lerElementos(isaTxt) };
  const pecas = resolverPecas(lerCsvEstruturas(readFileSync(op.csv, 'utf8')), mapas);
  const conceitos = unirConceitos(mapas, new Map([...lerNomesConceitos(partofTxt), ...lerNomesConceitos(isaTxt)]));
  const temCsvPartes = !!op.csvPartes && existsSync(op.csvPartes);
  const contagemPartes = temCsvPartes ? contarPartes(lerCsvPartes(readFileSync(op.csvPartes!, 'utf8'))) : new Map<string, number>();
```
(`indexarAtlas` não é usado aqui; remova do import se o tsc reclamar.)
4. No `saida.push({...})` de cada peça, acrescentar `numPartes: contagemPartes.get(p.fmaId) ?? 0,` depois de `elementos: p.elementos.size,`.
5. Depois do laço das peças e antes de montar `manifesto`:

```ts
  if (temCsvPartes) {
    const r = await construirPartes({ csvPartes: op.csvPartes!, dirObj: op.dirObj, dirSaida: op.dirSaida, pecas, manifestoPecas: saida, conceitos, log });
    log(`${r.porPai.size} pais com partes, ${(r.bytesTotal / 1048576).toFixed(1)} MB de partes`);
  } else log('sem partes.csv: nenhuma parte gerada');
```
6. No bloco CLI, acrescentar `csvPartes: CSV_PARTES,` às opções.

Run: `pnpm --filter @corpo3d/pipeline test` → PASS (todos, incluindo o teste novo de `construir`). `pnpm --filter @corpo3d/pipeline typecheck` → limpo.

- [ ] **Step A7: Portão das partes**

Em `packages/pipeline/tests/portao.test.ts`: no helper `base()`, acrescentar `numPartes: 0,` ao objeto de cada peça (depois de `elementos: 1,`) — o tipo `PecaManifesto` do pipeline passou a exigir o campo. Depois acrescentar:

```ts
import { verificarPartes } from '../src/portao';
import type { ManifestoPartes } from '../src/manifesto';

describe('verificarPartes', () => {
  const parte = (fmaId: string, paiFmaId: string, bytes: number): ManifestoPartes['partes'][number] => ({
    ...base([{ fmaId, bytes }]).pecas[0], glb: `partes/${paiFmaId}/${fmaId}.glb`, numPartes: 0, paiFmaId, nivel: 2, status: 'auto',
  });
  it('acusa pai desconhecido, parte acima do orçamento e total estourado', () => {
    const jsons: ManifestoPartes[] = [
      { versao: 1, paiFmaId: 'FMA1', partes: [parte('FMA10', 'FMA1', 3000)] },
      { versao: 1, paiFmaId: 'FMA9', partes: [parte('FMA90', 'FMA9', 100)] },
    ];
    const r = verificarPartes(jsons, new Set(['FMA1']), { porPeca: 2000, total: 2500 });
    expect(r.ok).toBe(false);
    expect(r.problemas.join('\n')).toMatch(/FMA9.*pai desconhecido/);
    expect(r.problemas.join('\n')).toMatch(/FMA10.*3000/);
    expect(r.problemas.join('\n')).toMatch(/total de partes/);
  });
  it('uma parte com partes conta como pai conhecido', () => {
    const jsons: ManifestoPartes[] = [
      { versao: 1, paiFmaId: 'FMA1', partes: [parte('FMA10', 'FMA1', 100)] },
      { versao: 1, paiFmaId: 'FMA10', partes: [parte('FMA100', 'FMA10', 100)] },
    ];
    expect(verificarPartes(jsons, new Set(['FMA1']), { porPeca: 2000, total: 2500 }).ok).toBe(true);
  });
});
```

Em `packages/pipeline/src/portao.ts`, acrescentar (importando `readdirSync` de `node:fs`, `DIR_PARTES` e `ORCAMENTO_BYTES_PARTES_TOTAL` de `./constantes`, e `type ManifestoPartes` de `./manifesto`):

```ts
/** Todo pai de partes é uma peça do manifesto ou uma parte de algum JSON; orçamentos por parte e total de partes. */
export function verificarPartes(jsons: ManifestoPartes[], pecas: Set<string>, orc: { porPeca: number; total: number }): { ok: boolean; problemas: string[] } {
  const problemas: string[] = [];
  const conhecidos = new Set(pecas);
  for (const j of jsons) for (const p of j.partes) conhecidos.add(p.fmaId);
  let total = 0;
  for (const j of jsons) {
    if (!conhecidos.has(j.paiFmaId)) problemas.push(`${j.paiFmaId}: pai desconhecido (não é peça nem parte)`);
    for (const p of j.partes) {
      total += p.bytes;
      if (p.bytes > orc.porPeca) problemas.push(`${p.fmaId} ${p.nomePt} (parte de ${j.paiFmaId}): ${p.bytes} bytes > orçamento ${orc.porPeca}`);
    }
  }
  if (total > orc.total) problemas.push(`total de partes ${total} bytes > orçamento ${orc.total}`);
  return { ok: problemas.length === 0, problemas };
}
```

e no bloco CLI, antes de `const problemas = [...]`:

```ts
  const dirPartes = join(DIR_SAIDA, DIR_PARTES);
  const jsons: ManifestoPartes[] = existsSync(dirPartes)
    ? readdirSync(dirPartes).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dirPartes, f), 'utf8')) as ManifestoPartes)
    : [];
  const rp = verificarPartes(jsons, new Set(m.pecas.map((p) => p.fmaId)), { porPeca: ORCAMENTO_BYTES_POR_PECA, total: ORCAMENTO_BYTES_PARTES_TOTAL });
  const partesSemGlb = jsons.flatMap((j) => j.partes.filter((p) => !existsSync(join(DIR_SAIDA, p.glb))).map((p) => `${p.fmaId}: ${p.glb} não existe no disco`));
```
e trocar `const problemas = [...r.problemas, ...faltandoNoDisco];` por `const problemas = [...r.problemas, ...faltandoNoDisco, ...rp.problemas, ...partesSemGlb];` e o `console.log` final para incluir `${jsons.length} pais com partes`.

Run: `pnpm --filter @corpo3d/pipeline test` → PASS. `typecheck` → limpo.

- [ ] **Step A8: Rodar de verdade e commitar**

```bash
pnpm --filter @corpo3d/pipeline propor-partes
```
Expected: cria `conteudo/partes.csv` com ≈ 503 linhas e 138 pais (50 de nível 1). Conferir: `grep -c '^FMA7088,' conteudo/partes.csv` → 7 (6 partes + resto); `grep '^FMA12514,' conteudo/partes.csv` → nada (exceção); `grep -c ',auto$' conteudo/partes.csv` ≈ todas.

```bash
pnpm --filter @corpo3d/pipeline construir && pnpm --filter @corpo3d/pipeline portao
```
Expected: 241 peças + partes (`N pais com partes`), total de partes < 12 MB, portão com 0 problemas. Anote o tempo e o total de MB das partes no relatório. Se o total passar de 12 MB, **não suba o orçamento**: relate.

```bash
git add packages/pipeline conteudo/partes.csv
git commit -m "feat(pipeline): partes por continência de elementos, curadoria em conteudo/partes.csv, GLB+JSON por pai, numPartes e portão de partes"
```

---

### Task B: Conteúdo — nomes em português das partes, e a curadoria do coração

**Files:**
- Modify: `conteudo/partes.csv` (só as colunas `nomePt`, `nomeLeigo`, e novas linhas `revisado` do coração)
- Regenera: `apps/web/public/models/partes/**` (gitignored)

Esta tarefa é de conteúdo, feita por um agente com a ferramenta de leitura/escrita; o único código é um script descartável para aplicar os nomes sem quebrar o CSV.

- [ ] **Step B1: Extrair os nomes distintos a traduzir**

```bash
cd ~/Projetos/corpo3d && python3 -c "
import csv,json
rows=list(csv.DictReader(open('conteudo/partes.csv',encoding='utf8')))
pend=sorted({r['nomeEn'] for r in rows if r['status']=='auto' and (not r['nomePt'] or not r['nomeLeigo']) and not r['fmaId'].endswith('-resto')})
json.dump(pend,open('/tmp/corpo3d-nomes-pendentes.json','w',encoding='utf8'),ensure_ascii=False,indent=0)
print(len(pend),'nomes distintos pendentes')"
```
Expected: ≈ 445 nomes.

- [ ] **Step B2: Rascunhar as traduções**

Criar `/tmp/corpo3d-nomes-pt.json` com um objeto `{ "<nomeEn>": { "nomePt": "...", "nomeLeigo": "..." } }` para **todos** os nomes do passo B1. Regras (as mesmas do spec-mãe §8 para as peças):
- `nomePt`: Terminologia Anatômica em português, inicial maiúscula, lado por extenso ("Ventrículo esquerdo", "Artéria coronária direita", "Lobo esquerdo do fígado", "Osso zigomático direito").
- `nomeLeigo`: 3 a 8 palavras, sem termo técnico, sem número clínico, minúsculas ("câmara que bombeia sangue para o corpo", "vaso que irriga o próprio coração"). Quando não houver forma leiga honesta, repetir o `nomePt` em minúsculas.
- Ramos de artéria e veia: "Ramo <x> da artéria <y>"; cúspides e folhetos: "Cúspide anterior da valva aórtica"; giros e sulcos do cérebro: "Giro pré-central direito".
- Não inventar estruturas: se o nome em inglês for opaco (ex.: `myocardial zone 4` não deveria estar aqui, é lista negra), traduzir literalmente e marcar `nomeLeigo` igual ao `nomePt`.

Fazer em lotes de ~100 nomes para não perder qualidade.

- [ ] **Step B3: Aplicar ao CSV e curar o coração**

```bash
cd ~/Projetos/corpo3d && python3 - <<'PY'
import csv,json
nomes=json.load(open('/tmp/corpo3d-nomes-pt.json',encoding='utf8'))
p='conteudo/partes.csv'
rows=list(csv.DictReader(open(p,encoding='utf8')))
cab=['paiFmaId','fmaId','nomeEn','nomePt','nomeLeigo','status']
faltou=set(); n=0
for r in rows:
    if r['status']!='auto': continue
    if r['fmaId'].endswith('-resto'):
        if not r['nomeLeigo']: r['nomeLeigo']='o que sobra depois das partes nomeadas'
        continue
    t=nomes.get(r['nomeEn'])
    if not t: faltou.add(r['nomeEn']); continue
    if not r['nomePt']: r['nomePt']=t['nomePt']; n+=1
    if not r['nomeLeigo']: r['nomeLeigo']=t['nomeLeigo']
# curadoria do coração (spec §4): átrios entram mesmo sobrepondo as valvas com os ventrículos
cur=[('FMA7088','FMA7097','left atrium','Átrio esquerdo','câmara que recebe o sangue dos pulmões'),
     ('FMA7088','FMA7096','right atrium','Átrio direito','câmara que recebe o sangue do corpo')]
have={(r['paiFmaId'],r['fmaId']) for r in rows}
for pai,fma,en,pt,leigo in cur:
    if (pai,fma) not in have: rows.append({'paiFmaId':pai,'fmaId':fma,'nomeEn':en,'nomePt':pt,'nomeLeigo':leigo,'status':'revisado'})
with open(p,'w',encoding='utf8',newline='') as f:
    w=csv.DictWriter(f,fieldnames=cab,lineterminator='\n'); w.writeheader(); w.writerows(rows)
print('nomes aplicados:',n,'| sem tradução:',sorted(faltou)[:20],len(faltou))
PY
```
Expected: `sem tradução: [] 0`. Se faltar algum, volte ao B2 para esses nomes e rode de novo.

- [ ] **Step B4: Regenerar (preserva nomes), construir, portão, testes, commit**

```bash
pnpm --filter @corpo3d/pipeline propor-partes     # reordena as linhas do coração (átrios revisados entram) e mantém os nomes
grep '^FMA7088,' conteudo/partes.csv               # deve listar átrios com status revisado e os demais auto
pnpm --filter @corpo3d/pipeline construir && pnpm --filter @corpo3d/pipeline portao
pnpm --filter @corpo3d/pipeline test
```
Expected: o coração passa a ter 8 linhas (6 auto + 2 revisado; os átrios cobrem os 4 elementos do resto, então a linha `-resto` some — se sobrar algum elemento, a linha fica e são 9); `construir` não falha nas linhas revisadas (átrios são subconjunto do coração); portão 0 problemas. Abrir `apps/web/public/models/partes/FMA7088.json` e conferir que `nomePt` dos átrios e ventrículos está em português.

Conferência humana obrigatória: listar 30 linhas ao acaso (`shuf -n 30 conteudo/partes.csv`) no relatório para o revisor ler.

```bash
git add conteudo/partes.csv
git commit -m "content: nomes em português (rascunho automático) das partes + átrios do coração revisados"
```

---

### Task C: Estado e cena — pilha de detalhe, carga sob demanda, visibilidade e esmaecimento

**Files:**
- Modify: `apps/web/src/lib/manifesto.ts`, `apps/web/src/lib/estado/schema.ts`, `apps/web/src/lib/estado/store.ts`, `apps/web/src/components/viewer/Cena.tsx`, `apps/web/src/components/viewer/Peca.tsx`
- Create: `apps/web/src/lib/estado/detalhe.ts`
- Test: `apps/web/src/lib/estado/schema.test.ts`, `apps/web/src/lib/estado/detalhe.test.ts` (novo), `apps/web/src/lib/estado/store.test.ts`

- [ ] **Step C1: Testes (RED)**

Em `apps/web/src/lib/estado/schema.test.ts`, acrescentar dentro do `describe('EstadoCena')`:

```ts
  it('aceita ids -resto e a pilha de detalhe; link antigo sem detalhe vira []', () => {
    const e: EstadoCena = { ...ESTADO_INICIAL, detalhe: ['FMA7088', 'FMA7101'], ocultas: ['FMA7088-resto'] };
    expect(desserializar(serializar(e))).toEqual(e);
    const semDetalhe = JSON.parse(serializar(ESTADO_INICIAL)) as Record<string, unknown>;
    delete semDetalhe.detalhe;
    expect(desserializar(JSON.stringify(semDetalhe)).detalhe).toEqual([]);
    expect(EstadoCenaSchema.safeParse({ ...ESTADO_INICIAL, detalhe: ['coração'] }).success).toBe(false);
    expect(EstadoCenaSchema.safeParse({ ...ESTADO_INICIAL, ocultas: ['FMA1-lixo'] }).success).toBe(false);
  });
```

Criar `apps/web/src/lib/estado/detalhe.test.ts`:

```ts
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
```

Em `apps/web/src/lib/estado/store.test.ts`, acrescentar (com `vi` importado de vitest e `afterEach`):

```ts
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
```
(`abrirPartes({ ...peca, fmaId: 'FMA10' })` funciona porque o mock devolve o `paiFmaId` da URL; o teste só verifica a pilha.)

Run: `pnpm --filter @corpo3d/web test` → FAIL (`detalhe` não existe no schema, `./detalhe` não existe, `abrirPartes` não existe).

- [ ] **Step C2: `manifesto.ts`, `schema.ts`, `detalhe.ts` (GREEN, parte 1)**

Em `apps/web/src/lib/manifesto.ts`: em `PecaManifesto`, acrescentar `numPartes?: number;` (opcional: manifesto antigo não tem) depois de `elementos: number;`, e ao fim do arquivo:

```ts
/** Uma parte é uma peça comum mais o pai, o nível (2–5) e o estado da curadoria do nome. */
export interface PartePeca extends PecaManifesto { paiFmaId: string; nivel: number; status: 'auto' | 'revisado' }
export interface ManifestoPartes { versao: 1; paiFmaId: string; partes: PartePeca[] }
export const ehParte = (p: PecaManifesto): p is PartePeca => 'paiFmaId' in p;

export async function carregarManifestoPartes(paiFmaId: string): Promise<PartePeca[]> {
  const res = await fetch(`/models/partes/${paiFmaId}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`partes/${paiFmaId}.json: HTTP ${res.status}`);
  const m = (await res.json()) as ManifestoPartes;
  if (m.versao !== 1 || m.paiFmaId !== paiFmaId || !Array.isArray(m.partes)) throw new Error(`partes/${paiFmaId}.json em formato inesperado`);
  return m.partes;
}
```

Em `apps/web/src/lib/estado/schema.ts`: trocar `const FmaId = z.string().regex(/^FMA\d+$/);` por `const FmaId = z.string().regex(/^FMA\d+(-resto)?$/); // "-resto" = o que sobra de um nó depois das partes nomeadas`; no `z.object`, depois de `camera`, acrescentar:

```ts
  /** Pilha de nós abertos no modo detalhe (peça → parte → parte…), da raiz ao mais fundo. Ausente em links antigos → []. */
  detalhe: z.array(FmaId).default([]),
```
e em `ESTADO_INICIAL` acrescentar `detalhe: [],`.

Criar `apps/web/src/lib/estado/detalhe.ts`:

```ts
import type { Manifesto, PartePeca, PecaManifesto } from '@/lib/manifesto';
import type { EstadoCena } from './schema';

export type EstadoPartes = PartePeca[] | 'carregando' | 'erro';
/** Partes por pai, transitório (não vai no link): lista quando chegou, ou o estado da carga. */
export type PartesCarregadas = Record<string, EstadoPartes | undefined>;

export const partesDe = (partes: PartesCarregadas, id: string): PartePeca[] | null => {
  const p = partes[id];
  return Array.isArray(p) ? p : null;
};

/**
 * Visível = peças de nível 1 menos a raiz da pilha, mais, para cada nó aberto, as partes dele
 * menos o nó seguinte; depois os filtros de opacidade do sistema e de `ocultas`. Um nó aberto
 * cujas partes ainda não chegaram continua visível (sem buraco) e os níveis abaixo dele não entram.
 */
export function pecasVisiveis(manifesto: Manifesto, partes: PartesCarregadas, e: EstadoCena): PecaManifesto[] {
  const raiz = e.detalhe[0];
  const lista: PecaManifesto[] = manifesto.pecas.filter((p) => p.fmaId !== raiz || !partesDe(partes, raiz));
  for (let i = 0; i < e.detalhe.length; i++) {
    const abertas = partesDe(partes, e.detalhe[i]);
    if (!abertas) break;
    const proximo = e.detalhe[i + 1];
    for (const p of abertas) if (p.fmaId !== proximo || !partesDe(partes, proximo)) lista.push(p);
  }
  return lista.filter((p) => e.opacidade[p.sistema] > 0 && !e.ocultas.includes(p.fmaId));
}

let memo: { partes: PartesCarregadas; detalhe: string[]; dentro: Set<string> | null } | null = null;

/**
 * Ids das partes do nó mais fundo cujas partes já chegaram; `null` = nada esmaece (sem detalhe
 * ou nada carregado). Memoizado por identidade de `partes` e `detalhe`: 241 peças consultam
 * isto a cada mudança do store.
 */
export function dentroDoDetalhe(partes: PartesCarregadas, e: EstadoCena): Set<string> | null {
  if (memo && memo.partes === partes && memo.detalhe === e.detalhe) return memo.dentro;
  let dentro: Set<string> | null = null;
  for (let i = e.detalhe.length - 1; i >= 0; i--) {
    const l = partesDe(partes, e.detalhe[i]);
    if (l) { dentro = new Set(l.map((p) => p.fmaId)); break; }
  }
  memo = { partes, detalhe: e.detalhe, dentro };
  return dentro;
}
```

- [ ] **Step C3: store (GREEN, parte 2)**

Em `apps/web/src/lib/estado/store.ts`:
1. Imports: trocar `import type { Sistema, Manifesto } from '@/lib/manifesto';` por `import { carregarManifestoPartes, type Manifesto, type PecaManifesto, type Sistema } from '@/lib/manifesto';` e acrescentar `import { enquadrar } from './geometria';` e `import type { PartesCarregadas } from './detalhe';`. (`geometria.ts` só importa TIPOS deste arquivo, então não há ciclo em tempo de execução.)
2. Na interface `Loja`, no bloco transitório, acrescentar `partes: PartesCarregadas;` e, no bloco de domínio:

```ts
  /** Busca `/models/partes/<pai>.json` uma vez; guarda a lista, ou 'erro'. */
  carregarPartes(paiFmaId: string): Promise<void>;
  /** Carrega antes de abrir; se falhar, não muda o estado e devolve false. Encaixa o nó, empilha, tira a seleção, enquadra. */
  abrirPartes(peca: PecaManifesto): Promise<boolean>;
  /** Mantém os primeiros `nivel` itens da pilha (0 fecha tudo). */
  fecharPartes(nivel: number): void;
```
3. No `create`: `partes: {}` no estado inicial; em `reiniciar`, acrescentar `partes: {}` ao `set`; e as ações:

```ts
  carregarPartes: async (paiFmaId) => {
    if (get().partes[paiFmaId] !== undefined && get().partes[paiFmaId] !== 'erro') return;
    set({ partes: { ...get().partes, [paiFmaId]: 'carregando' } });
    try {
      const lista = await carregarManifestoPartes(paiFmaId);
      set({ partes: { ...get().partes, [paiFmaId]: lista } });
    } catch (e) {
      console.warn(`partes de ${paiFmaId}:`, (e as Error).message);
      set({ partes: { ...get().partes, [paiFmaId]: 'erro' } });
    }
  },
  abrirPartes: async (peca) => {
    await get().carregarPartes(peca.fmaId);
    if (!Array.isArray(get().partes[peca.fmaId])) return false;
    const e = get().estado;
    const q = enquadrar(peca);
    get().aplicar({ detalhe: [...e.detalhe, peca.fmaId], soltas: e.soltas.filter((s) => s.fmaId !== peca.fmaId), camera: { pos: q.pos, alvo: q.alvo } });
    set({ selecionada: null, presetCamera: 'livre' });
    return true;
  },
  fecharPartes: (nivel) => get().aplicar({ detalhe: get().estado.detalhe.slice(0, Math.max(0, nivel)) }),
```
4. Ao fim do arquivo, o seletor que acha uma peça OU uma parte carregada:

```ts
/** Peça de nível 1 ou parte já carregada; null se não houver. */
export function pecaDe(s: { manifesto: Manifesto | null; partes: PartesCarregadas }, fmaId: string | null): PecaManifesto | null {
  if (!fmaId) return null;
  const p = s.manifesto?.pecas.find((x) => x.fmaId === fmaId);
  if (p) return p;
  for (const l of Object.values(s.partes)) {
    if (!Array.isArray(l)) continue;
    const q = l.find((x) => x.fmaId === fmaId);
    if (q) return q;
  }
  return null;
}
```

Run: `pnpm --filter @corpo3d/web test` → PASS (todos). `pnpm --filter @corpo3d/web typecheck` → limpo.

- [ ] **Step C4: `Cena.tsx` e `Peca.tsx`**

Em `apps/web/src/components/viewer/Cena.tsx`:
1. `import { pecasVisiveis } from '@/lib/estado/detalhe';`
2. No componente `Cena`, depois de `const estado = useLoja((s) => s.estado);` acrescentar `const partes = useLoja((s) => s.partes);` e `const carregarPartes = useLoja((s) => s.carregarPartes);`.
3. Depois do `useEffect` do manifesto, acrescentar (antes dos `if (erro)` — hooks não podem vir depois de returns):

```ts
  // um link que chega com a pilha preenchida precisa das partes de cada nó; `carregarPartes` marca 'carregando' na hora, então não repete
  useEffect(() => {
    for (const id of estado.detalhe) if (partes[id] === undefined) void carregarPartes(id);
  }, [estado.detalhe, partes, carregarPartes]);
```
4. Trocar `const visiveis = manifesto.pecas.filter((p) => estado.opacidade[p.sistema] > 0 && !estado.ocultas.includes(p.fmaId));` por `const visiveis = pecasVisiveis(manifesto, partes, estado);`.
5. Nos `data-*` da div, acrescentar `data-detalhe={estado.detalhe.join('>')}`.

Em `apps/web/src/components/viewer/Peca.tsx`:
1. `import { dentroDoDetalhe } from '@/lib/estado/detalhe';`
2. Depois de `const isolada = useLoja(...)` acrescentar:

```ts
  // modo detalhe: tudo que não é parte do nó mais fundo esmaece, como no isolar
  const foraDoDetalhe = useLoja((s) => {
    const dentro = dentroDoDetalhe(s.partes, s.estado);
    return dentro !== null && !dentro.has(peca.fmaId);
  });
```
3. Trocar a linha `const opacidade = opacidadeSistema * (isolada && isolada !== peca.fmaId ? OPACIDADE_FORA_DA_ISOLACAO : 1);` por:

```ts
  const opacidade = opacidadeSistema * (isolada && isolada !== peca.fmaId ? OPACIDADE_FORA_DA_ISOLACAO : 1) * (foraDoDetalhe ? OPACIDADE_FORA_DA_ISOLACAO : 1);
```

Run: `pnpm --filter @corpo3d/web typecheck` → limpo; `pnpm --filter @corpo3d/web test` → PASS. Rodar `cd apps/web && pnpm test:e2e e2e/visualizador.spec.ts e2e/interacao.spec.ts --project=desktop` → PASS (nada muda sem detalhe aberto).

- [ ] **Step C5: Commit**

```bash
git add apps/web/src/lib/manifesto.ts apps/web/src/lib/estado apps/web/src/components/viewer/Cena.tsx apps/web/src/components/viewer/Peca.tsx
git commit -m "feat(web): modo detalhe no estado (pilha), carga de partes sob demanda, visibilidade e esmaecimento"
```

---

### Task D: Interface — botão, caminho, lista, Esc; E2E e capturas

**Files:**
- Modify: `apps/web/src/components/estudio/PainelPeca.tsx`, `apps/web/src/components/estudio/ListaPecas.tsx`, `apps/web/src/components/estudio/Estudio.tsx`, `apps/web/src/lib/hooks/useAtalhos.ts`, `apps/web/src/app/globals.css`
- Create: `apps/web/src/components/estudio/Caminho.tsx`, `apps/web/e2e/detalhe.spec.ts`

- [ ] **Step D1: E2E primeiro (RED)**

Criar `apps/web/e2e/detalhe.spec.ts` (`AxeBuilder` vem de `@axe-core/playwright`, como em `e2e/acessibilidade.spec.ts`):

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { aguardarModeloRenderizado, capturarSePossivel } from './util';
import type { ManifestoPartes } from '../src/lib/manifesto';

const CORACAO = 'FMA7088';
const VENTRICULO_ESQUERDO = 'FMA7101';

test('abre as partes do coração, seleciona um ventrículo, explode dentro do órgão, volta pelo caminho e desfaz', async ({ page }, info) => {
  test.skip(info.project.use.viewport!.width < 500, 'no celular a lista fica abaixo do palco; coberto no desktop e tablet');
  const raiz = dirname(info.config.configFile ?? join(process.cwd(), 'playwright.config.ts'));
  const json = JSON.parse(readFileSync(join(raiz, 'public/models/partes', `${CORACAO}.json`), 'utf8')) as ManifestoPartes;
  const n = json.partes.length;
  const ventriculo = json.partes.find((p) => p.fmaId === VENTRICULO_ESQUERDO);
  expect(ventriculo, 'o coração precisa ter o ventrículo esquerdo como parte (partes.csv)').toBeDefined();

  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '241');
  await aguardarModeloRenderizado(page);

  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('coração');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Coração\b/ }).click();
  await expect(cena).toHaveAttribute('data-selecionada', CORACAO);
  await page.getByRole('button', { name: `Ver partes (${n})` }).click();
  await expect(cena).toHaveAttribute('data-detalhe', CORACAO);
  await expect(cena).toHaveAttribute('data-visiveis', String(240 + n));
  await expect(cena).toHaveAttribute('data-selecionada', '');
  await expect(page.getByRole('navigation', { name: 'Caminho' })).toContainText('Coração');
  await capturarSePossivel(page, join(process.env.HOME ?? '', 'Desktop', `corpo3d-detalhe-coracao-${info.project.name}.png`));

  // a lista ganha o grupo "Partes de Coração"; escolher o ventrículo seleciona e enquadra
  await page.getByRole('listbox', { name: 'Peças' }).getByRole('option', { name: ventriculo!.nomePt, exact: true }).click();
  await expect(cena).toHaveAttribute('data-selecionada', VENTRICULO_ESQUERDO);
  await expect(page.getByTestId('painel-peca')).toContainText(ventriculo!.nomePt);

  // explosão move a parte a partir do centro do coração
  await page.getByLabel('Explosão').fill('0.5');
  await expect(cena).toHaveAttribute('data-explosao', '0.5');
  await expect.poll(async () => page.evaluate((id) => {
    const cena = (window as unknown as { __cena?: { getObjectByName(n: string): { position: { length(): number } } | undefined } }).__cena;
    return cena?.getObjectByName(id)?.position.length() ?? 0;
  }, VENTRICULO_ESQUERDO)).toBeGreaterThan(0.02);
  await page.getByRole('button', { name: 'Remontar tudo' }).click();

  // acessibilidade com detalhe aberto
  const axe = await new AxeBuilder({ page }).exclude('canvas').analyze(); // mesmo recorte do acessibilidade.spec: o canvas WebGL não é conteúdo
  expect(axe.violations).toEqual([]);

  // caminho: "Corpo" fecha tudo; desfazer reabre
  await page.getByRole('navigation', { name: 'Caminho' }).getByRole('button', { name: 'Corpo' }).click();
  await expect(cena).toHaveAttribute('data-detalhe', '');
  await expect(cena).toHaveAttribute('data-visiveis', '241');
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(cena).toHaveAttribute('data-detalhe', CORACAO);
  await expect(cena).toHaveAttribute('data-visiveis', String(240 + n));
});

test('Esc com detalhe aberto e nada selecionado fecha um nível', async ({ page }, info) => {
  test.skip(info.project.use.viewport!.width < 500, 'coberto no desktop e tablet');
  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toHaveAttribute('data-pecas', '241');
  await aguardarModeloRenderizado(page);
  await page.getByRole('searchbox', { name: 'Buscar peça' }).fill('coração');
  await page.getByRole('listbox', { name: 'Resultados' }).getByRole('option', { name: /^Coração\b/ }).click();
  await page.getByRole('button', { name: /^Ver partes/ }).click();
  await expect(cena).toHaveAttribute('data-detalhe', CORACAO);
  await page.keyboard.press('Escape');
  await expect(cena).toHaveAttribute('data-detalhe', '');
});
```

Run: `cd apps/web && pnpm test:e2e e2e/detalhe.spec.ts --project=desktop` → FAIL (não há botão "Ver partes").

- [ ] **Step D2: `Caminho.tsx`**

Criar `apps/web/src/components/estudio/Caminho.tsx`:

```tsx
'use client';
import { useLoja, pecaDe } from '@/lib/estado/store';
import { useShallow } from 'zustand/react/shallow';

/** Corpo › Coração › Ventrículo esquerdo. Cada nível anterior fecha até ali; some sem detalhe. */
export function Caminho() {
  const detalhe = useLoja((s) => s.estado.detalhe);
  const nomes = useLoja(useShallow((s) => s.estado.detalhe.map((id) => pecaDe(s, id)?.nomePt ?? id)));
  const fecharPartes = useLoja((s) => s.fecharPartes);
  if (detalhe.length === 0) return null;
  return (
    <nav aria-label="Caminho" className="caminho">
      <button type="button" onClick={() => fecharPartes(0)}>Corpo</button>
      {detalhe.map((id, i) => (
        <span key={id}>
          <span aria-hidden> › </span>
          {i === detalhe.length - 1
            ? <span aria-current="location">{nomes[i]}</span>
            : <button type="button" onClick={() => fecharPartes(i + 1)}>{nomes[i]}</button>}
        </span>
      ))}
    </nav>
  );
}
```

Em `apps/web/src/components/estudio/Estudio.tsx`: `import { Caminho } from './Caminho';` e, dentro do `<aside className="painel painel-direito" …>`, colocar `<Caminho />` antes de `<PainelPeca />`.

Em `apps/web/src/app/globals.css`, acrescentar ao fim:

```css
.caminho { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; margin: 0 0 10px; font-size: 12px; color: var(--muted); }
.caminho button { padding: 2px 6px; }
.caminho [aria-current] { color: var(--acento); }
.tarja { display: inline-block; margin-left: 6px; padding: 1px 6px; border: 1px solid var(--muted); border-radius: 10px; font-size: 11px; color: var(--muted); vertical-align: middle; }
```

- [ ] **Step D3: `PainelPeca.tsx`**

1. Trocar `import { useLoja, corDestaqueDe, notaDe, type CorDestaque } from '@/lib/estado/store';` por `import { useLoja, corDestaqueDe, notaDe, pecaDe, type CorDestaque } from '@/lib/estado/store';` e acrescentar `import { ehParte } from '@/lib/manifesto';`.
2. Trocar `const peca = useLoja((s) => s.manifesto?.pecas.find((p) => p.fmaId === fmaId) ?? null);` por `const peca = useLoja((s) => pecaDe(s, fmaId));` e, logo abaixo, `const estadoPartes = useLoja((s) => (fmaId ? s.partes[fmaId] : undefined));`.
3. Na desestruturação do `useLoja.getState()`, acrescentar `abrirPartes`.
4. Trocar a linha do `<h2 className="nome-leigo">…</h2>` por:

```tsx
      <h2 className="nome-leigo">{peca.nomeLeigo}{ehParte(peca) && peca.status === 'auto' && <span className="tarja">nome automático, em revisão</span>}</h2>
```
5. Na primeira `<div className="linha-botoes">`, antes do botão "Focar", acrescentar:

```tsx
        {(peca.numPartes ?? 0) > 0 && (
          <button type="button" disabled={estadoPartes === 'carregando'} onClick={() => void abrirPartes(peca)}>
            {estadoPartes === 'carregando' ? 'Carregando partes…' : `Ver partes (${peca.numPartes})`}
          </button>
        )}
        {estadoPartes === 'erro' && <span role="alert" className="rascunho">Partes indisponíveis</span>}
```

- [ ] **Step D4: `ListaPecas.tsx`**

1. Imports: acrescentar `import { partesDe, dentroDoDetalhe } from '@/lib/estado/detalhe';` e `import { pecaDe } from '@/lib/estado/store';` (junte ao import existente de `useLoja`).
2. Depois de `const soltas = useLoja((s) => s.estado.soltas);` acrescentar:

```ts
  // com detalhe aberto, as partes do nó mais fundo carregado entram como primeiro grupo da lista
  const noAberto = useLoja((s) => {
    for (let i = s.estado.detalhe.length - 1; i >= 0; i--) if (partesDe(s.partes, s.estado.detalhe[i])) return s.estado.detalhe[i];
    return null;
  });
  const partesAbertas = useLoja((s) => (noAberto ? partesDe(s.partes, noAberto) : null));
  const nomeNoAberto = useLoja((s) => (noAberto ? pecaDe(s, noAberto)?.nomePt ?? noAberto : ''));
```
(`dentroDoDetalhe` fica sem uso aqui; remova do import se o lint reclamar.)
3. No `<ul role="listbox" …>`, antes do `{SISTEMAS.flatMap(...)}`, acrescentar:

```tsx
        {partesAbertas && [
          <li key="grupo-partes" role="presentation" className="grupo">Partes de {nomeNoAberto}</li>,
          ...partesAbertas.map((p) => (
            <li key={`parte-${p.fmaId}`} role="option" tabIndex={0} aria-selected={selecionada === p.fmaId}
              onClick={() => agir(p, 'selecionar')}
              onKeyDown={(e) => { if (e.key === 'Enter') agir(p, 'selecionar'); if (e.key === ' ') { e.preventDefault(); agir(p, 'alternar'); } }}>
              {p.nomePt}{soltas.some((x) => x.fmaId === p.fmaId) && <span aria-label="solta"> ⇢</span>}
            </li>
          )),
        ]}
```
4. Trocar `<summary>Todas as peças ({pecas.length})</summary>` por `<summary>Todas as peças ({pecas.length}{partesAbertas ? ` + ${partesAbertas.length} partes` : ''})</summary>`.

- [ ] **Step D5: `useAtalhos.ts` — Esc fecha um nível**

Trocar o bloco `if (e.key === 'Escape') { loja.isolar(null); loja.selecionar(null); return; }` por:

```ts
      if (e.key === 'Escape') {
        if (loja.selecionada || loja.estado.isolada) { loja.isolar(null); loja.selecionar(null); return; }
        // nada selecionado nem isolado: com detalhe aberto, fecha um nível
        if (loja.estado.detalhe.length) loja.fecharPartes(loja.estado.detalhe.length - 1);
        return;
      }
```
Atualizar o comentário de doc do hook: `/** Escape: tira seleção/isolação; sem nada selecionado, fecha um nível do detalhe. Cmd/Ctrl+Z desfaz; Shift+Cmd/Ctrl+Z ou Ctrl+Y refaz. */`.

- [ ] **Step D6: Rodar tudo, capturas, commit**

```bash
pnpm --filter @corpo3d/web test && pnpm --filter @corpo3d/web typecheck
cd apps/web && pnpm test:e2e e2e/detalhe.spec.ts --project=desktop --project=tablet
cd apps/web && pnpm test:e2e
```
Expected: detalhe.spec 4 passed (2 testes × desktop/tablet), 2 skipped (celular); suíte inteira sem regressão (os 38 anteriores passam). Se `acessibilidade` acusar violação no listbox por causa do grupo novo, a estrutura tem de continuar achatada (`li role="presentation"` + `li role="option"` irmãos) — confira que o grupo das partes segue exatamente esse formato.

Capturas na Mesa: `corpo3d-detalhe-coracao-desktop.png` (gerada pelo teste). Abrir com Read e descrever: o coração some e no lugar aparecem coronárias, ventrículos e átrios em cores do sistema; o resto do corpo está esmaecido; o caminho "Corpo › Coração" está no painel direito.

```bash
git add apps/web/src/components/estudio apps/web/src/lib/hooks/useAtalhos.ts apps/web/src/app/globals.css apps/web/e2e/detalhe.spec.ts
git commit -m "feat(web): modo detalhe — Ver partes, caminho, grupo de partes na lista, Esc fecha nível; E2E"
```

---

### Task E: Fechar a branch

- [ ] **Step E1: Portão final**

```bash
pnpm --filter @corpo3d/pipeline test && pnpm --filter @corpo3d/pipeline typecheck && pnpm --filter @corpo3d/pipeline portao
pnpm --filter @corpo3d/web test && pnpm --filter @corpo3d/web typecheck
cd apps/web && pnpm test:e2e
```

- [ ] **Step E2: Merge e spec-mãe**

```bash
git checkout main && git merge --no-ff feat/modo-detalhe -m "merge: modo detalhe — partes de cada órgão por continência de elementos, curadoria em CSV, pilha no estado"
```
Em `docs/superpowers/specs/2026-09-21-corpo3d-design.md`, seção 3 ("Entra"), acrescentar o item: "Modo detalhe: um órgão abre nas partes dele, recursivo, com partes automáticas do atlas e curadoria em `conteudo/partes.csv` (spec `2026-09-22-corpo3d-modo-detalhe-design.md`)." Commit: `docs: spec-mãe aponta para o spec do modo detalhe`.
