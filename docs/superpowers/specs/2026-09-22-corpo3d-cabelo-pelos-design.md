# Corpo3D — cabelo raspado, sobrancelhas e pelos no shader da pele

**Data:** 2026-09-22
**Status:** aprovado em 2026-09-22 (abordagem A escolhida entre A: só shader, B: casca geométrica, C: asset comprado)
**Spec-mãe:** `2026-09-21-corpo3d-design.md` (a pele procedural está na fase 1.5)

## 1. Propósito

O corpo do BodyParts3D é um homem sem um fio de cabelo, e a cabeça lisa é a primeira coisa que
o paciente estranha. Este spec põe **couro cabeludo raspado, sobrancelhas e uma sugestão de
pelos por região** na pele existente, sem asset comprado e sem peça nova: tudo é máscara por
posição no mundo dentro do shader que a pele já tem (`MaterialPele`, `apps/web/src/lib/materiais/pele.ts`).

Fica de fora: cabelo comprido ou penteado, barba, cílios (o olho paramétrico não tem pálpebra
própria; a pálpebra é a pele do atlas), pelos como geometria (abordagem B, possível upgrade
depois sem desfazer nada daqui), corpo feminino.

## 2. Fatos que sustentam o desenho

- A pele não tem UV. Todo detalhe dela já é função da **posição no mundo em metros**
  (`vPosMundoPele`), então uma máscara por posição é o mesmo mecanismo que já existe.
- O material da pele é um singleton (`materialPara('pele', …)` devolve sempre a mesma
  instância do cache) e o shader mora no **protótipo** da subclasse, porque `Material.copy()`
  do three não copia `onBeforeCompile`. Constantes no código funcionam; uniform por instância
  não é necessário.
- A cabeça do atlas é fixa (BodyParts3D 2013, um único corpo). Marcos medidos no manifesto
  em 2026-09-22, em metros, eixos do three (`+y` cima, `+z` frente, `+x` esquerda do paciente):

  | Marco | x | y | z | Origem |
  |---|---|---|---|---|
  | Centro do globo ocular esquerdo (`FMA12515`) | 0,0291 | 1,5181 | 0,1524 | `centro` no manifesto |
  | Globo direito | −0,0291 | 1,5181 | 0,1524 | espelho em x (o `FMA12514` do atlas contém os dois olhos e o centro dele é inútil) |
  | Centro da cabeça (crânio `FMA46565`) | 0 | 1,530 | 0,085 | `centro` no manifesto, x arredondado |
  | Topo da pele | — | 1,641 | — | `bbox.max.y` da pele |
  | Queixo (mandíbula `FMA52748`) | — | 1,422 | — | `bbox.min.y` |

- O olho paramétrico fica 4 mm à frente do centro do manifesto (`DESLOCAMENTO_Z_OLHO`,
  `Peca.tsx`); a pele sobre a arcada da sobrancelha está por volta de z 0,175–0,185.

## 3. Arquitetura

Um arquivo novo e um arquivo tocado. Nenhuma mudança em `Peca.tsx`, manifesto, CSV ou pipeline.

```
apps/web/src/lib/materiais/
├── pele.ts        # injeta o trecho GLSL dos pelos nos 3 pontos que já usa; chave do programa vira 'pele-procedural-v2'
├── pelos.ts       # NOVO: marcos, constantes de ajuste, máscaras em TS puro, trecho GLSL gerado das mesmas constantes
└── pelos.test.ts  # NOVO: máscaras em pontos conhecidos + marcos contra o manifesto
apps/web/e2e/
└── pelos.spec.ts  # NOVO: portão por pixel (topo da cabeça e sobrancelha)
```

### 3.1 `pelos.ts`

Exporta:

- `MARCOS`: os valores da tabela da seção 2.
- `AJUSTE`: todas as constantes de forma e intensidade (alturas da linha do cabelo, raios das
  sobrancelhas, faixas do corpo, cores, forças). Um lugar só; mudar o visual é mudar aqui.
- Três máscaras em TypeScript puro, **geométricas, sem ruído**, cada uma `(p: Vec3) => number`
  em 0–1: `mascaraCouroCabeludo`, `mascaraSobrancelha`, `mascaraPelosCorpo`. São o gêmeo
  testável do GLSL; o ruído é só do shader.
- `GLSL_PELOS`: string com as funções GLSL equivalentes, interpolando `MARCOS` e `AJUSTE` com
  `toFixed`, como `pele.ts` já faz com suas constantes. Três funções GLSL (`pelosCouro`,
  `pelosSobrancelha`, `pelosCorpo`) devolvem a máscara já modulada por ruído; os três pontos de
  injeção em `pele.ts` as combinam em cor, rugosidade e inclinação da normal.

### 3.2 As máscaras

**Couro cabeludo.** Avaliado só quando `y > 1,40` (o resto do corpo não paga). Ângulo θ ao
redor do eixo vertical que passa pelo centro da cabeça, medido no plano xz a partir de `+z`
(frente): `c = cos θ = (z − cz) / hypot(x − cx, z − cz)`. Altura-limite da linha do cabelo:

```
yTesta   = yOlho + 0,070 = 1,588
yTempora = yOlho + 0,030 = 1,548
yNuca    = yOlho − 0,038 = 1,480
yLim(θ)  = yTempora + smoothstep(0, 1, max(c, 0)) · (yTesta − yTempora)
                    + smoothstep(0, 1, max(−c, 0)) · (yNuca − yTempora)
máscara  = smoothstep(yLim − 0,006, yLim + 0,006, y)
```

No shader, `yLim` recebe ruído de ±6 mm (`(fbm(p·90) − 0,5) · 0,012`) para a borda não
parecer cortada a régua. Efeito dentro da máscara: a cor mistura 85 % para castanho escuro
(`#3a2a20`), modulado por um pontilhado de 1 mm (`ruido(p·1000)`, que dá o aspecto raspado);
rugosidade sobe para ~0,85; a normal recebe o gradiente do pontilhado com força 0,25, com o
mesmo esmaecimento por distância que os poros já usam (0,4–1,1 m), porque de longe vira
cintilação.

**Sobrancelhas.** Dois elipsoides, um por olho, centro em `olho + (0, 0,022, 0,022)`, raios
`(0,026, 0,006, 0,020)`, girados 8° em torno de z para a ponta externa (maior |x|) ficar mais
alta. Máscara geométrica `1 − smoothstep(0,8, 1,0, d)` com `d` a distância normalizada ao
elipsoide. No shader, fios: `ruido(vec3(x·90, y·1600, z·90))` (alta frequência só em y = fios
deitados no sentido lateral) modula a máscara em `0,55 + 0,45·fios`. Cor mistura 90 % para o
mesmo castanho; normal inclinada pelo gradiente do ruído dos fios com força 0,3.

**Pelos do corpo (sugestão).** Três faixas com bordas suaves de 2 cm:

| Faixa | y (m) | condição extra |
|---|---|---|
| peito | 1,15–1,36 | z > 0,10 (frente) e \|x\| < 0,14 |
| antebraços | 0,80–1,05 | \|x\| > 0,20 (braços ao lado do corpo no atlas) |
| pernas abaixo do joelho | 0,08–0,40 | — |

Dentro da faixa: densidade `smoothstep(0,45, 0,70, fbm(p·40))` e pontilhado
`step(0,72, ruido(p·900))`. Escurecimento máximo de 10 % e rugosidade +0,10. É sugestão, não pelo.

### 3.3 `pele.ts`

Passa a concatenar `GLSL_PELOS` depois de `GLSL_RUIDO` e usa as três funções nos três
pontos de injeção existentes (`color_fragment`, `roughnessmap_fragment`,
`normal_fragment_maps`). `customProgramCacheKey()` devolve `'pele-procedural-v2'`. O arquivo
continua abaixo de 200 linhas; a lógica dos pelos não mora nele.

## 4. Tratamento de erros

Não há caminho de erro em tempo de execução: são constantes num shader que já compila. O
risco é de **drift silencioso**: se o pipeline mudar a posição do globo ou da pele, as
máscaras ficam no lugar errado sem ninguém avisar. O teste da seção 5 existe para isso.

## 5. Testes

**Unitários (Vitest, sem WebGL), `pelos.test.ts`:**

- Máscaras geométricas em pontos conhecidos (metros):

  | Ponto | Coordenadas | Couro cabeludo | Sobrancelha | Corpo |
  |---|---|---|---|---|
  | topo da cabeça | (0, 1,630, 0,080) | ≥ 0,9 | 0 | 0 |
  | nuca | (0, 1,500, −0,005) | ≥ 0,9 | 0 | 0 |
  | testa acima da sobrancelha | (0, 1,575, 0,185) | ≤ 0,1 | 0 | 0 |
  | bochecha | (0,05, 1,490, 0,150) | 0 | 0 | 0 |
  | orelha | (0,075, 1,525, 0,085) | 0 | 0 | 0 |
  | centro da sobrancelha esquerda | (0,029, 1,540, 0,178) | 0 | ≥ 0,9 | 0 |
  | centro da sobrancelha direita | (−0,029, 1,540, 0,178) | 0 | ≥ 0,9 | 0 |
  | centro do olho | (0,029, 1,518, 0,156) | 0 | 0 | 0 |
  | peito | (0, 1,300, 0,120) | 0 | 0 | 1 |
  | abdômen | (0, 1,100, 0,120) | 0 | 0 | 0 |
  | antebraço | (0,28, 0,920, 0,090) | 0 | 0 | 1 |
  | coxa | (0,10, 0,700, 0,100) | 0 | 0 | 0 |
  | canela | (0,10, 0,300, 0,100) | 0 | 0 | 1 |

- Marcos contra o manifesto: lê `apps/web/public/models/manifest.json`; o centro de
  `FMA12515` tem de estar a menos de 2 mm de `MARCOS.olhoEsquerdo` e o `bbox.max.y` da pele a
  menos de 5 mm de `MARCOS.topoPele`. Se o manifesto não existir (clone sem `construir`), o
  teste **pula com mensagem explícita**; o portão de verdade é o E2E, que exige os modelos.
- `materiais.test.ts` ganha uma linha: a chave do programa da pele contém `v2`.

**E2E (Playwright, pixel real), `pelos.spec.ts`**, pulado abaixo de 500 px de largura como o
teste do olho:

1. Close do olho esquerdo (mesmo caminho do `olho.spec.ts`: buscar, clicar, câmera `livre`). A
   câmera é determinística (`enquadrar` do globo = 0,3 m de distância, FOV vertical 40°), então
   cada faixa é um ponto do mundo sobre a pele projetado em linhas da captura pela mesma conta
   que a câmera faz, sem calibração à mão. Três faixas na coluna central: **sobrancelha** (2,2 cm
   acima do olho), **testa** (entre a sobrancelha e a linha do cabelo) e **couro cabeludo** (1,7 cm
   acima da linha do cabelo). Sobrancelha e couro cabeludo têm luminância média pelo menos 25
   unidades (escala 0–255) abaixo da testa; a testa está acima de 100 (controle: a pele está
   iluminada, não está tudo escuro).
2. Precondições que reprovam alto em vez de medir a coisa errada: as três faixas caem dentro do
   canvas, e uma janela vazia devolve NaN, não zero. A captura na Mesa serve para confirmar a olho
   que as faixas caem onde o nome diz.
3. Captura de cada cena salva como artefato do teste e uma cópia na Mesa (`~/Desktop/corpo3d-pelos-*.png`)
   para inspeção humana. Capturas em pastas temporárias do sistema são ilegíveis para o revisor.

**Portão de desempenho:** o preset frente continua acima de 55 fps na máquina de
desenvolvimento (a fase 1.5 mediu 61 fps com a sombra). Medido uma vez, à mão, antes do merge.

## 6. Execução

Três tarefas, um subagente por vez (teto de 3, sem subdivisão), correções triviais pelo
controlador:

1. `pelos.ts` (marcos, ajuste, máscaras TS) + `pelos.test.ts` — TDD.
2. `GLSL_PELOS` + integração em `pele.ts` + ajuste visual por captura (Mesa).
3. `pelos.spec.ts` com as janelas medidas + medição de fps + capturas finais.

Estimativa: **US$15-25**. Branch `feat/pelos-shader`, merge na `main` com `--no-ff`.

## 7. Riscos

- **Chapado de perto.** É cor e bump, não volume. Se incomodar, a abordagem B (casca
  geométrica extraída da pele no pipeline, 4–6 camadas com recorte por ruído) entra como
  upgrade; estimada em US$40-55.
- **Linha do cabelo errada.** As três alturas são chute anatômico sobre os marcos; o ajuste é
  visual, por captura, e mora em `AJUSTE`. O teste unitário fixa a geometria escolhida, não a
  "certa".
- **Custo no fragmento.** Três avaliações de ruído a mais só nos fragmentos da pele acima de
  1,40 m e nas três faixas; fora delas, um `if` barato. O portão de fps pega regressão.
