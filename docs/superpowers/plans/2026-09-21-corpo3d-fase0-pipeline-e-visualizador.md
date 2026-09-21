# Corpo3D — Fase 0: pipeline de assets + visualizador mínimo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converter as 251 peças de `conteudo/estruturas.csv` do BodyParts3D em GLBs comprimidos com manifesto, e abrir todas num visualizador Next 16 + React Three Fiber com um material físico por sistema.

**Architecture:** Monorepo pnpm com `packages/pipeline` (scripts Node/TypeScript, sem Blender: parser OBJ próprio → gltf-transform → meshopt) e `apps/web` (Next 16, R3F, drei, `frameloop="demand"`). O pipeline escreve em `apps/web/public/models/<sistema>/<fmaId>.glb` + `manifest.json`; o app só lê o manifesto. Conteúdo anatômico vive em `conteudo/` versionado; GLBs gerados ficam fora do git.

**Tech Stack:** Node 22 (`.nvmrc`), pnpm 11, TypeScript 5, Vitest 5, `@gltf-transform/{core,functions,extensions}` 4.5, `meshoptimizer` 1.2, `yauzl` 3 (unzip), Next 16.3, React 19.2, `three` 0.186, `@react-three/fiber` 9.7, `@react-three/drei` 10.7, `@react-three/postprocessing` 3.1, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-21-corpo3d-design.md` (seções 2, 4.1, 4.2, 8, 10 e 11 fase 0).

**Fora deste plano** (planos próprios, escritos depois que este entregar): fase 1 (interação completa: camadas, arrasto, encaixe, explosão, undo, anotação, **mais SSAO, contorno de hover e HDRI local via `@react-three/postprocessing`**), fases 2–3 (login, link, snapshot, celular), fase 4 (produção de descrições).

**Fatos verificados em 2026-09-21 que este plano assume** (não re-verificar, já está no spec §2):
- `isa_BP3D_4.0_obj_99.zip`: 142.903.898 bytes, SHA-256 `40665852c49f218326590e204db91064a1ecfc3c6f8cbd7bbbcaac62c7cd409e`, 2.234 arquivos `isa_BP3D_4.0_obj_99/FJ####[M].obj`.
- Elementos: `partof_element_parts.txt` e `isa_element_parts.txt`, tab-delimitados, colunas `concept id`, `name`, `element file id`, 1ª linha é cabeçalho.
- OBJ em mm, Z para cima, `+x` = esquerda do paciente, frente em `−y`; faces `f a//b c//d e//f`.
- `normals()` do gltf-transform desolda a malha: **não usar**. `meshopt()` quantiza e move a escala para a matriz do nó.
- Ensaio: 251 peças → 8,9 MB.

---

## Estrutura de arquivos

```
corpo3d/
├── package.json                      # workspace raiz: scripts test/lint
├── pnpm-workspace.yaml
├── .nvmrc                            # 22
├── tsconfig.base.json
├── conteudo/
│   ├── estruturas.csv                # JÁ EXISTE (251 linhas)
│   └── gerar-estruturas.py           # JÁ EXISTE
├── packages/pipeline/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── constantes.ts             # URLs, SHA, caminhos, razões padrão, orçamentos
│   │   ├── baixar.ts                 # download + checksum + unzip
│   │   ├── catalogo.ts               # parse dos element_parts + CSV → lista de peças
│   │   ├── obj.ts                    # parser OBJ + conversão de eixos + merge
│   │   ├── normais.ts                # normais suaves ponderadas por área
│   │   ├── glb.ts                    # geometria → Document → weld/simplify/meshopt → GLB
│   │   ├── manifesto.ts              # tipos e montagem do manifest.json
│   │   ├── construir.ts              # orquestra tudo (CLI)
│   │   └── portao.ts                 # verifica orçamentos sobre o manifesto real (CLI)
│   └── tests/
│       ├── fixtures/                 # OBJs mínimos, element_parts mínimos, CSV mínimo
│       ├── baixar.test.ts
│       ├── catalogo.test.ts
│       ├── obj.test.ts
│       ├── normais.test.ts
│       ├── glb.test.ts
│       └── construir.test.ts
└── apps/web/
    ├── package.json
    ├── next.config.ts
    ├── tsconfig.json
    ├── playwright.config.ts
    ├── public/models/                # gerado, .gitignore
    ├── src/app/layout.tsx
    ├── src/app/page.tsx              # /  — visualizador mínimo
    ├── src/app/atribuicao/page.tsx   # /atribuicao — texto exigido pela CC BY
    ├── src/lib/manifesto.ts          # tipo Manifesto + loader
    ├── src/lib/materiais/index.ts    # material por sistema
    ├── src/components/viewer/Cena.tsx
    ├── src/components/viewer/Peca.tsx
    └── e2e/visualizador.spec.ts
```

Cada arquivo de `src/` do pipeline tem uma responsabilidade e exporta funções puras testáveis; só `construir.ts` e `portao.ts` tocam disco de verdade fora dos testes.

---

### Task 1: Esqueleto do monorepo

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.base.json`
- Create: `packages/pipeline/package.json`, `packages/pipeline/tsconfig.json`, `packages/pipeline/vitest.config.ts`
- Create: `packages/pipeline/tests/fumaca.test.ts`

- [ ] **Step 1: Arquivos da raiz**

`package.json`:
```json
{
  "name": "corpo3d",
  "private": true,
  "packageManager": "pnpm@11.4.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "pnpm -r --if-present test",
    "typecheck": "pnpm -r --if-present typecheck"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`.nvmrc`:
```
22
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 2: Pacote do pipeline**

`packages/pipeline/package.json`:
```json
{
  "name": "@corpo3d/pipeline",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "baixar": "tsx src/baixar.ts",
    "construir": "tsx src/construir.ts",
    "portao": "tsx src/portao.ts"
  },
  "dependencies": {
    "@gltf-transform/core": "4.5.0",
    "@gltf-transform/extensions": "4.5.0",
    "@gltf-transform/functions": "4.5.0",
    "meshoptimizer": "1.2.0",
    "yauzl": "3.4.0"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/yauzl": "^2.10.3",
    "tsx": "^4.23.15",
    "typescript": "^5",
    "vitest": "^5.0.1"
  }
}
```

`packages/pipeline/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"], "noEmit": true },
  "include": ["src", "tests"]
}
```

`packages/pipeline/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], testTimeout: 60_000 } });
```

- [ ] **Step 3: Teste de fumaça (para provar que o Vitest roda)**

`packages/pipeline/tests/fumaca.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
describe('ambiente', () => {
  it('roda testes', () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 4: Instalar e rodar**

Run: `cd ~/Projetos/corpo3d && pnpm install && pnpm --filter @corpo3d/pipeline test`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: esqueleto do monorepo pnpm + pacote pipeline com vitest"
```

---

### Task 2: Constantes e download com checksum

**Files:**
- Create: `packages/pipeline/src/constantes.ts`
- Create: `packages/pipeline/src/baixar.ts`
- Test: `packages/pipeline/tests/baixar.test.ts`

- [ ] **Step 1: Constantes**

`packages/pipeline/src/constantes.ts`:
```ts
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = resolve(AQUI, '..', '..', '..');            // corpo3d/
export const DIR_CACHE = resolve(RAIZ, '.cache', 'bp3d');
export const CSV_ESTRUTURAS = resolve(RAIZ, 'conteudo', 'estruturas.csv');
export const DIR_SAIDA = resolve(RAIZ, 'apps', 'web', 'public', 'models');

export const BASE_URL = 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST';
export const ZIP_NOME = 'isa_BP3D_4.0_obj_99.zip';
export const ZIP_SHA256 = '40665852c49f218326590e204db91064a1ecfc3c6f8cbd7bbbcaac62c7cd409e';
export const ZIP_BYTES = 142_903_898;
export const DIR_OBJ_NO_ZIP = 'isa_BP3D_4.0_obj_99';           // prefixo dos arquivos dentro do zip
export const ARQUIVOS_TEXTO = [
  'isa_parts_list_e.txt',
  'partof_parts_list_e.txt',
  'isa_element_parts.txt',
  'partof_element_parts.txt',
] as const;

export const MM_PARA_M = 0.001;
export const ERRO_SIMPLIFICACAO = 0.005;
export const RAZAO_PADRAO: Record<string, number> = {
  pele: 0.3, nervoso: 0.4, olho: 0.6,
  esqueleto: 0.5, musculos: 0.5, cardiovascular: 0.5, respiratorio: 0.5,
  digestivo: 0.5, linfatico: 0.5, urinario: 0.5, reprodutor: 0.5, endocrino: 0.5,
};
export const ORCAMENTO_BYTES_POR_PECA = 500 * 1024;
export const ORCAMENTO_BYTES_TOTAL = 30 * 1024 * 1024;
```

- [ ] **Step 2: Teste do checksum e da lógica "não baixa se confere"**

`packages/pipeline/tests/baixar.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { sha256DoArquivo, precisaBaixar } from '../src/baixar';

describe('baixar', () => {
  it('calcula o sha256 de um arquivo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bp3d-'));
    const f = join(dir, 'a.bin');
    writeFileSync(f, 'corpo3d');
    const esperado = createHash('sha256').update('corpo3d').digest('hex');
    expect(await sha256DoArquivo(f)).toBe(esperado);
  });

  it('não precisa baixar quando o arquivo existe e o hash confere', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bp3d-'));
    const f = join(dir, 'a.bin');
    writeFileSync(f, 'corpo3d');
    const hash = createHash('sha256').update('corpo3d').digest('hex');
    expect(await precisaBaixar(f, hash)).toBe(false);
  });

  it('precisa baixar quando o hash não confere ou o arquivo não existe', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bp3d-'));
    const f = join(dir, 'a.bin');
    expect(await precisaBaixar(f, 'abc')).toBe(true);
    writeFileSync(f, 'outro conteudo');
    expect(await precisaBaixar(f, 'abc')).toBe(true);
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

Run: `pnpm --filter @corpo3d/pipeline test tests/baixar.test.ts`
Expected: FAIL — `Cannot find module '../src/baixar'`

- [ ] **Step 4: Implementar**

`packages/pipeline/src/baixar.ts`:
```ts
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { rename, stat, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import { ARQUIVOS_TEXTO, BASE_URL, DIR_CACHE, DIR_OBJ_NO_ZIP, ZIP_NOME, ZIP_SHA256 } from './constantes';

export async function sha256DoArquivo(caminho: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(caminho), async function* (src) { for await (const c of src) hash.update(c); });
  return hash.digest('hex');
}

export async function precisaBaixar(caminho: string, shaEsperado: string): Promise<boolean> {
  if (!existsSync(caminho)) return true;
  return (await sha256DoArquivo(caminho)) !== shaEsperado;
}

async function baixarArquivo(url: string, destino: string): Promise<void> {
  mkdirSync(dirname(destino), { recursive: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`falha ao baixar ${url}: HTTP ${res.status}`);
  const tmp = `${destino}.part`;
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
  await rename(tmp, destino);
}

/** Extrai só os .obj do zip para `${DIR_CACHE}/obj/`, sem o prefixo do diretório interno. */
export async function extrairObjs(zip: string, destino: string): Promise<number> {
  await mkdir(destino, { recursive: true });
  return new Promise((resolve, reject) => {
    let n = 0;
    yauzl.open(zip, { lazyEntries: true }, (err, arquivo) => {
      if (err) return reject(err);
      arquivo.readEntry();
      arquivo.on('entry', (entrada) => {
        const nome = entrada.fileName;
        if (!nome.startsWith(`${DIR_OBJ_NO_ZIP}/`) || !nome.endsWith('.obj')) return arquivo.readEntry();
        const alvo = join(destino, nome.slice(DIR_OBJ_NO_ZIP.length + 1));
        arquivo.openReadStream(entrada, (e, stream) => {
          if (e) return reject(e);
          stream.pipe(createWriteStream(alvo)).on('finish', () => { n++; arquivo.readEntry(); }).on('error', reject);
        });
      });
      arquivo.on('end', () => resolve(n));
      arquivo.on('error', reject);
    });
  });
}

export async function baixarTudo(): Promise<void> {
  const zip = join(DIR_CACHE, ZIP_NOME);
  if (await precisaBaixar(zip, ZIP_SHA256)) {
    console.log(`baixando ${ZIP_NOME} (143 MB)…`);
    await baixarArquivo(`${BASE_URL}/${ZIP_NOME}`, zip);
    const sha = await sha256DoArquivo(zip);
    if (sha !== ZIP_SHA256) throw new Error(`SHA-256 do zip não confere: ${sha}`);
  } else console.log(`${ZIP_NOME} já baixado e conferido`);
  for (const nome of ARQUIVOS_TEXTO) {
    const destino = join(DIR_CACHE, nome);
    if (!existsSync(destino)) { console.log(`baixando ${nome}…`); await baixarArquivo(`${BASE_URL}/${nome}`, destino); }
  }
  const dirObj = join(DIR_CACHE, 'obj');
  const jaExtraido = existsSync(join(dirObj, 'FJ1252.obj')) && (await stat(join(dirObj, 'FJ1252.obj'))).size > 0;
  if (!jaExtraido) { const n = await extrairObjs(zip, dirObj); console.log(`extraídos ${n} .obj`); if (n !== 2234) throw new Error(`esperava 2234 .obj, extraiu ${n}`); }
  else console.log('objs já extraídos');
}

if (process.argv[1] && process.argv[1].endsWith('baixar.ts')) {
  baixarTudo().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 5: Rodar os testes**

Run: `pnpm --filter @corpo3d/pipeline test tests/baixar.test.ts`
Expected: `3 passed`

- [ ] **Step 6: Rodar o download de verdade (uma vez, ~2-5 min)**

Run: `pnpm --filter @corpo3d/pipeline baixar`
Expected: última linha `extraídos 2234 .obj`. Depois `ls ~/Projetos/corpo3d/.cache/bp3d/obj | wc -l` → `2234`.

Se a rede cair no meio, rodar de novo: o `.part` é descartado e o SHA protege contra arquivo pela metade.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(pipeline): download do BodyParts3D com checksum e extração dos .obj"
```

---

### Task 3: Catálogo — element_parts + CSV → lista de peças

**Files:**
- Create: `packages/pipeline/src/catalogo.ts`
- Create: `packages/pipeline/tests/fixtures/partof_element_parts.txt`, `packages/pipeline/tests/fixtures/isa_element_parts.txt`, `packages/pipeline/tests/fixtures/estruturas.csv`
- Test: `packages/pipeline/tests/catalogo.test.ts`

- [ ] **Step 1: Fixtures**

`packages/pipeline/tests/fixtures/partof_element_parts.txt` (tabs entre colunas):
```
concept id	name	element file id
FMA1	coracao	FJ10
FMA1	coracao	FJ11
FMA2	mandibula	FJ20
FMA3	cranio	FJ20
FMA3	cranio	FJ30
FMA3	cranio	FJ31
```

`packages/pipeline/tests/fixtures/isa_element_parts.txt`:
```
concept id	name	element file id
FMA4	baco	FJ40
FMA5	cabeca curta	FJ50
FMA6	cabeca longa	FJ51
```

`packages/pipeline/tests/fixtures/estruturas.csv`:
```
fmaId,arvore,fmaIdsExtras,excluirFmaIds,nomeLatim,nomePt,nomeLeigo,sistema,lado,vetorExplosao,razaoSimplificacao
FMA1,partof,,,Cor,Coração,coração,cardiovascular,-,,
FMA3,partof,,FMA2,Cranium,Crânio,"crânio (ossos da cabeça, sem o maxilar)",esqueleto,-,,0.3
FMA4,partof,,,Splen,Baço,baço,linfatico,-,,
FMA5,isa,FMA6,,Musculus biceps brachii,Bíceps braquial direito,bíceps direito,musculos,D,"0,0,1",
```

- [ ] **Step 2: Teste**

`packages/pipeline/tests/catalogo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerElementos, lerCsvEstruturas, resolverPecas } from '../src/catalogo';

const fx = (n: string) => readFileSync(join(__dirname, 'fixtures', n), 'utf8');

describe('catalogo', () => {
  it('lê element_parts em mapa fmaId → conjunto de elementos', () => {
    const m = lerElementos(fx('partof_element_parts.txt'));
    expect([...m.get('FMA1')!]).toEqual(['FJ10', 'FJ11']);
    expect(m.get('FMA3')!.size).toBe(3);
    expect(m.has('concept id')).toBe(false);
  });

  it('lê o CSV respeitando aspas com vírgula', () => {
    const linhas = lerCsvEstruturas(fx('estruturas.csv'));
    expect(linhas).toHaveLength(4);
    expect(linhas[1].nomeLeigo).toBe('crânio (ossos da cabeça, sem o maxilar)');
    expect(linhas[1].razaoSimplificacao).toBe(0.3);
    expect(linhas[0].razaoSimplificacao).toBeUndefined();
    expect(linhas[3].vetorExplosao).toEqual([0, 0, 1]);
  });

  it('resolve união, exclusão e fallback de árvore', () => {
    const pecas = resolverPecas(lerCsvEstruturas(fx('estruturas.csv')), {
      partof: lerElementos(fx('partof_element_parts.txt')),
      isa: lerElementos(fx('isa_element_parts.txt')),
    });
    const por = Object.fromEntries(pecas.map((p) => [p.fmaId, p]));
    expect([...por.FMA1.elementos]).toEqual(['FJ10', 'FJ11']);
    expect([...por.FMA3.elementos].sort()).toEqual(['FJ30', 'FJ31']);        // FJ20 excluído (mandíbula)
    expect([...por.FMA4.elementos]).toEqual(['FJ40']);                        // pedia partof, achou em isa
    expect(por.FMA4.arvoreUsada).toBe('isa');
    expect([...por.FMA5.elementos].sort()).toEqual(['FJ50', 'FJ51']);        // extras
  });

  it('falha alto se um id não existe em nenhuma árvore', () => {
    const csv = lerCsvEstruturas('fmaId,arvore,fmaIdsExtras,excluirFmaIds,nomeLatim,nomePt,nomeLeigo,sistema,lado,vetorExplosao,razaoSimplificacao\nFMA999,partof,,,X,X,x,pele,-,,\n');
    expect(() => resolverPecas(csv, { partof: new Map(), isa: new Map() })).toThrow(/FMA999/);
  });

  it('falha alto se a exclusão esvazia a peça', () => {
    const csv = lerCsvEstruturas('fmaId,arvore,fmaIdsExtras,excluirFmaIds,nomeLatim,nomePt,nomeLeigo,sistema,lado,vetorExplosao,razaoSimplificacao\nFMA2,partof,,FMA2,X,X,x,pele,-,,\n');
    const m = lerElementos(fx('partof_element_parts.txt'));
    expect(() => resolverPecas(csv, { partof: m, isa: new Map() })).toThrow(/sem elementos/);
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

Run: `pnpm --filter @corpo3d/pipeline test tests/catalogo.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 4: Implementar**

`packages/pipeline/src/catalogo.ts`:
```ts
export type Arvore = 'partof' | 'isa';
export type Sistema = 'pele' | 'esqueleto' | 'musculos' | 'cardiovascular' | 'respiratorio' | 'digestivo'
  | 'linfatico' | 'urinario' | 'reprodutor' | 'endocrino' | 'nervoso' | 'olho';
export type Lado = 'D' | 'E' | '-';

export interface LinhaEstrutura {
  fmaId: string; arvore: Arvore; fmaIdsExtras: string[]; excluirFmaIds: string[];
  nomeLatim: string; nomePt: string; nomeLeigo: string; sistema: Sistema; lado: Lado;
  vetorExplosao?: [number, number, number]; razaoSimplificacao?: number;
}
export interface Peca extends LinhaEstrutura { elementos: Set<string>; arvoreUsada: Arvore; }
export type Mapas = Record<Arvore, Map<string, Set<string>>>;

/** `concept id \t name \t element file id`, com cabeçalho. */
export function lerElementos(texto: string): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const linha of texto.split('\n').slice(1)) {
    const c = linha.split('\t');
    if (c.length < 3) continue;
    const [fma, , fj] = c.map((s) => s.trim());
    if (!m.has(fma)) m.set(fma, new Set());
    m.get(fma)!.add(fj);
  }
  return m;
}

function dividirCsv(linha: string): string[] {
  const out: string[] = []; let atual = ''; let aspas = false;
  for (const ch of linha) {
    if (ch === '"') aspas = !aspas;
    else if (ch === ',' && !aspas) { out.push(atual); atual = ''; }
    else atual += ch;
  }
  out.push(atual);
  return out;
}

const SISTEMAS: Sistema[] = ['pele','esqueleto','musculos','cardiovascular','respiratorio','digestivo','linfatico','urinario','reprodutor','endocrino','nervoso','olho'];

export function lerCsvEstruturas(texto: string): LinhaEstrutura[] {
  const linhas = texto.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim());
  const cab = dividirCsv(linhas[0]);
  return linhas.slice(1).map((l, i) => {
    const v = Object.fromEntries(cab.map((k, j) => [k, (dividirCsv(l)[j] ?? '').trim()]));
    const lista = (s: string) => s ? s.split(';').map((x) => x.trim()).filter(Boolean) : [];
    if (!/^FMA\d+$/.test(v.fmaId)) throw new Error(`linha ${i + 2}: fmaId inválido "${v.fmaId}"`);
    if (v.arvore !== 'partof' && v.arvore !== 'isa') throw new Error(`linha ${i + 2}: arvore inválida "${v.arvore}"`);
    if (!SISTEMAS.includes(v.sistema as Sistema)) throw new Error(`linha ${i + 2}: sistema inválido "${v.sistema}"`);
    if (!['D', 'E', '-'].includes(v.lado)) throw new Error(`linha ${i + 2}: lado inválido "${v.lado}"`);
    const vetor = v.vetorExplosao ? v.vetorExplosao.split(',').map(Number) : undefined;
    if (vetor && (vetor.length !== 3 || vetor.some(Number.isNaN))) throw new Error(`linha ${i + 2}: vetorExplosao inválido`);
    const razao = v.razaoSimplificacao ? Number(v.razaoSimplificacao) : undefined;
    if (razao !== undefined && !(razao > 0 && razao <= 1)) throw new Error(`linha ${i + 2}: razaoSimplificacao fora de (0,1]`);
    return {
      fmaId: v.fmaId, arvore: v.arvore as Arvore, fmaIdsExtras: lista(v.fmaIdsExtras), excluirFmaIds: lista(v.excluirFmaIds),
      nomeLatim: v.nomeLatim, nomePt: v.nomePt, nomeLeigo: v.nomeLeigo, sistema: v.sistema as Sistema, lado: v.lado as Lado,
      vetorExplosao: vetor as [number, number, number] | undefined, razaoSimplificacao: razao,
    };
  });
}

function elementosDe(id: string, preferida: Arvore, mapas: Mapas): { elementos: Set<string>; arvore: Arvore } | undefined {
  const outra: Arvore = preferida === 'partof' ? 'isa' : 'partof';
  if (mapas[preferida].has(id)) return { elementos: mapas[preferida].get(id)!, arvore: preferida };
  if (mapas[outra].has(id)) return { elementos: mapas[outra].get(id)!, arvore: outra };
  return undefined;
}

export function resolverPecas(linhas: LinhaEstrutura[], mapas: Mapas): Peca[] {
  return linhas.map((l) => {
    const principal = elementosDe(l.fmaId, l.arvore, mapas);
    if (!principal) throw new Error(`${l.fmaId} (${l.nomePt}): não existe em nenhuma árvore`);
    const elementos = new Set(principal.elementos);
    for (const extra of l.fmaIdsExtras) {
      const e = elementosDe(extra, principal.arvore, mapas);
      if (!e) throw new Error(`${l.fmaId} (${l.nomePt}): extra ${extra} não existe em nenhuma árvore`);
      for (const fj of e.elementos) elementos.add(fj);
    }
    for (const exc of l.excluirFmaIds) {
      const e = elementosDe(exc, principal.arvore, mapas);
      if (!e) throw new Error(`${l.fmaId} (${l.nomePt}): exclusão ${exc} não existe em nenhuma árvore`);
      for (const fj of e.elementos) elementos.delete(fj);
    }
    if (elementos.size === 0) throw new Error(`${l.fmaId} (${l.nomePt}): sem elementos após exclusões`);
    return { ...l, elementos, arvoreUsada: principal.arvore };
  });
}
```

- [ ] **Step 5: Rodar os testes**

Run: `pnpm --filter @corpo3d/pipeline test tests/catalogo.test.ts`
Expected: `5 passed`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(pipeline): catálogo — element_parts + CSV → peças com união, exclusão e fallback"
```

---

### Task 4: Parser OBJ com conversão de eixos e merge

**Files:**
- Create: `packages/pipeline/src/obj.ts`
- Create: `packages/pipeline/tests/fixtures/tri.obj`, `packages/pipeline/tests/fixtures/quad.obj`
- Test: `packages/pipeline/tests/obj.test.ts`

- [ ] **Step 1: Fixtures**

`packages/pipeline/tests/fixtures/tri.obj` (um triângulo em mm, Z para cima):
```
# comentario
v 0 0 0
v 1000 0 0
v 0 0 1000
vn 0 -1 0
vn 0 -1 0
vn 0 -1 0
f 1//1 2//2 3//3
```

`packages/pipeline/tests/fixtures/quad.obj` (um quadrado, para provar a triangulação em leque):
```
v 0 0 0
v 1000 0 0
v 1000 0 1000
v 0 0 1000
f 1 2 3 4
```

- [ ] **Step 2: Teste**

`packages/pipeline/tests/obj.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseObj, Geometria, novaGeometria } from '../src/obj';

const fx = (n: string) => readFileSync(join(__dirname, 'fixtures', n), 'utf8');

describe('obj', () => {
  it('converte mm Z-up para m Y-up: (x,y,z) → (x/1000, z/1000, -y/1000)', () => {
    const g = novaGeometria();
    parseObj(fx('tri.obj'), g);
    expect(Array.from(g.posicoes)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);   // v3 (0,0,1000) → (0,1,0)
    expect(Array.from(g.indices)).toEqual([0, 1, 2]);
  });

  it('triangula quads em leque', () => {
    const g = novaGeometria();
    parseObj(fx('quad.obj'), g);
    expect(Array.from(g.indices)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('faz merge com deslocamento de índices', () => {
    const g = novaGeometria();
    parseObj(fx('tri.obj'), g);
    parseObj(fx('tri.obj'), g);
    expect(g.posicoes.length).toBe(18);
    expect(Array.from(g.indices)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('ignora vn, vt e comentários; preserva o sinal de y', () => {
    const g = novaGeometria();
    parseObj('v 10 -20 30\nvt 0 0\nvn 0 0 1\n# x\nf 1 1 1\n', g);
    expect(Array.from(g.posicoes)).toEqual([0.01, 0.03, 0.02]);
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

Run: `pnpm --filter @corpo3d/pipeline test tests/obj.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 4: Implementar**

`packages/pipeline/src/obj.ts`:
```ts
import { MM_PARA_M } from './constantes';

/** Geometria acumulada (vários OBJ podem ser concatenados na mesma instância). */
export interface Geometria { posicoes: number[]; indices: number[]; }
export const novaGeometria = (): Geometria => ({ posicoes: [], indices: [] });

/**
 * Lê só `v` e `f`. Converte mm Z-up (BodyParts3D) para m Y-up (three.js):
 * (x, y, z) → (x·0,001, z·0,001, −y·0,001). Faces com n>3 vértices viram leque.
 * Índices OBJ começam em 1 e podem vir como `a`, `a/b`, `a//c` ou `a/b/c`.
 */
export function parseObj(texto: string, g: Geometria): void {
  const base = g.posicoes.length / 3;
  for (const linha of texto.split('\n')) {
    if (linha.startsWith('v ')) {
      const [, x, y, z] = linha.trim().split(/\s+/);
      g.posicoes.push(+x * MM_PARA_M, +z * MM_PARA_M, -(+y) * MM_PARA_M);
    } else if (linha.startsWith('f ')) {
      const v = linha.trim().split(/\s+/).slice(1).map((t) => base + parseInt(t.split('/')[0], 10) - 1);
      for (let i = 1; i + 1 < v.length; i++) g.indices.push(v[0], v[i], v[i + 1]);
    }
  }
}
```

- [ ] **Step 5: Rodar os testes**

Run: `pnpm --filter @corpo3d/pipeline test tests/obj.test.ts`
Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(pipeline): parser OBJ mínimo com conversão de eixos e merge"
```

---

### Task 5: Normais suaves ponderadas por área

**Files:**
- Create: `packages/pipeline/src/normais.ts`
- Test: `packages/pipeline/tests/normais.test.ts`

- [ ] **Step 1: Teste**

`packages/pipeline/tests/normais.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normaisSuaves } from '../src/normais';

describe('normaisSuaves', () => {
  it('triângulo no plano XY com ordem anti-horária aponta para +Z', () => {
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const n = normaisSuaves(pos, new Uint32Array([0, 1, 2]));
    for (let i = 0; i < 3; i++) expect([n[i * 3], n[i * 3 + 1], n[i * 3 + 2]]).toEqual([0, 0, 1]);
  });

  it('vértice compartilhado por duas faces perpendiculares recebe a média normalizada', () => {
    // face A no plano XY (normal +Z), face B (0,3,1) no plano XZ (normal +Y); vértices 0 e 1 são comuns
    const pos = new Float32Array([0, 0, 0,  1, 0, 0,  0, 1, 0,  0, 0, 1]);
    const n = normaisSuaves(pos, new Uint32Array([0, 1, 2,  0, 3, 1]));
    const s = Math.SQRT1_2;
    expect(n[0]).toBeCloseTo(0); expect(n[1]).toBeCloseTo(s); expect(n[2]).toBeCloseTo(s);
    expect(n[6]).toBeCloseTo(0); expect(n[7]).toBeCloseTo(0); expect(n[8]).toBeCloseTo(1);   // vértice 2 só na face A
  });

  it('vértice sem face fica com normal zero (não NaN)', () => {
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 5]);
    const n = normaisSuaves(pos, new Uint32Array([0, 1, 2]));
    expect([n[9], n[10], n[11]]).toEqual([0, 0, 0]);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm --filter @corpo3d/pipeline test tests/normais.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar**

`packages/pipeline/src/normais.ts`:
```ts
/**
 * Normais por vértice: soma do produto vetorial de cada face incidente (o módulo é 2× a
 * área, logo faces maiores pesam mais) e normalização no fim. Vértice órfão fica (0,0,0).
 */
export function normaisSuaves(pos: ArrayLike<number>, idx: ArrayLike<number>): Float32Array {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { n[i] += nx; n[i + 1] += ny; n[i + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]);
    if (l > 0) { n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  }
  return n;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `pnpm --filter @corpo3d/pipeline test tests/normais.test.ts`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): normais suaves ponderadas por área"
```

---

### Task 6: Geometria → GLB comprimido, com estatísticas

**Files:**
- Create: `packages/pipeline/src/glb.ts`
- Test: `packages/pipeline/tests/glb.test.ts`

- [ ] **Step 1: Teste**

`packages/pipeline/tests/glb.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { escreverGlb } from '../src/glb';

// cubo de 1 m centrado em (2, 3, 4): 8 vértices, 12 triângulos
function cubo() {
  const c = [2, 3, 4], h = 0.5, p: number[] = [];
  for (const dz of [-h, h]) for (const dy of [-h, h]) for (const dx of [-h, h]) p.push(c[0] + dx, c[1] + dy, c[2] + dz);
  const f = [0,1,3, 0,3,2, 4,6,7, 4,7,5, 0,4,5, 0,5,1, 2,3,7, 2,7,6, 0,2,6, 0,6,4, 1,5,7, 1,7,3];
  return { posicoes: p, indices: f };
}

describe('escreverGlb', () => {
  it('escreve um GLB legível com NORMAL e índices, e devolve bbox/centro antes da quantização', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'glb-'));
    const saida = join(dir, 'cubo.glb');
    const st = await escreverGlb(cubo(), saida, { razao: 1, nome: 'FMA0' });
    expect(existsSync(saida)).toBe(true);
    expect(st.bytes).toBe(statSync(saida).size);
    expect(st.triangulosAntes).toBe(12);
    expect(st.triangulosDepois).toBeGreaterThan(0);
    expect(st.bbox.min.map((v) => +v.toFixed(3))).toEqual([1.5, 2.5, 3.5]);
    expect(st.bbox.max.map((v) => +v.toFixed(3))).toEqual([2.5, 3.5, 4.5]);
    expect(st.centro.map((v) => +v.toFixed(3))).toEqual([2, 3, 4]);

    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const doc = await io.read(saida);
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    expect(prim.getAttribute('NORMAL')).not.toBeNull();
    expect(prim.getIndices()).not.toBeNull();
    expect(doc.getRoot().listMeshes()[0].getName()).toBe('FMA0');
  });

  it('rejeita geometria vazia', async () => {
    await expect(escreverGlb({ posicoes: [], indices: [] }, '/tmp/x.glb', { razao: 1, nome: 'X' })).rejects.toThrow(/vazia/);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm --filter @corpo3d/pipeline test tests/glb.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar**

`packages/pipeline/src/glb.ts`:
```ts
import { mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { ERRO_SIMPLIFICACAO } from './constantes';
import { normaisSuaves } from './normais';
import type { Geometria } from './obj';

export interface Bbox { min: [number, number, number]; max: [number, number, number]; }
export interface EstatisticasGlb {
  bytes: number; triangulosAntes: number; triangulosDepois: number; bbox: Bbox; centro: [number, number, number];
}

let io: NodeIO | undefined;
async function getIo(): Promise<NodeIO> {
  await MeshoptSimplifier.ready; await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  io ??= new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  return io;
}

export function bboxDe(pos: ArrayLike<number>): Bbox {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
    if (pos[i + k] < min[k]) min[k] = pos[i + k];
    if (pos[i + k] > max[k]) max[k] = pos[i + k];
  }
  return { min, max };
}

/**
 * weld → simplify (meshoptimizer) → normais suaves próprias → prune → meshopt (quantiza e
 * comprime). bbox/centro vêm da geometria float, antes da quantização.
 */
export async function escreverGlb(g: Geometria, saida: string, op: { razao: number; nome: string }): Promise<EstatisticasGlb> {
  if (g.posicoes.length === 0 || g.indices.length === 0) throw new Error(`geometria vazia para ${op.nome}`);
  const bbox = bboxDe(g.posicoes);
  const centro: [number, number, number] = [0, 1, 2].map((k) => (bbox.min[k] + bbox.max[k]) / 2) as [number, number, number];

  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.posicoes)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.indices)).setBuffer(buffer));
  doc.createScene().addChild(doc.createNode(op.nome).setMesh(doc.createMesh(op.nome).addPrimitive(prim)));

  const nodeIo = await getIo();
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: op.razao, error: ERRO_SIMPLIFICACAO }));
  const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const pos = p.getAttribute('POSITION')!.getArray()!;
  const idx = p.getIndices()!.getArray()!;
  p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normaisSuaves(pos, idx)).setBuffer(buffer));
  const triangulosDepois = idx.length / 3;
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder }));

  mkdirSync(dirname(saida), { recursive: true });
  await nodeIo.write(saida, doc);
  return { bytes: statSync(saida).size, triangulosAntes: g.indices.length / 3, triangulosDepois, bbox, centro };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `pnpm --filter @corpo3d/pipeline test tests/glb.test.ts`
Expected: `2 passed` (o `prune` imprime um log; é normal)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): geometria → GLB meshopt com bbox antes da quantização"
```

---

### Task 7: Manifesto, vetor de explosão e o construtor

**Files:**
- Create: `packages/pipeline/src/manifesto.ts`
- Create: `packages/pipeline/src/construir.ts`
- Create: `packages/pipeline/tests/fixtures/obj/FJ10.obj`, `FJ11.obj`, `FJ20.obj`, `FJ30.obj`, `FJ31.obj`, `FJ40.obj`, `FJ50.obj`, `FJ51.obj`
- Test: `packages/pipeline/tests/construir.test.ts`

- [ ] **Step 1: Fixtures OBJ (todos cubos pequenos em posições diferentes, em mm)**

Criar com um script único (rodar uma vez, commitar a saída):
```bash
cd packages/pipeline/tests/fixtures && mkdir -p obj && node -e '
const fs=require("fs");
const cubo=(cx,cy,cz)=>{const h=50,v=[];for(const dz of[-h,h])for(const dy of[-h,h])for(const dx of[-h,h])v.push(`v ${cx+dx} ${cy+dy} ${cz+dz}`);
const f=[[1,2,4],[1,4,3],[5,7,8],[5,8,6],[1,5,6],[1,6,2],[3,4,8],[3,8,7],[1,3,7],[1,7,5],[2,6,8],[2,8,4]].map(t=>"f "+t.map(i=>`${i}//${i}`).join(" "));
return v.concat(f).join("\n")+"\n";};
const pos={FJ10:[0,-100,1200],FJ11:[60,-100,1200],FJ20:[0,-80,1500],FJ30:[0,-60,1600],FJ31:[0,-20,1650],FJ40:[100,-100,1100],FJ50:[-200,-80,1250],FJ51:[-200,-60,1300]};
for(const [k,[x,y,z]] of Object.entries(pos)) fs.writeFileSync(`obj/${k}.obj`,cubo(x,y,z));'
ls obj
```
Expected: 8 arquivos `FJ*.obj`.

- [ ] **Step 2: Teste do construtor (roda o pipeline inteiro sobre as fixtures)**

`packages/pipeline/tests/construir.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { construir } from '../src/construir';
import { vetorExplosaoPadrao } from '../src/manifesto';

const FX = join(__dirname, 'fixtures');

describe('construir', () => {
  it('gera um GLB por peça e um manifest.json coerente', async () => {
    const saida = mkdtempSync(join(tmpdir(), 'models-'));
    const manifesto = await construir({
      csv: join(FX, 'estruturas.csv'),
      elementParts: { partof: join(FX, 'partof_element_parts.txt'), isa: join(FX, 'isa_element_parts.txt') },
      dirObj: join(FX, 'obj'),
      dirSaida: saida,
    });
    expect(manifesto.versao).toBe(1);
    expect(manifesto.pecas).toHaveLength(4);
    const coracao = manifesto.pecas.find((p) => p.fmaId === 'FMA1')!;
    expect(coracao.glb).toBe('cardiovascular/FMA1.glb');
    expect(existsSync(join(saida, coracao.glb))).toBe(true);
    expect(coracao.sistema).toBe('cardiovascular');
    expect(coracao.nomePt).toBe('Coração');
    expect(coracao.bytes).toBeGreaterThan(0);
    expect(coracao.centro[1]).toBeCloseTo(1.2, 2);                      // z=1200 mm → y=1,2 m
    const cranio = manifesto.pecas.find((p) => p.fmaId === 'FMA3')!;
    expect(cranio.elementos).toBe(2);                                    // FJ20 excluído
    const biceps = manifesto.pecas.find((p) => p.fmaId === 'FMA5')!;
    expect(biceps.vetorExplosao).toEqual([0, 0, 1]);                     // veio do CSV
    expect(coracao.vetorExplosao.length).toBe(3);                        // calculado
    const lido = JSON.parse(readFileSync(join(saida, 'manifest.json'), 'utf8'));
    expect(lido.pecas.map((p: { fmaId: string }) => p.fmaId)).toEqual(['FMA1', 'FMA3', 'FMA4', 'FMA5']);
    expect(lido.bytesTotal).toBe(manifesto.pecas.reduce((a, p) => a + p.bytes, 0));
  });
});

describe('vetorExplosaoPadrao', () => {
  it('aponta do eixo do corpo para o centro da peça, com peso por sistema, e é unitário × peso', () => {
    const v = vetorExplosaoPadrao([0.3, 1.2, -0.1], 'musculos');   // eixo do corpo em (0, y, 0)
    const len = Math.hypot(...v);
    expect(len).toBeCloseTo(1.2, 5);                                  // peso de músculos
    expect(v[0]).toBeGreaterThan(0); expect(v[2]).toBeLessThan(0); expect(v[1]).toBeCloseTo(0, 5);
  });
  it('peça no eixo (mediana) sai para a frente', () => {
    expect(vetorExplosaoPadrao([0, 1.0, 0], 'esqueleto')).toEqual([0, 0, 0.6]);
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

Run: `pnpm --filter @corpo3d/pipeline test tests/construir.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 4: Implementar o manifesto**

`packages/pipeline/src/manifesto.ts`:
```ts
import type { Lado, Sistema } from './catalogo';
import type { Bbox } from './glb';

export interface PecaManifesto {
  fmaId: string; nomeLatim: string; nomePt: string; nomeLeigo: string; sistema: Sistema; lado: Lado;
  glb: string; bytes: number; triangulos: number; elementos: number;
  bbox: Bbox; centro: [number, number, number]; vetorExplosao: [number, number, number];
}
export interface Manifesto {
  versao: 1; geradoEm: string; fonte: string; bytesTotal: number;
  sistemas: Sistema[]; pecas: PecaManifesto[];
}

/** Peso do deslocamento na vista explodida, por sistema (spec §4.1). */
export const PESO_EXPLOSAO: Record<Sistema, number> = {
  pele: 1.4, esqueleto: 0.6, musculos: 1.2, cardiovascular: 1.0, respiratorio: 1.0, digestivo: 1.0,
  linfatico: 1.0, urinario: 1.0, reprodutor: 1.0, endocrino: 1.0, nervoso: 0.8, olho: 1.0,
};

/**
 * Vetor do eixo vertical do corpo (x=0, z=0) até o centro da peça, no plano horizontal,
 * normalizado e multiplicado pelo peso do sistema. Peça sobre o eixo sai para a frente (+z).
 */
export function vetorExplosaoPadrao(centro: [number, number, number], sistema: Sistema): [number, number, number] {
  const [x, , z] = centro;
  const len = Math.hypot(x, z);
  const peso = PESO_EXPLOSAO[sistema];
  if (len < 1e-6) return [0, 0, peso];
  return [(x / len) * peso, 0, (z / len) * peso];
}

export const FONTE = 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International';
```

- [ ] **Step 5: Implementar o construtor**

`packages/pipeline/src/construir.ts`:
```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CSV_ESTRUTURAS, DIR_CACHE, DIR_SAIDA, RAZAO_PADRAO } from './constantes';
import { lerCsvEstruturas, lerElementos, resolverPecas, type Sistema } from './catalogo';
import { escreverGlb } from './glb';
import { novaGeometria, parseObj } from './obj';
import { FONTE, vetorExplosaoPadrao, type Manifesto, type PecaManifesto } from './manifesto';

export interface OpcoesConstruir {
  csv: string; elementParts: { partof: string; isa: string }; dirObj: string; dirSaida: string;
  log?: (m: string) => void;
}

export async function construir(op: OpcoesConstruir): Promise<Manifesto> {
  const log = op.log ?? (() => {});
  const pecas = resolverPecas(lerCsvEstruturas(readFileSync(op.csv, 'utf8')), {
    partof: lerElementos(readFileSync(op.elementParts.partof, 'utf8')),
    isa: lerElementos(readFileSync(op.elementParts.isa, 'utf8')),
  });
  mkdirSync(op.dirSaida, { recursive: true });
  const saida: PecaManifesto[] = [];
  for (const [i, p] of pecas.entries()) {
    const g = novaGeometria();
    for (const fj of p.elementos) parseObj(readFileSync(join(op.dirObj, `${fj}.obj`), 'utf8'), g);
    const glb = `${p.sistema}/${p.fmaId}.glb`;
    const st = await escreverGlb(g, join(op.dirSaida, glb), { razao: p.razaoSimplificacao ?? RAZAO_PADRAO[p.sistema], nome: p.fmaId });
    saida.push({
      fmaId: p.fmaId, nomeLatim: p.nomeLatim, nomePt: p.nomePt, nomeLeigo: p.nomeLeigo, sistema: p.sistema, lado: p.lado,
      glb, bytes: st.bytes, triangulos: st.triangulosDepois, elementos: p.elementos.size,
      bbox: st.bbox, centro: st.centro, vetorExplosao: p.vetorExplosao ?? vetorExplosaoPadrao(st.centro, p.sistema),
    });
    log(`[${i + 1}/${pecas.length}] ${p.nomePt}: ${p.elementos.size} el, ${st.triangulosAntes}→${st.triangulosDepois} tri, ${(st.bytes / 1024).toFixed(0)} KB`);
  }
  const sistemas = [...new Set(saida.map((p) => p.sistema))] as Sistema[];
  const manifesto: Manifesto = {
    versao: 1, geradoEm: new Date().toISOString(), fonte: FONTE,
    bytesTotal: saida.reduce((a, p) => a + p.bytes, 0), sistemas, pecas: saida,
  };
  writeFileSync(join(op.dirSaida, 'manifest.json'), JSON.stringify(manifesto, null, 1));
  return manifesto;
}

if (process.argv[1] && process.argv[1].endsWith('construir.ts')) {
  construir({
    csv: CSV_ESTRUTURAS,
    elementParts: { partof: join(DIR_CACHE, 'partof_element_parts.txt'), isa: join(DIR_CACHE, 'isa_element_parts.txt') },
    dirObj: join(DIR_CACHE, 'obj'), dirSaida: DIR_SAIDA, log: console.log,
  }).then((m) => console.log(`\n${m.pecas.length} peças, ${(m.bytesTotal / 1048576).toFixed(1)} MB`))
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 6: Rodar os testes**

Run: `pnpm --filter @corpo3d/pipeline test tests/construir.test.ts`
Expected: `3 passed`

- [ ] **Step 7: Rodar o pipeline real (~3-6 min)**

Run: `pnpm --filter @corpo3d/pipeline construir 2>&1 | grep -v '^prune\|^reorder\|^simplify\|^weld' | tail -5`
Expected: última linha `251 peças, 8.x MB` (o ensaio deu 8,9 MB antes das razões novas de crânio e intercostais; pode dar ~8,3). `ls apps/web/public/models` mostra 12 pastas de sistema + `manifest.json`.

- [ ] **Step 8: Commit (os GLBs NÃO entram: `apps/web/public/models/` está no .gitignore)**

```bash
git add -A && git commit -m "feat(pipeline): manifesto com vetor de explosão + construtor de ponta a ponta"
```

---

### Task 8: Portão de orçamento sobre o manifesto real

**Files:**
- Create: `packages/pipeline/src/portao.ts`
- Test: `packages/pipeline/tests/portao.test.ts`

- [ ] **Step 1: Teste da função pura de verificação**

`packages/pipeline/tests/portao.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { verificarOrcamento } from '../src/portao';
import type { Manifesto } from '../src/manifesto';

const base = (pecas: Array<{ fmaId: string; bytes: number; glb?: string }>): Manifesto => ({
  versao: 1, geradoEm: '', fonte: '', sistemas: ['pele'],
  bytesTotal: pecas.reduce((a, p) => a + p.bytes, 0),
  pecas: pecas.map((p) => ({ fmaId: p.fmaId, nomeLatim: '', nomePt: p.fmaId, nomeLeigo: '', sistema: 'pele', lado: '-',
    glb: p.glb ?? `pele/${p.fmaId}.glb`, bytes: p.bytes, triangulos: 1, elementos: 1,
    bbox: { min: [0, 0, 0], max: [1, 1, 1] }, centro: [0.5, 0.5, 0.5], vetorExplosao: [0, 0, 1] })),
});

describe('verificarOrcamento', () => {
  it('passa quando todos os ids do CSV existem, ninguém estoura e o total cabe', () => {
    const r = verificarOrcamento(base([{ fmaId: 'FMA1', bytes: 1000 }]), ['FMA1'], { porPeca: 2000, total: 5000 });
    expect(r.ok).toBe(true); expect(r.problemas).toEqual([]);
  });
  it('acusa peça acima do orçamento, total estourado, id faltando e id sobrando', () => {
    const r = verificarOrcamento(base([{ fmaId: 'FMA1', bytes: 3000 }, { fmaId: 'FMA9', bytes: 3000 }]), ['FMA1', 'FMA2'], { porPeca: 2000, total: 5000 });
    expect(r.ok).toBe(false);
    expect(r.problemas.join('\n')).toMatch(/FMA1 .*3000/);
    expect(r.problemas.join('\n')).toMatch(/total/);
    expect(r.problemas.join('\n')).toMatch(/FMA2.*sem GLB/);
    expect(r.problemas.join('\n')).toMatch(/FMA9.*não está no CSV/);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm --filter @corpo3d/pipeline test tests/portao.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar**

`packages/pipeline/src/portao.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSV_ESTRUTURAS, DIR_SAIDA, ORCAMENTO_BYTES_POR_PECA, ORCAMENTO_BYTES_TOTAL } from './constantes';
import { lerCsvEstruturas } from './catalogo';
import type { Manifesto } from './manifesto';

export function verificarOrcamento(m: Manifesto, idsCsv: string[], orc: { porPeca: number; total: number }): { ok: boolean; problemas: string[] } {
  const problemas: string[] = [];
  const noManifesto = new Set(m.pecas.map((p) => p.fmaId));
  for (const id of idsCsv) if (!noManifesto.has(id)) problemas.push(`${id}: está no CSV mas sem GLB no manifesto`);
  const noCsv = new Set(idsCsv);
  for (const p of m.pecas) {
    if (!noCsv.has(p.fmaId)) problemas.push(`${p.fmaId}: no manifesto mas não está no CSV`);
    if (p.bytes > orc.porPeca) problemas.push(`${p.fmaId} ${p.nomePt}: ${p.bytes} bytes > orçamento ${orc.porPeca}`);
  }
  if (m.bytesTotal > orc.total) problemas.push(`total ${m.bytesTotal} bytes > orçamento ${orc.total}`);
  return { ok: problemas.length === 0, problemas };
}

if (process.argv[1] && process.argv[1].endsWith('portao.ts')) {
  const caminho = join(DIR_SAIDA, 'manifest.json');
  if (!existsSync(caminho)) { console.error(`sem ${caminho}; rode "pnpm --filter @corpo3d/pipeline construir"`); process.exit(2); }
  const m: Manifesto = JSON.parse(readFileSync(caminho, 'utf8'));
  const ids = lerCsvEstruturas(readFileSync(CSV_ESTRUTURAS, 'utf8')).map((l) => l.fmaId);
  const faltandoNoDisco = m.pecas.filter((p) => !existsSync(join(DIR_SAIDA, p.glb))).map((p) => `${p.fmaId}: ${p.glb} não existe no disco`);
  const r = verificarOrcamento(m, ids, { porPeca: ORCAMENTO_BYTES_POR_PECA, total: ORCAMENTO_BYTES_TOTAL });
  const problemas = [...r.problemas, ...faltandoNoDisco];
  console.log(`${m.pecas.length} peças, ${(m.bytesTotal / 1048576).toFixed(2)} MB, ${problemas.length} problema(s)`);
  for (const p of problemas) console.log(' - ' + p);
  process.exit(problemas.length ? 1 : 0);
}
```

- [ ] **Step 4: Rodar os testes e o portão real**

Run: `pnpm --filter @corpo3d/pipeline test tests/portao.test.ts && pnpm --filter @corpo3d/pipeline portao`
Expected: `2 passed`, depois `251 peças, 8.xx MB, 0 problema(s)` e exit 0. Se aparecer peça > 500 KB, ajustar `razaoSimplificacao` dessa linha no CSV, reconstruir e repetir.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): portão de orçamento (CSV ↔ manifesto ↔ disco)"
```

---

### Task 9: App Next 16 com visualizador mínimo

**Files:**
- Create: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/next-env.d.ts` (gerado)
- Create: `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`
- Create: `apps/web/src/lib/manifesto.ts`, `apps/web/src/lib/materiais/index.ts`
- Create: `apps/web/src/components/viewer/Cena.tsx`, `apps/web/src/components/viewer/Peca.tsx`

- [ ] **Step 1: Pacote**

`apps/web/package.json`:
```json
{
  "name": "@corpo3d/web",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3020",
    "build": "next build",
    "start": "next start -p 3020",
    "typecheck": "tsc --noEmit",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@react-three/drei": "10.7.8",
    "@react-three/fiber": "9.7.0",
    "meshoptimizer": "1.2.0",
    "next": "16.3.3",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "three": "0.186.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/three": "^0.186.0",
    "typescript": "^5"
  }
}
```

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['three'],
  async headers() {
    return [{ source: '/models/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
  },
};
export default config;
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "isolatedModules": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "e2e"]
}
```

- [ ] **Step 2: Tipo do manifesto e loader**

`apps/web/src/lib/manifesto.ts`:
```ts
export type Sistema = 'pele' | 'esqueleto' | 'musculos' | 'cardiovascular' | 'respiratorio' | 'digestivo'
  | 'linfatico' | 'urinario' | 'reprodutor' | 'endocrino' | 'nervoso' | 'olho';

export interface PecaManifesto {
  fmaId: string; nomeLatim: string; nomePt: string; nomeLeigo: string; sistema: Sistema; lado: 'D' | 'E' | '-';
  glb: string; bytes: number; triangulos: number; elementos: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  centro: [number, number, number]; vetorExplosao: [number, number, number];
}
export interface Manifesto {
  versao: 1; geradoEm: string; fonte: string; bytesTotal: number; sistemas: Sistema[]; pecas: PecaManifesto[];
}

export async function carregarManifesto(): Promise<Manifesto> {
  const res = await fetch('/models/manifest.json', { cache: 'force-cache' });
  if (!res.ok) throw new Error(`manifest.json: HTTP ${res.status}`);
  const m = (await res.json()) as Manifesto;
  if (m.versao !== 1 || !Array.isArray(m.pecas)) throw new Error('manifest.json em formato inesperado');
  return m;
}

export const ROTULO_SISTEMA: Record<Sistema, string> = {
  pele: 'Pele', esqueleto: 'Esqueleto', musculos: 'Músculos', cardiovascular: 'Coração e vasos',
  respiratorio: 'Respiratório', digestivo: 'Digestivo', linfatico: 'Linfático', urinario: 'Urinário',
  reprodutor: 'Reprodutor', endocrino: 'Glândulas', nervoso: 'Nervoso', olho: 'Olho',
};
```

- [ ] **Step 3: Materiais por sistema (o realismo mora aqui; spec §4.2)**

`apps/web/src/lib/materiais/index.ts`:
```ts
import { MeshPhysicalMaterial, Color, DoubleSide } from 'three';
import type { Sistema } from '../manifesto';

interface Receita {
  cor: string; roughness: number; metalness?: number; clearcoat?: number; clearcoatRoughness?: number;
  sheen?: number; sheenColor?: string; transmission?: number; ior?: number; opacity?: number;
}

/** Uma receita por sistema. Cores em sRGB. Sem texturas: tudo procedural. */
export const RECEITAS: Record<Sistema, Receita> = {
  pele:           { cor: '#d9a68b', roughness: 0.55, sheen: 0.4, sheenColor: '#f2c9b0' },
  esqueleto:      { cor: '#e8dcc4', roughness: 0.75 },
  musculos:       { cor: '#9b2f2f', roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.5 },
  cardiovascular: { cor: '#b3312e', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 },
  respiratorio:   { cor: '#d98c8c', roughness: 0.6, clearcoat: 0.2 },
  digestivo:      { cor: '#c4776b', roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.35 },
  linfatico:      { cor: '#8b4a5c', roughness: 0.45, clearcoat: 0.4 },
  urinario:       { cor: '#a65a4f', roughness: 0.4, clearcoat: 0.5 },
  reprodutor:     { cor: '#c78f86', roughness: 0.5, clearcoat: 0.3 },
  endocrino:      { cor: '#d9a066', roughness: 0.5, clearcoat: 0.3 },
  nervoso:        { cor: '#e6cfc2', roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4 },
  olho:           { cor: '#f0ece6', roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.1 },
};

/** Cor semântica para artérias × veias, sobrepondo a receita do sistema quando o nome diz. */
export function corPorNome(sistema: Sistema, nomeLatim: string): string {
  if (sistema !== 'cardiovascular') return RECEITAS[sistema].cor;
  if (/^Vena|Venae/.test(nomeLatim)) return '#3f5fa8';
  if (/^Arteria|Truncus|Circulus|Aorta/.test(nomeLatim)) return '#c4322d';
  return RECEITAS.cardiovascular.cor;
}

const cache = new Map<string, MeshPhysicalMaterial>();

export function materialPara(sistema: Sistema, nomeLatim: string): MeshPhysicalMaterial {
  const cor = corPorNome(sistema, nomeLatim);
  const chave = `${sistema}:${cor}`;
  const existente = cache.get(chave);
  if (existente) return existente;
  const r = RECEITAS[sistema];
  const m = new MeshPhysicalMaterial({
    color: new Color(cor), roughness: r.roughness, metalness: r.metalness ?? 0,
    clearcoat: r.clearcoat ?? 0, clearcoatRoughness: r.clearcoatRoughness ?? 0.3,
    sheen: r.sheen ?? 0, sheenColor: r.sheenColor ? new Color(r.sheenColor) : undefined,
    transmission: r.transmission ?? 0, ior: r.ior ?? 1.45,
    transparent: (r.opacity ?? 1) < 1, opacity: r.opacity ?? 1, side: DoubleSide,
  });
  cache.set(chave, m);
  return m;
}
```

- [ ] **Step 4: Componentes do visualizador**

`apps/web/src/components/viewer/Peca.tsx`:
```tsx
'use client';
import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Mesh } from 'three';
import { MeshoptDecoder } from 'meshoptimizer';
import { materialPara } from '@/lib/materiais';
import type { PecaManifesto } from '@/lib/manifesto';

useGLTF.setMeshoptDecoder(MeshoptDecoder);

export function Peca({ peca }: { peca: PecaManifesto }) {
  const { scene } = useGLTF(`/models/${peca.glb}`);
  const invalidate = useThree((s) => s.invalidate);
  const material = useMemo(() => materialPara(peca.sistema, peca.nomeLatim), [peca.sistema, peca.nomeLatim]);
  const objeto = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => { if (o instanceof Mesh) o.material = material; });
    clone.name = peca.fmaId;
    return clone;
  }, [scene, material, peca.fmaId]);
  useEffect(() => { invalidate(); }, [objeto, invalidate]);
  return <primitive object={objeto} />;
}
```

`apps/web/src/components/viewer/Cena.tsx`:
```tsx
'use client';
import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { carregarManifesto, type Manifesto } from '@/lib/manifesto';
import { Peca } from './Peca';

export function Cena() {
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { carregarManifesto().then(setManifesto).catch((e: Error) => setErro(e.message)); }, []);

  if (erro) return <p role="alert" data-testid="erro">Não foi possível carregar os modelos: {erro}</p>;
  if (!manifesto) return <p data-testid="carregando">Carregando manifesto…</p>;

  return (
    <div data-testid="cena" data-pecas={manifesto.pecas.length} style={{ position: 'absolute', inset: 0 }}>
      <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 1.0, 2.6], fov: 40, near: 0.01, far: 20 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#101214']} />
        <Environment preset="studio" />
        <Suspense fallback={null}>
          {manifesto.pecas.map((p) => <Peca key={p.fmaId} peca={p} />)}
        </Suspense>
        <OrbitControls target={[0, 0.85, 0]} makeDefault enableDamping={false} />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 5: Páginas**

`apps/web/src/app/globals.css`:
```css
:root { color-scheme: dark; --bg: #101214; --fg: #e9e6e1; --muted: #9a958e; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; }
main { position: relative; height: 100vh; }
.rodape { position: absolute; left: 12px; bottom: 10px; font-size: 12px; color: var(--muted); }
.rodape a { color: inherit; }
```

`apps/web/src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Corpo3D', description: 'Corpo humano 3D desmontável para educação de paciente' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
```

`apps/web/src/app/page.tsx`:
```tsx
import Link from 'next/link';
import { Cena } from '@/components/viewer/Cena';
export default function Pagina() {
  return (
    <main>
      <h1 style={{ position: 'absolute', margin: 0, padding: '12px 16px', fontSize: 16, zIndex: 1 }}>Corpo3D</h1>
      <Cena />
      <p className="rodape">Modelos: BodyParts3D, © The Database Center for Life Science, CC BY 4.0 · <Link href="/atribuicao">atribuição</Link></p>
    </main>
  );
}
```

- [ ] **Step 6: Instalar e rodar em dev**

Run: `cd ~/Projetos/corpo3d && pnpm install && pnpm --filter @corpo3d/web typecheck && (pnpm --filter @corpo3d/web dev &) && sleep 8 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3020/`
Expected: typecheck sem erro; `200`. Abrir http://localhost:3020 no navegador: corpo inteiro visível, pele por cima, órbita com o mouse. Se só a pele aparecer, é o esperado (as camadas vêm na fase 1); girar e olhar por baixo dos pés mostra ossos através de onde a pele é aberta.

`<Environment preset="studio">` baixa um HDR de um CDN do pmndrs na primeira carga; sem internet a cena fica escura mas não quebra. A fase 1 troca por um `.hdr` local em `public/hdri/`.

Se `useGLTF.setMeshoptDecoder` não existir na versão instalada do drei, trocar por:
```ts
useGLTF.preload; // manter import
// e no componente:
const { scene } = useGLTF(`/models/${peca.glb}`, undefined, undefined, (loader) => loader.setMeshoptDecoder(MeshoptDecoder));
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(web): app Next 16 com visualizador R3F que abre as 251 peças do manifesto"
```

---

### Task 10: Página de atribuição

**Files:**
- Create: `apps/web/src/app/atribuicao/page.tsx`

- [ ] **Step 1: Página**

`apps/web/src/app/atribuicao/page.tsx`:
```tsx
import Link from 'next/link';
export const metadata = { title: 'Atribuição — Corpo3D' };
export default function Atribuicao() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px', height: 'auto' }}>
      <h1>Atribuição e licenças</h1>
      <p>Os modelos anatômicos deste site derivam do banco de dados BodyParts3D:</p>
      <blockquote>BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International</blockquote>
      <p>Licença: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Fonte: <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/">dbarchive.biosciencedbc.jp/en/bodyparts3d</a>.</p>
      <p>As malhas foram convertidas, simplificadas e comprimidas para uso no navegador. Os nomes em português, os
        textos explicativos e o software deste site são de autoria própria e não fazem parte do banco original.</p>
      <p>Material educativo. Não substitui consulta nem orientação do seu médico.</p>
      <p><Link href="/">← voltar ao modelo</Link></p>
    </main>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `curl -s http://localhost:3020/atribuicao | grep -o "CC Attribution 4.0 International" | head -1`
Expected: `CC Attribution 4.0 International`

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(web): página de atribuição exigida pela CC BY 4.0"
```

---

### Task 11: E2E com Playwright — o portão da fase 0

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/visualizador.spec.ts`

- [ ] **Step 1: Config**

`apps/web/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: { baseURL: 'http://localhost:3020', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:3020', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'celular', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 640 } } },
  ],
});
```

- [ ] **Step 2: Teste**

`apps/web/e2e/visualizador.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('abre o manifesto, carrega as 251 peças sem erro de console e renderiza pixels', async ({ page }, info) => {
  const erros: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(e.message));
  const respostas: number[] = [];
  page.on('response', (r) => { if (r.url().includes('/models/') && r.url().endsWith('.glb')) respostas.push(r.status()); });

  await page.goto('/');
  const cena = page.getByTestId('cena');
  await expect(cena).toBeVisible();
  await expect(cena).toHaveAttribute('data-pecas', '251');
  await expect(page.locator('canvas')).toBeVisible();

  // espera os GLBs chegarem (251 requisições OK)
  await expect.poll(() => respostas.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(251);
  expect(respostas.filter((s) => s !== 200 && s !== 304)).toEqual([]);

  // o canvas não pode estar todo da cor de fundo: amostra o pixel central
  await page.waitForTimeout(1500);
  const centro = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return null;
    const px = new Uint8Array(4);
    gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return Array.from(px);
  });
  // com preserveDrawingBuffer=false o readPixels pode devolver zeros; nesse caso a prova é o screenshot
  await page.screenshot({ path: info.outputPath(`corpo-${info.project.name}.png`) });
  if (centro && centro.some((v) => v !== 0)) expect(centro.slice(0, 3)).not.toEqual([16, 18, 20]);

  expect(erros).toEqual([]);
});

test('página de atribuição traz o texto exigido', async ({ page }) => {
  await page.goto('/atribuicao');
  await expect(page.getByText('CC Attribution 4.0 International')).toBeVisible();
});
```

- [ ] **Step 3: Rodar**

Run: `cd apps/web && pnpm exec playwright install chromium && pnpm test:e2e`
Expected: `6 passed` (2 testes × 3 projetos). Abrir `apps/web/test-results/**/corpo-desktop.png` e olhar: corpo inteiro em pé, iluminado, sem buracos pretos grandes. Se o Playwright reclamar de WebGL no headless, acrescentar em `use`: `launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(web): e2e do portão da fase 0 — 251 peças carregam em 320/768/1440"
```

---

### Task 12: CI e README curto

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `README.md`

- [ ] **Step 1: CI (só testes unitários e typecheck; o pipeline real não roda no CI porque baixa 143 MB)**

`.github/workflows/ci.yml`:
```yaml
name: ci
on: [push, pull_request]
jobs:
  testes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm --filter @corpo3d/pipeline test
```

- [ ] **Step 2: README**

`README.md`:
````markdown
# Corpo3D

Corpo humano 3D desmontável para educação de paciente. Spec em `docs/superpowers/specs/`.

## Rodar

```bash
pnpm install
pnpm --filter @corpo3d/pipeline baixar      # 143 MB do BodyParts3D, uma vez
pnpm --filter @corpo3d/pipeline construir   # gera apps/web/public/models/ (~9 MB, ~5 min)
pnpm --filter @corpo3d/pipeline portao      # confere orçamentos
pnpm --filter @corpo3d/web dev              # http://localhost:3020
```

## Conteúdo

`conteudo/estruturas.csv` é a lista das peças (fonte da verdade). Colunas: `fmaId, arvore,
fmaIdsExtras, excluirFmaIds, nomeLatim, nomePt, nomeLeigo, sistema, lado, vetorExplosao,
razaoSimplificacao`. Para adicionar uma peça: achar o ID em `.cache/bp3d/*_parts_list_e.txt`,
inserir a linha, reconstruir, rodar o portão.

Modelos: BodyParts3D, © The Database Center for Life Science, CC BY 4.0.
````

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "ci: testes e typecheck; docs: README com o fluxo de execução"
```

---

## Portão da fase 0 (spec §11)

- [ ] `pnpm --filter @corpo3d/pipeline test` → todos passam
- [ ] `pnpm --filter @corpo3d/pipeline portao` → `0 problema(s)`, total < 30 MB
- [ ] `pnpm --filter @corpo3d/web test:e2e` → 6 passed, screenshots mostram o corpo inteiro nos 3 tamanhos
- [ ] Olhar a tela a olho nu: iluminação de estúdio, órgãos com brilho úmido, osso fosco. Se parecer "plástico", ajustar `RECEITAS` (é só cor/roughness/clearcoat; nada de código)

Ao fechar o portão: escrever o plano da fase 1 (interação) a partir do spec §4.3 e §5.
