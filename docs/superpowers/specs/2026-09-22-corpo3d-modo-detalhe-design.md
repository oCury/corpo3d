# Corpo3D — modo detalhe: clicar num órgão abre as partes dele

**Data:** 2026-09-22
**Status:** aprovado em 2026-09-22 (opção "modo detalhe genérico" escolhida sobre "olho com condições" e "coração-herói"; escolha das partes **híbrida**: automática + curadoria em CSV)
**Spec-mãe:** `2026-09-21-corpo3d-design.md`

## 1. Propósito

Hoje o Corpo3D para na peça: o coração é uma malha só. O médico quer apontar o ventrículo, a
valva, a coronária. Este spec faz cada órgão abrir nas partes dele, e cada parte nas partes
dela, com o mesmo visualizador: partes são peças comuns (selecionar, arrastar, anotar,
destacar, explodir), carregadas só quando o médico pede, e o link do paciente (fase 2)
guarda o caminho aberto.

Não é o "Olho3D de cada órgão" (condições clínicas, simulação): é o mecanismo que torna isso
possível depois, um órgão por spec. Aqui entra só **estrutura**: partes e nomes.

## 2. Fatos verificados (2026-09-22, nos arquivos do BodyParts3D em `.cache/bp3d`)

- **A árvore parte-de do atlas é incompleta.** `partof_inclusion_relation_list.txt` (1.368
  relações) liga o coração só ao lado esquerdo, a duas cavidades e ao esqueleto fibroso; o
  "lado direito do coração" (`FMA7165`) não é filho de ninguém. Portanto **a relação certa é
  por continência de elementos**: os elementos do ventrículo direito (10) são subconjunto dos 83
  do coração. Por essa regra, 91 conceitos estão dentro do coração.
- Um mesmo conceito FMA aparece nas duas árvores (`partof_element_parts.txt`, 17.943 linhas, e
  `isa_element_parts.txt`, 29.549) com os mesmos elementos; unir por FMA é seguro.
- **Medição com a regra deste spec (continência, lista negra de nomes, guloso, 4 níveis):**

  | Medida | Valor |
  |---|---|
  | Peças de nível 1 (das 241) com ≥ 2 partes | 56 |
  | Nós com partes por nível (1 → 4) | 56 · 76 · 51 · 34 |
  | Nós de parte criados por nível (2 → 5), com "resto" | 316 · 255 · 143 · 86 (= 800) |
  | Conceitos-parte distintos (nomes a traduzir) | 579 |
  | Elementos do pai sem parte nomeada ("resto"), média | 8 % |
  | Bytes OBJ das partes por nível (2 → 5) | 176 · 72 · 28 · 13 MB |
  | Bytes OBJ das 241 peças → GLB | 298 MB → 8,0 MB (razão ≈ 37:1) |

  Logo as partes pesam **≈ 8 MB de GLB no total**, e nada disso carrega ao abrir o app.

  **Correção (22/09, ao executar a Tarefa A):** a medição acima não descontava os elementos das
  coronárias D/E (`FMA50039`/`FMA50040`), que já são peças de nível 1 e são subconjuntos do coração
  (54 dos 83 elementos). Com a regra da seção 3 como implementada: **50** peças de nível 1 com ≥ 2
  partes, **138** nós com partes, **503** linhas (58 restos), **445** nomes distintos, **6,2 MB** de
  GLB de partes. Coração nível 1: ventrículos D/E, veia marginal direita, veia cardíaca pequena, seio
  coronário, veia cardíaca magna + resto (cavidades e paredes dos átrios, que a curadoria dos átrios
  cobre). As coronárias seguem peças próprias e ficam esmaecidas com o coração aberto; rebaixá-las a
  partes exigiria tirá-las de `estruturas.csv` — decisão de conteúdo pendente, fora deste spec.
- Exemplos do que a regra automática dá no nível 1: **coração** → coronárias D/E, ventrículos
  D/E, seio coronário, veias cardíacas (os **átrios ficam de fora**: a valva mitral pertence
  ao átrio e ao ventrículo, e a regra "sem elemento repetido" fica com o ventrículo, maior);
  **fígado** → lobos D/E, veia porta direita, hemifígados; **globo ocular esquerdo** → coroide,
  câmara anterior, íris, córnea, cristalino, esclera, vítreo, ligamento suspensor; **crânio** →
  neurocrânio, esqueleto do nariz, maxila, zigomático, lacrimal, palatino, esfenoide. Nível 2:
  ventrículo esquerdo → valva mitral, músculo papilar, cúspide da aórtica; coronária esquerda →
  descendente anterior, circunflexa.
- **Sujeira do atlas que a regra tem de tratar:** o crânio (`FMA46565`) contém elementos do
  hioide e da glândula lacrimal, que já são peças de nível 1 (regra dos elementos
  compartilhados); os elementos "direitos" do olho (`FMA12514` e partes) trazem os dois olhos
  dentro de cada arquivo, sem repetir elemento do esquerdo (exceção declarada); rim, fêmur,
  baço, vesícula e próstata são um elemento só (sem partes). Uma parte que é subconjunto do pai
  sempre cabe na caixa do pai, então **não há regra de caixa**.
- Tudo no atlas compartilha um sistema de coordenadas: uma parte fica exatamente onde está o
  pai, sem transformação. É o que torna "abrir as partes" só trocar malhas.
- Código que este spec se apoia: `Peca.tsx` recebe um `PecaManifesto` e faz todo o resto por
  `fmaId`; `posicaoAlvo` = solta ou `vetorExplosao × explosao × 0,4 m`; `isolar` põe as outras
  peças a 10 % de opacidade e peça < 50 % não captura o ponteiro; o estado é Zod v1 com
  histórico de 50; `enquadrar(peca)` enquadra pela bbox.

## 3. Regra das partes (pipeline, `packages/pipeline/src/partes.ts`)

Um **nó** é um conjunto de elementos `FJ####`. As 241 peças são os nós de nível 1 (elementos
resolvidos pelo CSV, com `fmaIdsExtras` e `excluirFmaIds`, como hoje).

Para um nó `P` com elementos `E(P)`:

1. **Elementos próprios:** `E'(P) = E(P) − elementos de qualquer outra peça de nível 1`. (Tira o
   hioide e a lacrimal de dentro do crânio; eles já são peças.)
2. **Candidatas:** todo conceito `C` do atlas (as duas árvores unidas por FMA) com
   `E(C) ⊂ E'(P)` (subconjunto **estrito**, não vazio), exceto:
   - nome que casa a **lista negra** (não visual): `cavity, lumen, space, surface, region,
     zone, wall, part of, set of, side of, septum, apex, base of, border, margin, line, point,
     content, layer, myocardium, endocardium, epicardium, parenchyma, tree, proper, hemi,
     segment, division, trunk of` (palavra inteira, sem distinguir maiúsculas);
   - `P` em `PECAS_SEM_PARTES` (constante do pipeline, com o motivo em comentário): hoje só o
     globo ocular direito `FMA12514`. Verificado em 22/09: os 8 elementos dele não se repetem
     no esquerdo, mas **cada arquivo "direito" do atlas já traz os dois olhos dentro de si**
     (córnea direita = 81 mm de largura), então nenhuma regra por elementos ou por caixa o
     pega. O olho é desenhado paramétrico de qualquer jeito.
3. **Escolha automática:** candidatas ordenadas por `(−|E(C)|, fmaId)`; entra a que não repete
   elemento já coberto. Determinístico.
4. **Curadoria** (seção 4) aplicada por cima: linhas `revisado` entram **mesmo repetindo
   elementos**; linhas `excluida` saem.
5. **Resto:** `E'(P) − ∪ E(partes)`; se não vazio, vira a parte `<fmaId do pai>-resto`, nome
   "Outras partes de <nome do pai>".
6. Um nó tem detalhe se, ao fim, tiver **≥ 2 partes** (contando o resto). Recursão: cada parte
   escolhida é um nó, até o **nível 5** (quatro aberturas).

Partes herdam `sistema` do pai. `lado`: `D`/`E` se o nome do atlas começa com `right`/`left`,
senão o do pai. `vetorExplosao` de uma parte = direção do centro do pai ao centro da parte,
normalizada, vezes `diagonal da bbox do pai / DESLOCAMENTO_MAXIMO (0,4 m)`, para que com
explosão 1 a parte ande um diâmetro do pai (o slider de explosão existente serve dentro do
órgão sem escala nova). Parte com centro igual ao do pai sai para `+z`.

Elementos de uma parte são exatamente os do atlas; a geometria passa pelo mesmo
`escreverGlb` (solda, simplificação pela razão do sistema, normais suaves, meshopt).

## 4. Curadoria: `conteudo/partes.csv`

Colunas: `paiFmaId, fmaId, nomeEn, nomePt, nomeLeigo, status`.

- `status ∈ { auto, revisado, excluida }`.
- `pnpm --filter @corpo3d/pipeline propor-partes` roda a regra da seção 3 para os 241 nós e
  seus descendentes e **reescreve o CSV preservando a curadoria**: linhas `revisado` e
  `excluida` existentes são mantidas como estão; linhas `auto` são recalculadas (nome do atlas
  atualizado, `nomePt`/`nomeLeigo` **mantidos** se já preenchidos); partes que a regra não
  propõe mais e não são `revisado` são removidas. Saída ordenada por `(paiFmaId, −tamanho,
  fmaId)` para o diff ser legível.
- Linha manual: o André acrescenta `FMA7088, FMA7097, left atrium, Átrio esquerdo, câmara
  que recebe o sangue dos pulmões, revisado`; ela entra mesmo sobrepondo a valva mitral com o
  ventrículo. Se uma linha `revisado` apontar para um conceito que **não é subconjunto** do pai
  (ou não existe), `construir` **falha alto** com a linha e o motivo.
- Nomes em português: rascunhados por um agente numa tarefa própria (fora do pipeline), a
  partir de `nomeEn`, mantendo `status=auto`. Para linhas `-resto` o nome é fixo.
- O CSV é fonte da verdade das partes, como `estruturas.csv` é das peças. O pipeline **não
  inventa** partes fora dele: `construir` lê o CSV; `propor-partes` é quem escreve.

## 5. Construção e manifesto

`construir`, depois das 241 peças, gera para cada nó com detalhe:

- `apps/web/public/models/partes/<paiFmaId>/<fmaId>.glb` (e `<paiFmaId>/<paiFmaId>-resto.glb`);
- `apps/web/public/models/partes/<paiFmaId>.json`:

```ts
interface ManifestoPartes { versao: 1; paiFmaId: string; partes: PartePeca[] }
interface PartePeca extends PecaManifesto { paiFmaId: string; nivel: 2 | 3 | 4 | 5; status: 'auto' | 'revisado'; numPartes: number }
```

O manifesto principal ganha, em cada peça, `numPartes: number` (0 = sem detalhe). O campo é
novo e opcional para o leitor (`versao` continua 1). `nomeLatim` de uma parte recebe o nome
em inglês do atlas (não há TA2 aqui); o painel o mostra em itálico como hoje.

Orçamento (portão): 1 MB por parte (o existente) e **12 MB no total de partes** (constante
nova). O `portao` também confere que todo `paiFmaId` dos JSONs é uma peça ou uma parte
existente e que todo GLB referenciado existe.

## 6. Estado e cena (web)

- `EstadoCenaSchema` ganha `detalhe: z.array(FmaId).default([])`: a **pilha** de nós abertos,
  da raiz ao mais fundo. `FmaId` passa a aceitar `^FMA\d+(-resto)?$`. `v` continua 1: um link
  antigo sem o campo desserializa com `[]`.
- Store, transitório (não vai no link): `partes: Record<string, PartePeca[] | 'carregando' | 'erro'>`
  com `carregarPartes(paiFmaId)` (busca `/models/partes/<pai>.json`, valida forma mínima,
  guarda). Ações de domínio:
  - `abrirPartes(fmaId)`: **carrega antes de abrir**; se falhar, registra `'erro'` e não muda
    o estado. Ao abrir: encaixa o nó (sai de `soltas`), empilha em `detalhe`, tira a seleção,
    e a câmera vai para `enquadrar(nó)` com preset `livre`. Uma entrada de histórico.
  - `fecharPartes(nivel)`: mantém os primeiros `nivel` itens da pilha (0 = fecha tudo). Uma
    entrada de histórico. Ao fechar, `soltas`/`ocultas`/notas das partes **ficam** no estado
    (voltar a abrir encontra tudo como estava).
- `pecasVisiveis(manifesto, partes, estado)` em `lib/estado/detalhe.ts`, pura e testada:
  visível = peças de nível 1 menos `detalhe[0]`, mais, para cada `detalhe[i]`, as partes de
  `detalhe[i]` menos `detalhe[i+1]`; depois os filtros de hoje (opacidade do sistema > 0,
  `ocultas`). Se as partes de um nó da pilha ainda não chegaram, o nó **continua visível** (sem
  buraco); a troca acontece quando o JSON chega. Um link que chega com `detalhe` preenchido
  dispara `carregarPartes` para cada nó da pilha.
- **Esmaecimento:** com a pilha não vazia, toda peça visível que **não** é parte do nó mais
  fundo fica a `OPACIDADE_FORA_DA_ISOLACAO` (10 %), combinada com o `isolar` existente
  (multiplicam). Peça < 50 % já não captura o ponteiro: arrastar em volta gira a câmera.
- Uma parte é um `Peca` comum, com o `PartePeca` como `peca`; `posicaoAlvo`, arrasto, encaixe,
  fantasma, nota, destaque e emissivo funcionam por `fmaId` sem código novo. Um mesmo conceito
  pode ser parte de dois pais (valva mitral: átrio e ventrículo); como só um caminho fica
  aberto, não há duas instâncias na cena, e uma nota na valva é a mesma nos dois caminhos.
- `Cena` expõe `data-detalhe` = pilha unida por `>` (vazio = fechado) para os E2E.

## 7. Interface

- `PainelPeca`: botão **"Ver partes (N)"** quando `numPartes > 0`, chamando `abrirPartes`;
  enquanto carrega, desabilitado com "Carregando partes…"; em erro, "Partes indisponíveis" e
  o botão volta. Parte com `status: auto` mostra a tarja **"nome automático, em revisão"** ao
  lado do nome (mesmo tom da "Descrição em revisão médica").
- `Caminho` (novo, no alto do painel direito, `nav aria-label="Caminho"`): **Corpo › Coração ›
  Ventrículo esquerdo**. Cada nível anterior é botão (`fecharPartes(i)`); o último tem
  `aria-current="location"`. Some quando a pilha está vazia.
- `ListaPecas`: com detalhe aberto, um grupo **"Partes de <nome do nó mais fundo>"** entra no
  topo do listbox (mesma estrutura achatada, mesmas teclas). Sem detalhe, lista como hoje.
- Busca: só nas 241 peças (fora de escopo buscar partes; ver seção 10).
- Atalho de teclado: **Esc** com detalhe aberto e nada selecionado fecha um nível (o `Esc` de
  hoje tira a seleção; com seleção, continua tirando a seleção primeiro).

## 8. Tratamento de erros

- `propor-partes`: CSV existente malformado → falha com linha; conceito de linha `revisado`
  inexistente ou fora do pai → falha alto em `construir` (não silencia curadoria errada).
- `construir`: parte sem elemento legível → mesma mensagem de hoje com pai e parte.
- Web: JSON de partes ausente/inválido → `'erro'` no store, painel mostra "Partes
  indisponíveis", estado não muda; GLB de uma parte que não carrega → a peça some da cena e o
  restante segue (comportamento já existente do Suspense por peça).
- Link com `detalhe` apontando para nó que já não tem partes (manifesto mudou) → o nó fica
  visível e a pilha é truncada ali, com aviso no console; nada quebra.

## 9. Testes

**Pipeline (Vitest), `tests/partes.test.ts` com fixture de elementos sintética:** subconjunto
estrito; lista negra; exclusão de elementos de outra peça de nível 1; `PECAS_SEM_PARTES`;
guloso determinístico; `revisado` entra sobrepondo; `excluida` sai; resto; ≥ 2 partes para ter
detalhe; recursão para no nível 5; `vetorExplosao` radial com alcance = diagonal do pai;
leitura/escrita de `partes.csv` preservando curadoria e removendo `auto` órfãs.

**Web (Vitest):** schema aceita `-resto` e `detalhe`, link antigo sem `detalhe` vira `[]`, ida e
volta; `pecasVisiveis` com pilha de 0, 1 e 2 níveis e com partes ainda não carregadas; store:
`abrirPartes` empilha, encaixa e registra histórico, `fecharPartes(i)` trunca, desfazer fecha.

**E2E (Playwright), `e2e/detalhe.spec.ts`:** abrir o estúdio, buscar "coração", clicar "Ver
partes (N)" → `data-detalhe="FMA7088"` e `data-visiveis` = 240 + N (N lido de
`public/models/partes/FMA7088.json`, como `pelos.spec` lê o manifesto); clicar numa parte pelo
grupo "Partes de Coração" da lista → selecionada; explosão 0,5 move a parte (posição pelo
`window.__cena`); caminho "Corpo" fecha tudo → `data-detalhe=""` e 241 visíveis; desfazer
reabre; axe no estúdio com detalhe aberto.

**Portão manual:** capturas na Mesa do coração aberto (frente) e do ventrículo esquerdo aberto.

## 10. Fases e custo

| Tarefa | Entrega | Portão |
|---|---|---|
| A. Pipeline | `partes.ts`, `propor-partes`, `construir` com partes, manifesto com `numPartes`, `portao` | testes do pipeline; `construir` gera os JSON/GLB; 12 MB |
| B. Conteúdo | `partes.csv` proposto + `nomePt`/`nomeLeigo` rascunhados por agente | CSV lê de volta sem erro; amostra de 30 nomes conferida |
| C. Estado e cena | schema, store, `pecasVisiveis`, carga, esmaecimento, `data-detalhe` | unit web |
| D. Interface e E2E | botão, `Caminho`, lista, Esc, `detalhe.spec.ts`, capturas | E2E completo, axe |

Um subagente por vez, revisão combinada por tarefa e revisão final. **Estimativa: US$75-95.**
Branch `feat/modo-detalhe`, merge `--no-ff`.

**Fica de fora:** buscar partes pelo nome; descrições (3 blocos) das partes; condições
clínicas e simulação por órgão; celular; interface de curadoria (é o CSV); partes de peças
`isa` sem subconjuntos (rim, fêmur, baço...) — só existem se o atlas tiver.

## 11. Riscos

- **Nível do anatomista, não do médico.** A regra automática dá "neurocrânio" em vez dos ossos e
  omite os átrios. Mitigação: é o que a curadoria existe para consertar, e a recursão mostra
  o nível seguinte com um clique. O CSV nasce cheio, então o custo de corrigir é por órgão.
- **Nomes automáticos errados no painel.** Tarja explícita; a página do paciente (fase 2)
  mostrará nome de parte em português **só se `revisado`**; senão, o nome do atlas.
- **800 GLBs pequenos.** Tempo de `construir` sobe (cada parte re-lê os OBJ dos elementos);
  mitigação: cache dos OBJ parseados por elemento durante a construção. Sem portão de tempo.
- **Pilha em link antigo do futuro.** Se o CSV mudar e uma parte sumir, o link trunca a pilha
  com aviso (seção 8), nunca quebra.
