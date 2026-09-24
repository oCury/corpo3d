# Corpo3D — pele: oclusão cozida, luz neutra e fim dos pontinhos

**Data:** 2026-09-24
**Status:** aprovado em 2026-09-24 (pacote escolhido pelo André: oclusão por vértice + luz de estúdio neutro + correção dos pontinhos; subsuperfície, tom por região e malha nova ficaram de fora)
**Spec-mãe:** `2026-09-21-corpo3d-design.md` · **Spec anterior da pele:** `2026-09-22-corpo3d-cabelo-pelos-design.md`

## 1. Propósito

A pele do Corpo3D lê como manequim: tom uniforme, sem sombra de contato nas axilas, na virilha,
entre os dedos e sob o queixo, e com pontinhos escuros espalhados pelo corpo. Este spec faz três
coisas, todas medíveis: (1) corrige a causa dos pontinhos no pipeline; (2) cozinha a oclusão
ambiente por vértice no pipeline e a aplica só à luz indireta no shader da pele; (3) troca a luz e
o mapeamento de tons por um estúdio neutro com preenchimento e contorno. Nada muda para o médico
além da aparência: nenhuma interação nova, nenhum campo novo no estado.

## 2. Fatos verificados (23–24/09, na malha real e no código)

- **Causa dos pontinhos (medida, não suposta).** A malha original da pele (`FJ2810.obj`, 102.467
  vértices, 203.382 triângulos) é limpa: 0 normais canceladas, 0 arestas com orientação
  inconsistente. Na GLB final, **2.108 vértices (2 %) têm a normal gravada oposta à média das
  faces vizinhas**, em cachos minúsculos (área incidente média 6 mm² contra 104 mm² no resto; só
  26 dos 2.108 são isolados), mais 108 triângulos degenerados. A ordem em `glb.ts` explica:
  solda → simplifica → **normais** → **infla 3,5 mm ao longo dessas normais** → grava as normais
  antigas. Em dobras mais estreitas que 7 mm (entre os dedos, virilha, axilas) os dois lados se
  cruzam e a superfície vira do avesso; a normal gravada fica de costas para a face, e cada um
  desses vértices vira um pixel escuro. O mesmo vale, em menor grau, para as 26 peças com
  `confinar=pele`: o confinamento move vértices em até 12 mm e as normais gravadas são de antes.
- Nas cinco vistas de preset com a pele opaca, pixels em cor de músculo ou vaso: 0 a 3 por vista
  (73 a 372 mil pixels de corpo). Nenhum órgão atravessa a pele a essa distância. Pontos escuros
  isolados na vista de frente: ≈ 1.000.
- `three-mesh-bvh` já está no pipeline (`confinar.ts`) e faz `closestPointToPoint`/`raycast`.
  `gltf-transform` 4.5 quantiza atributos próprios (`_NOME`) com `quantizeGeneric: 12` dentro de
  `meshopt()`; o `GLTFLoader` do three entrega `_OCLUSAO` como `geometry.attributes._oclusao`
  (nome em minúsculas). Um atributo declarado no shader e ausente na geometria fica desabilitado
  no WebGL e lê a constante `(0, 0, 0, 1)`: um `float` lê **0**.
- three 0.186 tem `NeutralToneMapping` (Khronos PBR Neutral: preserva matiz e saturação do albedo,
  feito para produto) e `AgXToneMapping`. O R3F usa ACES Filmic por padrão; `shadows="soft"` liga
  `PCFSoftShadowMap`; o `Environment` do drei 10.7 aceita `environmentIntensity`.
- O shader do three só aplica `aoMap` a `reflectedLight.indirectDiffuse`, `indirectSpecular` (via
  `computeSpecularOcclusion`), clearcoat e sheen indiretos (`aomap_fragment`). O material da pele
  (`MaterialPele`, subclasse com `onBeforeCompile` no protótipo) já injeta código nesses chunks.
- `pelos.spec.ts` mede contraste real de pixel (sobrancelha e couro cabeludo mais escuros que a
  testa em ≥ 25 níveis; testa ≥ 100; fundo ≤ 40). Qualquer mudança de luz e tom tem de continuar
  passando nele.

## 3. Inflar sem dobrar e normais finais (pipeline, `inflar.ts` novo, `glb.ts`)

`inflarSemDobrar(pos, idx, normais, distM)` devolve as posições infladas e quantos vértices
tiveram o deslocamento reduzido:

1. `desloc[v] = distM` para todo vértice; normais de partida `n0` = normais suaves da malha
   simplificada (as de hoje).
2. `pos' = pos + n0 · desloc`; calcula a normal média das faces de cada vértice em `pos'`; um
   vértice está **dobrado** se `dot(média, n0) < LIMIAR_DOBRA` (0,2) ou se a média é nula. Sem
   dobrados, para. Senão, `desloc` dos dobrados **e dos vizinhos diretos** cai pela metade e
   repete, até `MAX_REDUCOES_DOBRA = 3` reduções (3,5 → 1,75 → 0,875 → 0,44 mm).
3. Vértice ainda dobrado depois disso (e vizinhos) recebe `desloc = 0`, repetindo a checagem até
   não sobrar dobra.

A ordem em `escreverGlb` passa a ser: solda → simplifica → normais de partida → **inflar sem
dobrar** → confinar (como hoje) → **normais finais das posições finais** (`normaisSuaves`) →
prune → meshopt. As normais gravadas são sempre as da geometria gravada, para todas as peças.
Por construção, "normal gravada oposta às faces" passa a ser impossível (só a quantização a 8
bits perturba, em menos de 1°).

## 4. Oclusão ambiente por vértice (pipeline, `oclusao.ts` novo)

Só para as peças em `PECAS_COM_OCLUSAO = new Set([FMA_PELE])` (constante; ligar outras depois é
uma linha). Sobre a geometria e as normais **finais**:

- BVH da própria malha (`MeshBVH`, como em `confinar.ts`).
- `AMOSTRAS_OCLUSAO = 48` direções no hemisfério unitário com peso de cosseno, geradas **uma vez**
  por espiral de Fibonacci (determinístico, sem aleatório) e levadas ao referencial de cada
  vértice por uma base ortonormal construída da normal.
- Origem do raio: `p + n · 0,5 mm` (evita acertar a própria face). Alcance
  `ALCANCE_OCLUSAO_M = 0,30`. Um acerto a distância `d` pesa `1 − d / alcance`.
- `oclusao(v) = Σ pesos / AMOSTRAS`, em [0, 1]: **0 = livre, 1 = totalmente ocluído**. Guarda-se
  a oclusão, e não a luz, para que uma GLB antiga sem o atributo renderize como hoje (atributo
  ausente lê 0).
- Gravada como atributo `_OCLUSAO` (SCALAR, float) antes do `meshopt`, que a quantiza a 12 bits.
- Custo: 101 mil vértices × 48 raios ≈ 4,9 milhões de raios sobre 203 mil triângulos; orçamento
  de tempo **30 s** para a pele dentro do `construir` (hoje ≈ 10 s no total).

## 5. Portão (pipeline, `portao.ts`)

Duas verificações novas, com o `NodeIO` e o decodificador meshopt já registrados em `glb.ts`:

- `verificarNormais`: em **toda** GLB do manifesto e das partes, contar vértices cuja normal
  gravada tem `dot < 0` com a média das faces vizinhas. Portão: **0** (hoje: 2.108 na pele).
- `verificarOclusao`: a pele tem `_OCLUSAO`; média entre **0,05 e 0,40**; máximo **> 0,5**;
  fração de vértices com oclusão > 0,9 **< 1 %** (raios entrando na malha por normal errada
  dariam quase tudo ocluído).

## 6. Shader da pele (web, `pele.ts`)

`MaterialPele.onBeforeCompile` ganha:

- vértice: `attribute float _oclusao; varying float vOclusaoPele;` e `vOclusaoPele = _oclusao;`;
- fragmento, logo após `#include <aomap_fragment>`:
  `oclusaoPele = 1 − clamp(vOclusaoPele, 0, 1) · uForcaOclusao`, multiplicando
  `reflectedLight.indirectDiffuse`, `clearcoatSpecularIndirect`, `sheenSpecularIndirect` (sob os
  mesmos `#if` do three) e `reflectedLight.indirectSpecular` via `computeSpecularOcclusion`. **A
  luz direta não escurece.**
- `uForcaOclusao` é um objeto de uniform **compartilhado por todas as instâncias** (o material é
  clonado por peça), valor inicial `FORCA_OCLUSAO = 1.0`; `definirForcaOclusao(v)` exportada
  para o gancho de desenvolvimento e para ajuste futuro. `customProgramCacheKey` vira
  `pele-procedural-v3`.
- `ExporCena` (só fora de produção) expõe `window.__oclusao(v)`: chama `definirForcaOclusao(v)` e
  `invalidate()`. É o que o E2E usa para provar que a oclusão está sendo aplicada.

## 7. Luz e tom (web, `lib/luz.ts` novo, `Cena.tsx`)

Estúdio neutro, tudo em constantes nomeadas em `luz.ts`:

| Constante | Valor | Papel |
|---|---|---|
| `TOM` | `NeutralToneMapping` | fidelidade do tom da pele e dos órgãos |
| `EXPOSICAO` | 1,0 | |
| `HDRI_INTENSIDADE` | 0,8 | o HDRI de estúdio deixa de dominar |
| `LUZ_PRINCIPAL` | pos (1,5; 3; 2), 1,2, branca, **com sombra** (PCF suave 2048²) | a de hoje |
| `PREENCHIMENTO` | pos (−2,5; 1,5; 2,5), 0,35, branca, sem sombra | abre as sombras do lado oposto |
| `CONTORNO` | pos (−1,5; 2,5; −2,5), 0,6, `#dfe8ff`, sem sombra | separa o corpo do fundo escuro |

`Cena.tsx`: `shadows="soft"`, `gl={{ toneMapping: TOM, toneMappingExposure: EXPOSICAO }}`,
`<Environment environmentIntensity={HDRI_INTENSIDADE} />` e as três luzes. Se `pelos.spec`
reprovar com os valores acima, ajustam-se **as constantes**, não o teste, até passar; o teste é o
oráculo de que a sobrancelha e o couro cabeludo continuam legíveis.

**Portão manual:** capturas na Mesa (`~/Desktop/corpo3d-realismo-*.png`) das vistas frente,
costas e esquerda, mais rosto e tronco de perto, com `Neutral`; e o mesmo conjunto com `AgX`,
gerado **uma vez** trocando a constante e revertendo (sem commit). O André escolhe; a escolha
entra no spec como decisão.

## 8. Tratamento de erros

- `inflarSemDobrar` com malha sem faces ou `distM ≤ 0` devolve as posições intactas.
- `oclusao.ts` falha alto se a peça não tiver normais ou se o BVH não puder ser construído; e o
  `construir` registra o tempo gasto na oclusão. Passar de 30 s **não** falha: fica no log e no
  relatório.
- Shader: sem `_oclusao` na geometria, `vOclusaoPele = 0` e a pele renderiza como hoje.
- `window.__oclusao` só existe fora de produção, como `window.__cena`.

## 9. Testes

**Pipeline (Vitest):**
- `inflar.test.ts`: (a) placa plana inflada de 3,5 mm sobe 3,5 mm em todos os vértices, 0
  reduzidos; (b) calha em V com 4 mm de abertura: sem o recuo, vértices dobrados > 0; com o
  recuo, **0** dobrados e deslocamento reduzido no fundo da calha, cheio nas bordas; (c) esfera
  inflada: normais finais apontam para fora (dot com a posição radial > 0,99).
- `oclusao.test.ts`: (a) placa plana isolada: oclusão ≈ 0 em todo vértice; (b) placa com uma
  parede perpendicular: oclusão perto da parede > 0,2 e longe < 0,05; (c) determinismo: duas
  execuções dão arrays idênticos.
- `portao.test.ts`: `verificarNormais` acusa uma GLB sintética com normal invertida;
  `verificarOclusao` acusa média fora da faixa e fração > 0,9 alta.
- `construir.test.ts`: a fixture ganha uma peça com `inflarMm` e a pele da fixture (se houver)
  sai com `_OCLUSAO`; senão, teste direto de `escreverGlb` com `oclusao: true`.

**Web (Playwright), `e2e/realismo.spec.ts` (desktop e tablet; celular pula):**
- Vista de frente, captura do elemento `cena`: **pontos escuros isolados ≤ 20** (pixel com
  luminância < 95 cujos 8 vizinhos têm luminância > 130; hoje ≈ 1.000).
- Oclusão aplicada: com `window.__oclusao(0)` e `window.__oclusao(1)`, o **percentil 5** da
  luminância dos pixels de corpo cai em **≥ 8 níveis** com a oclusão ligada, e o **percentil 95**
  cai em **≤ 3** (sombra de contato, não escurecimento geral).
- `pelos.spec`, `visualizador`, `interacao`, `detalhe` e o resto da suíte continuam passando.
- Capturas do portão manual (§7) geradas por um spec descartável, não commitado.

## 10. Tarefas e custo

| Tarefa | Entrega | Portão |
|---|---|---|
| A. Pipeline | `inflar.ts`, `oclusao.ts`, ordem nova em `glb.ts`, `verificarNormais`/`verificarOclusao`, testes | pipeline verde; `construir` + `portao` 0 problemas; pele com `_OCLUSAO` |
| B. Web | `pele.ts` lê `_oclusao`, `luz.ts`, `Cena.tsx`, gancho `__oclusao` | unit + typecheck; `pelos.spec` passa |
| C. E2E e fechamento | `realismo.spec.ts`, capturas Neutral × AgX, revisão final, merge `--no-ff` | suíte inteira; escolha do tom registrada |

Um subagente por tarefa, conferência mecânica dos blocos, revisão de olhar fresco no fim.
**Estimativa: US$ 40–50.** Branch `feat/pele-realismo`, merge `--no-ff`.

**Fica de fora:** subsuperfície (real ou falsa); tom e brilho por região; oclusão nos órgãos e nas
partes (mecanismo pronto, basta incluir a peça em `PECAS_COM_OCLUSAO`); malha nova; oclusão em
tempo de execução (SSAO, removido em 21/09 por lavar os pretos).

## 11. Riscos

- **Recuo demais nas dobras.** Onde a calha é estreita a pele deixa de inflar e volta a ficar a
  0 mm de vasos e músculos, com o z-fighting de antes só ali. Mitigação: o `confinar=pele` das 26
  peças continua empurrando-as 1 mm para dentro do envelope final; a métrica é o E2E de pontos
  isolados, e o relatório da Tarefa A diz quantos vértices foram reduzidos e onde.
- **Oclusão parecendo sujeira.** Com o peso de cosseno e o alcance de 30 cm o efeito é suave; se
  ficar forte, `FORCA_OCLUSAO` desce (constante única).
- **`Neutral` pode parecer "lavado"** ao lado do ACES de hoje: é exatamente o que o portão manual
  com `AgX` ao lado decide.
- **Tempo de `construir`.** +≈ 10–30 s. Aceito; medido e registrado.
