# Corpo3D — corpo humano 3D desmontável para educação de paciente

**Data:** 2026-09-21
**Status:** aprovado em 2026-09-21; seção 2 e escopo corrigidos após verificação dos dados reais (mesmo dia)
**Nome de trabalho:** Corpo3D (na linha do Olho3D)

## 1. Propósito

Ferramenta com que o médico, na consulta, desmonta um corpo humano 3D até a parte que
interessa, aponta, explica, e gera um link que o paciente abre depois no celular com a cena
salva e uma descrição leiga da parte. O objetivo é o paciente entender o próprio quadro;
não é atlas para estudante nem ferramenta de diagnóstico.

Decisões tomadas no brainstorming (2026-09-21):

| Decisão | Escolha | Alternativas descartadas |
|---|---|---|
| Público | Educação de paciente | Ensino de anatomia, produto de consumo, portfólio |
| Operação | Médico mostra na consulta **e** gera link para o paciente | Só consulta, só link, sala de espera |
| Relação com AgendaHora | Produto separado, ponte JWT numa fase futura | Módulo dentro do ERP, separado sem ponte nunca |
| Profundidade | ~200 malhas na v1, cresce por sistema | Atlas completo desde o início, só 60-80 estruturas |
| Descrições | Português leigo + nome técnico | Português técnico, PT + EN |
| Fonte dos modelos | BodyParts3D (CC BY 4.0) | Z-Anatomy (CC BY-SA 4.0), modelos comprados, IA generativa |

## 2. Fatos verificados que sustentam o desenho

- **BodyParts3D** (DBCLS, Japão). A página oficial de licença declara
  **CC Attribution 4.0 International**, sem ShareAlike. Último update 2013/05; anatomia não
  muda, então isso não é problema. **É um corpo masculino.** ⚠ O cabeçalho de cada `.obj`
  ainda traz o texto da licença antiga (CC BY-SA 2.1 JP); vale a página oficial, e o repo
  guarda uma cópia datada dela em `docs/licenca-bodyparts3d.md`.
- **Estrutura real dos dados (verificada em 2026-09-21):**
  - Um único zip basta: `isa_BP3D_4.0_obj_99.zip` (142.903.898 bytes, SHA-256
    `40665852c49f218326590e204db91064a1ecfc3c6f8cbd7bbbcaac62c7cd409e`) contém **2.234
    arquivos-elemento** `isa_BP3D_4.0_obj_99/FJ####.obj` (241 deles com sufixo `M`, cópias
    espelhadas). O zip `partof` (1.258 arquivos) é subconjunto com geometria idêntica; só o
    cabeçalho de comentário difere.
  - Um **conceito** (ID FMA, ex. `FMA7088` coração) é a **união de vários elementos**: o
    coração tem 83, o fígado 60, o crânio 43. O mapeamento conceito → elementos está em
    dois arquivos tab-delimitados (`concept id`, `name`, `element file id`):
    `partof_element_parts.txt` (1.368 conceitos, é o que tem coração, fígado, cérebro,
    mãos, pés) e `isa_element_parts.txt` (2.905 conceitos, é o que tem baço, músculos dos
    membros, testículos, nervo óptico). O pipeline consulta os dois.
  - OBJ: `v x y z` em **milímetros, eixo Z para cima**, origem perto do chão (pele vai de
    z = −78 a 1.641 mm); `+x` é a **esquerda do paciente**; a frente do corpo está em `−y`.
    Traz `vn` (descartadas: recalculamos) e faces `f a//b c//d e//f`, triângulos.
    Conversão para o three.js: `(x, y, z) → (x·0,001, z·0,001, −y·0,001)`.
  - Os dois conjuntos compartilham o mesmo sistema de coordenadas (baço do IS-A cai à
    esquerda do fígado do PART-OF, deltoide do IS-A envolve o úmero do PART-OF).
- **Lacunas do BodyParts3D que limitam a v1** (não existem em nenhuma das duas árvores):
  tireoide, laringe, faringe, cólon sigmoide, cóccix, esfenoide como osso avulso (está
  dentro dos elementos sem nome do crânio), parótida, pênis; músculos **latíssimo do dorso,
  reto abdominal, masseter, temporal**. Deltoide, trapézio, bíceps, tríceps e gastrocnêmio
  existem só como partes/cabeças e são agrupados numa peça pelo CSV.
- **Resultado do ensaio do pipeline (2026-09-21):** as 251 peças do CSV convertem sem
  falha para **8,9 MB no total** (2,04 milhões de triângulos); só crânio e intercostais
  passavam de 500 KB e receberam razão de simplificação própria.
- **Z-Anatomy** é CC BY-SA 4.0 e suas definições vêm da Wikipedia (BY-SA 3.0). Malhas
  derivadas teriam de ser publicadas sob a mesma licença. Descartado como base; serve
  só como referência visual de como agrupar estruturas.
- Todas as malhas compartilham **um único sistema de coordenadas**. A posição de casa de
  toda peça é a identidade. É isso que torna "remontar" trivial. ⚠ `meshopt()` do
  gltf-transform quantiza as posições e move a escala para a matriz do nó: o GLB carregado
  no three.js tem um nó filho com essa matriz; a peça é o grupo pai, cuja posição continua
  sendo zero. `bbox` e `centro` do manifesto são calculados **antes** da quantização.
- Nenhuma fonte aberta entrega glTF. Pipeline de conversão é obrigatório. `normals()` do
  gltf-transform **desolda** a malha para gerar normais planas; as normais suaves são
  calculadas por código próprio (ponderadas por área) depois de `weld()` e `simplify()`.
- Existem visualizadores abertos em Three.js sobre o BodyParts3D com camadas por sistema
  e vista explodida (o mais popular é MIT, criado em set/2026, aparentemente gerado por
  IA). Servem como referência de pipeline, **não** como fundação de código.
- Lições do Olho3D que se aplicam: o link é o dado (token opaco, nunca JWT legível);
  o médico empurra o link de dentro da própria sessão, o visualizador nunca recebe
  credencial; um canvas só no celular; renderização sob demanda; aparelho fraco cai
  para imagem estática, nunca para reload em loop.

## 3. Escopo da v1

**Entra:**

- **251 peças** já escolhidas em `conteudo/estruturas.csv` (gerado por
  `conteudo/gerar-estruturas.py`, depois editado à mão): pele 1 · esqueleto 79 (crânio sem
  mandíbula, mandíbula, hioide, 24 vértebras, sacro, esterno, 24 costelas, cartilagens
  costais por lado, membros osso a osso, mãos e pés como um bloco cada) · músculos 54 ·
  cardiovascular 43 · nervoso 19 (lobos por lado, cerebelo, tronco, diencéfalo, corpo
  caloso, medula, nervos ópticos) · digestivo 17 · olho 16 (córnea, esclera, íris,
  cristalino, vítreo, coroide, músculos do olho, glândula lacrimal, por lado) ·
  reprodutor 7 · respiratório 5 · urinário 5 · endócrino 3 · linfático 2.
- Camadas por sistema com opacidade; seleção com painel de descrição; desmontar por
  arrasto com fantasma no lugar de origem; encaixe por raio; explodir e remontar tudo;
  desfazer/refazer; anotação do médico (destaque + nota curta); busca por nome; presets
  de câmera.
- Login do médico; geração de link com estado salvo; snapshot PNG; lista e revogação de
  links; página do paciente só leitura, responsiva, com fallback estático.
- Conteúdo: nome leigo, nome em português (Terminologia Anatômica), nome em latim (TA2),
  três blocos de descrição leiga por parte, com status de revisão.

**Fica de fora (explicitamente):**

- Qualquer identificação de paciente (nome, CPF, prontuário). O link não sabe quem é o
  paciente.
- Ponte com o AgendaHora (fase 5, spec próprio).
- Corpo feminino. O BodyParts3D é masculino. Candidato para depois: Human Reference
  Atlas (HuBMAP) feminino, CC BY 4.0, 1.220 estruturas; verificar antes de prometer.
- As estruturas ausentes no BodyParts3D (lista na seção 2). Se um médico pedir uma delas,
  a resposta é compra de modelo avulso ou outro atlas, não este pipeline.
- Nervos periféricos, vasos finos, ligamentos individuais: entram como linhas novas no
  CSV em versões seguintes, sem código novo.
- Planos de corte, animação fisiológica (batimento, respiração), VR, inglês.
- Modelos premium comprados para peças "hero". Possível depois; mistura licenças.

## 4. Arquitetura

Repositório novo em `~/Projetos/corpo3d`, monorepo leve com pnpm workspaces. O ensaio de
2026-09-21 provou: **Next 15 do rascunho vira Next 16**, porque o AgendaHora já está em 16.3.

```
corpo3d/
├── apps/web/                 # Next 16 + TypeScript + Prisma 5 + Postgres (mesmas versões do AgendaHora)
│   ├── src/app/              # rotas: /, /login, /estudio, /links, /v/[token], /atribuicao
│   ├── src/components/viewer # React Three Fiber + drei + postprocessing
│   ├── src/components/painel # descrição, busca, camadas, lista de peças
│   ├── src/lib/estado        # schema Zod do estado da cena, serialização, undo
│   ├── src/lib/materiais     # um material físico por sistema
│   └── public/models/<sistema>/<fmaId>.glb + manifest.json (gerados, ignorados pelo git)
├── packages/pipeline/        # scripts Node: baixar, catalogar, converter, comprimir, manifestar
├── conteudo/
│   ├── estruturas.csv        # fonte da verdade das 251 peças
│   ├── gerar-estruturas.py   # proveniência: gerou a versão inicial do CSV
│   └── descricoes/<fmaId>.md # três blocos + frontmatter de revisão
└── docs/superpowers/specs/
```

Pilha igual à do AgendaHora (Next 16.3, React 19.2, Prisma 5.22, next-auth 5 beta, Zod 4) para a ponte futura custar pouco.
Hospedagem: Vercel para o app e os GLBs estáticos, Postgres gerenciado. A VM da Magalu
foi descartada para não misturar com o AgendaHora.

### 4.1 Pipeline de assets (`packages/pipeline`)

Sem Blender. Etapas, cada uma um script separado, idempotente, com cache em
`packages/pipeline/.cache/`:

1. **baixar**: o zip `isa_BP3D_4.0_obj_99.zip` e os quatro arquivos de texto
   (`isa_parts_list_e.txt`, `partof_parts_list_e.txt`, `isa_element_parts.txt`,
   `partof_element_parts.txt`) para `.cache/bp3d/`. Verifica o SHA-256 gravado no código;
   não baixa de novo se já confere.
2. **catalogar**: lê os dois `*_element_parts.txt` em mapas `fmaId → Set<elemento>`; lê
   `conteudo/estruturas.csv`. Para cada linha, o conjunto de elementos é
   `elementos(fmaId) ∪ elementos(fmaIdsExtras) − elementos(excluirFmaIds)`, consultando
   primeiro a árvore da coluna `arvore` e depois a outra. Falha alto se um ID não existir
   em nenhuma das duas ou se o conjunto ficar vazio.
3. **converter**: parser OBJ próprio (só `v` e `f`; ~30 linhas), que concatena os elementos
   de uma peça numa única malha com deslocamento de índices, e converte
   `(x, y, z) → (x·0,001, z·0,001, −y·0,001)`.
4. **otimizar**: `@gltf-transform` 4.5 — `weld()`, `simplify({ simplifier: MeshoptSimplifier,
   ratio, error: 0.005 })`, normais suaves por código próprio, `prune()`,
   `meshopt({ encoder: MeshoptEncoder })`. A razão vem da coluna `razaoSimplificacao` ou do
   padrão por sistema (pele 0,3; nervoso 0,4; olho 0,6; resto 0,5). Sem texturas: os
   materiais são procedurais em código.
5. **manifestar**: gera `public/models/manifest.json` com, por peça: `fmaId`,
   `nomeLatim`, `nomePt`, `nomeLeigo`, `sistema`, `paiFmaId`, `lado`, `glb`, `bbox`,
   `centro`, `vetorExplosao`, `triangulos`, `bytes`. O `vetorExplosao` padrão é o
   vetor normalizado do centro do corpo ao centro da peça, ponderado por sistema
   (órgãos 1,0; ossos 0,6; músculos 1,2); o CSV pode sobrescrever.

Orçamentos, verificados por teste: ≤ 500 KB por GLB, ≤ 30 MB no total da v1 (o ensaio deu 8,9 MB).

### 4.2 Visualizador

- React Three Fiber com `frameloop="demand"`: só renderiza quando algo muda.
- Um `<Peca>` por malha, carregado por sistema sob demanda (`useGLTF` com meshopt
  decoder). Sistemas fora da tela não são baixados.
- Um material físico por sistema (`MeshPhysicalMaterial`): osso fosco com leve
  subsuperfície; músculo com normal map procedural de fibras; órgãos com clearcoat e
  cor por órgão; artérias vermelhas e veias azuis por convenção; nervos amarelos.
  Iluminação por HDRI de estúdio (`Environment` do drei), oclusão ambiente em tela e
  tone mapping ACES via `@react-three/postprocessing`. Realismo vem daqui, não da malha.
- Olho: a v1 usa as malhas do BodyParts3D. Substituir pelo modelo do Olho3D é uma
  tarefa da fase 1 **com portão**: se importar exigir mais de um dia, fica para depois.
- Hover e seleção por **brilho emissivo** no material da peça (0,18 e 0,30), destaque do médico
  por emissivo colorido (0,45). ⚠ Registrado na fase 1 (21/09): `Outlines` do drei e o
  contorno por pós-processamento não servem com a geometria quantizada dos GLBs (o contorno
  sai em unidades locais e some; em espaço de tela, a casca atravessa a malha de duas faces e
  mancha o corpo). Oclusão ambiente (N8AO) ficou como tarefa opcional, não executada.

### 4.3 Estado da cena

Um único objeto, validado por Zod, é a fonte da verdade da interface, do undo e do link:

```ts
{
  v: 1,
  opacidade: Record<sistema, number>,      // 0–1; 0 = sistema oculto e não carregado (substitui o antigo sistemasVisiveis)
  ocultas: fmaId[],
  soltas: { fmaId, pos: [x, y, z] }[],     // peças desmontadas, em metros
  destacadas: { fmaId, cor }[],
  notas: { fmaId, texto }[],               // texto ≤ 280 caracteres
  isolada: fmaId | null,
  explosao: number,                        // 0–1, deslizante de explosão
  camera: { pos: [x, y, z], alvo: [x, y, z] }
}
```

Undo/redo é uma pilha de até 50 snapshots desse objeto. Gerar link é serializar esse
objeto. Abrir link é desserializar e aplicar.

## 5. Interação

- **Camadas:** um controle por sistema com opacidade deslizante. Opacidade 0 equivale a
  oculto e não carrega o sistema.
- **Seleção:** hover contorna; clique abre o painel (nome leigo em destaque, nome
  português e latim abaixo, três blocos); duplo clique isola (o resto vai a 10% de
  opacidade). Escape sai da isolação.
- **Desmontar por arrasto:** ao arrastar uma peça (pointer down + movimento > 4 px),
  o cursor move a peça num plano paralelo à câmera que passa pelo centro dela. Ao
  soltar a mais de 3 cm (0,03 m) da posição de casa, a peça fica solta e um
  **fantasma** (mesma malha, wireframe translúcido) marca a posição de casa.
- **Remontar por arrasto:** soltar dentro do raio de 3 cm encaixa com easing de 250 ms.
- **Explodir:** move toda peça visível ao longo do `vetorExplosao` por uma distância
  proporcional ao deslizante "explosão" (0 a 0,4 m), animado. Explodir não marca as
  peças como soltas; é um estado de visualização à parte, também salvo no link.
- **Remontar tudo:** anima todas as peças soltas de volta a zero e zera a explosão.
- **Anotação do médico:** escolher uma cor de destaque para a peça e escrever uma nota
  de até 280 caracteres, que aparece ancorada à peça. Campo exibe o aviso: "Não escreva
  nome, CPF ou dados que identifiquem o paciente."
- **Busca:** campo que filtra por nome leigo, português ou latim; selecionar foca a
  câmera e abre o painel.
- **Câmera:** órbita; presets frente, costas, esquerda, direita, superior; "recentrar".
- **Acessibilidade:** lista de peças navegável por teclado com as mesmas ações do
  clique; `prefers-reduced-motion` desliga as animações de encaixe e explosão (o estado
  final é aplicado de imediato); contraste verificado por axe.

## 6. Link do paciente e segurança

- Login do médico por e-mail e senha (NextAuth, credenciais, bcrypt). Sem auto-cadastro:
  um script de seed cria os médicos, como no AgendaHora. Papéis: `medico`, `admin`.
- **Gerar link** grava `Apresentacao { token, estado, snapshot, expiraEm, revogadaEm,
  aberturas, criadaPor, criadaEm }`. O token tem 16 caracteres base62 gerados por
  `crypto.randomBytes` (≥ 95 bits). Validade escolhida entre 30, 90 (padrão) e 180 dias.
- **Snapshot:** o navegador do médico força um render e lê o canvas no mesmo quadro
  (sem `preserveDrawingBuffer`), gera WebP 1280×720 ≤ 300 KB, enviado junto com o
  estado. Serve de pôster enquanto os GLBs carregam (o que também resolve o LCP), de
  prévia no e-mail e de fallback para aparelho fraco.
- **`/v/[token]`:** só leitura, sem sessão, responde 404 para token inexistente,
  expirado ou revogado (sem distinguir os casos). Limite de 60 requisições por minuto
  por IP. Incrementa `aberturas`. Não há campo de paciente em lugar nenhum; o único
  texto livre é a nota do médico.
- **`/links`:** lista as apresentações do médico com data, aberturas e botão revogar.
- Rodapé fixo em toda página de paciente: "Material educativo. Não substitui consulta
  nem orientação do seu médico."
- Página `/atribuicao` com o texto exigido: "BodyParts3D, © The Database Center for
  Life Science licensed under CC Attribution 4.0 International".
- Cabeçalhos: CSP com nonce, HSTS, `X-Frame-Options: DENY` em tudo menos `/v/*`
  (que fica `SAMEORIGIN` para permitir embutir no futuro).

## 7. Celular

- Layout de um canvas só, ocupando a largura, com o painel de descrição abaixo; sem
  a barra de camadas do médico (o paciente vê o que o médico salvou e pode orbitar,
  tocar em peças e ler; não edita).
- `dpr` limitado a 1,5; sem texturas em arquivo; meshopt; carrega só os sistemas
  visíveis no estado salvo.
- Detecção de aparelho fraco: falha ao criar contexto WebGL2, ou média dos 10 primeiros
  quadros acima de 100 ms. Nesses casos mostra o snapshot com a descrição, sem tentar
  de novo.

## 8. Conteúdo

- `conteudo/estruturas.csv`: colunas `fmaId, nomeLatim, nomePt, nomeLeigo, sistema,
  paiFmaId, lado, vetorExplosao, razaoSimplificacao`. Nome em latim vem da TA2 da FIPAT
  (acesso aberto), não do CSV do Z-Anatomy.
- `conteudo/descricoes/<fmaId>.md`, frontmatter `status: rascunho | revisado`,
  `revisadoPor`, `revisadoEm`, corpo com três títulos fixos: **O que é**, **O que faz**,
  **O que costuma dar errado**. Cada bloco com 3 a 5 frases de até 25 palavras, sem
  números clínicos, sem percentuais, sem diagnóstico, sem indicação de tratamento.
- Produção: um script gera rascunhos por LLM dentro desse template travado; o médico
  revisa e muda o status por PR. Um teste falha se um arquivo `revisado` tiver bloco
  faltando ou fora do limite.
- **Regra dura:** `/v/[token]` só exibe descrição `revisado`. Uma peça sem descrição
  revisada mostra só os nomes. No `/estudio`, rascunhos aparecem com tarja "rascunho".

## 9. Tratamento de erros

- Pipeline falha alto e cedo: `fmaId` ausente, checksum errado, GLB acima do orçamento.
- GLB que não carrega no visualizador: a peça some da cena, o painel mostra "peça
  indisponível", e um evento vai para o log; o restante continua.
- Estado de link inválido (schema Zod rejeita, por exemplo por versão antiga): página
  mostra o snapshot e a descrição, sem canvas, com aviso discreto.
- Falha de rede ao gerar link: mensagem clara, estado permanece no cliente, tentar de
  novo não duplica (idempotência por hash do estado + médico + minuto).

## 10. Testes

- **Unitários (Vitest):** manifesto válido; todo `fmaId` do CSV tem GLB e vice-versa;
  orçamentos de tamanho; ida e volta do estado (serializar → desserializar → igual);
  geração de token (comprimento, alfabeto, unicidade em 10 mil amostras); validação dos
  markdowns revisados.
- **E2E (Playwright):** abrir o estúdio, buscar "fígado", clicar, ler o painel; arrastar
  uma peça para fora e ver o fantasma; arrastar de volta e encaixar; explodir e remontar
  tudo; gerar link; abrir `/v/<token>` em 375 px e ver o pôster, depois o canvas;
  token revogado responde 404. Screenshots em 320, 768 e 1440.
- **Acessibilidade:** axe nas páginas `/estudio` e `/v/[token]`; navegação por teclado
  da lista de peças.
- **Performance:** Lighthouse em `/v/[token]` com LCP < 2,5 s (o pôster garante isso) e
  CLS < 0,1.

## 11. Fases e portões

| Fase | Entrega | Portão para seguir | Estimativa |
|---|---|---|---|
| 0 | Pipeline + `estruturas.csv` + manifesto + visualizador mínimo | 251 GLBs abrem; total < 30 MB | 2-3 dias |
| 1 | Visualizador desktop completo (seções 4.2, 4.3, 5) | E2E de desmontar/encaixar/explodir passa | 1-2 semanas |
| 2 | Login, gerar link, snapshot, lista, revogação | E2E de link passa; revogado dá 404 | 3-4 dias |
| 3 | Celular e fallback | Roda em iPhone 12 e Galaxy A54; fallback dispara em aparelho fraco | 3-4 dias |
| 4 | Conteúdo revisado | 100% das 251 peças com `status: revisado` | depende do médico revisor (~251 × 5 min) |
| 5 | Ponte com o AgendaHora | spec próprio | fora deste documento |

Estimativas são de esforço de desenvolvimento, não de calendário.

## 12. Riscos

- **Malhas de 2013** têm regiões toscas. Mitigação: normais suaves e simplificação
  cuidadosa; aceitar que o realismo é de atlas bem iluminado, não de cinema.
- **Corpo só masculino** na v1. Metade dos pacientes não se vê no modelo. Declarado na
  interface; atlas feminino é candidato para versão seguinte.
- **Conteúdo é o gargalo**: 251 peças × 3 blocos exigem revisão médica. Até a fase 4, o painel
  mostra "Descrição em revisão médica" nos três blocos.
- **Peça semitransparente (< 50%) não recebe clique nem hover**: o raio passa para a peça de trás
  (filtro de hits do R3F). Decisão da fase 1 para a pele "descascada pela metade" não bloquear os
  órgãos.
- **E2E é pesado em GPU**: cada teste abre um Chromium com WebGL e 251 GLBs; a suíte roda com
  2 workers e tolera recusas de captura de tela do Chromium como "ainda não pronto". A regra
  "só revisado vai ao paciente" garante que o produto não mente enquanto isso.
- **Nota livre do médico** pode conter dado de paciente apesar do aviso. Mitigação na
  v1: aviso; versão seguinte pode bloquear padrões de CPF e e-mail.
- **Olho do Olho3D** pode não importar fácil. Portão de um dia na fase 1.
