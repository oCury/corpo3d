# Corpo3D — corpo humano 3D desmontável para educação de paciente

**Data:** 2026-09-21
**Status:** aprovado em brainstorming, aguardando revisão escrita
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

- **BodyParts3D** (DBCLS, Japão): 2.234 malhas OBJ, 3.432 conceitos com ID FMA e nome em
  inglês, 15 sistemas, download em `isa_BP3D_4.0_obj_99.zip` (136 MB) e
  `partof_BP3D_4.0_obj_99.zip` (62 MB). A página oficial de licença declara
  **CC Attribution 4.0 International**, sem ShareAlike. Último update 2013/05; anatomia não
  muda, então isso não é problema. **É um corpo masculino.**
- **Z-Anatomy** é CC BY-SA 4.0 e suas definições vêm da Wikipedia (BY-SA 3.0). Malhas
  derivadas teriam de ser publicadas sob a mesma licença. Descartado como base; serve
  só como referência visual de como agrupar estruturas.
- Todas as malhas do BodyParts3D compartilham **um único sistema de coordenadas**, em
  milímetros. A posição de casa de toda peça é a identidade. É isso que torna
  "remontar" trivial.
- Nenhuma fonte aberta entrega glTF. Pipeline de conversão é obrigatório.
- Existem visualizadores abertos em Three.js sobre o BodyParts3D com camadas por sistema
  e vista explodida (o mais popular é MIT, criado em set/2026, aparentemente gerado por
  IA). Servem como referência de pipeline, **não** como fundação de código.
- Lições do Olho3D que se aplicam: o link é o dado (token opaco, nunca JWT legível);
  o médico empurra o link de dentro da própria sessão, o visualizador nunca recebe
  credencial; um canvas só no celular; renderização sob demanda; aparelho fraco cai
  para imagem estática, nunca para reload em loop.

## 3. Escopo da v1

**Entra:**

- ~200 malhas escolhidas num CSV curado: órgãos internos completos; esqueleto completo
  com mãos e pés agrupados (um GLB por mão e por pé); músculos superficiais grandes;
  grandes vasos (aorta, cavas, carótidas, femorais, pulmonares); cérebro por lobos,
  cerebelo e tronco; olho (globo, córnea, cristalino).
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
- Nervos periféricos, vasos finos, ligamentos individuais: entram como linhas novas no
  CSV em versões seguintes, sem código novo.
- Planos de corte, animação fisiológica (batimento, respiração), VR, inglês.
- Modelos premium comprados para peças "hero". Possível depois; mistura licenças.

## 4. Arquitetura

Repositório novo em `~/Projetos/corpo3d`, monorepo leve com pnpm workspaces:

```
corpo3d/
├── apps/web/                 # Next 15 + TypeScript + Prisma + Postgres
│   ├── src/app/              # rotas: /, /login, /estudio, /links, /v/[token], /atribuicao
│   ├── src/components/viewer # React Three Fiber + drei + postprocessing
│   ├── src/components/painel # descrição, busca, camadas, lista de peças
│   ├── src/lib/estado        # schema Zod do estado da cena, serialização, undo
│   ├── src/lib/materiais     # um material físico por sistema
│   └── public/models/<sistema>/<fmaId>.glb + manifest.json (gerados)
├── packages/pipeline/        # scripts Node: baixar, filtrar, converter, comprimir, manifestar
├── conteudo/
│   ├── estruturas.csv        # fonte da verdade das ~200 partes
│   └── descricoes/<fmaId>.md # três blocos + frontmatter de revisão
└── docs/superpowers/specs/
```

Pilha igual à do AgendaHora e do Olho3D para a ponte futura custar pouco.
Hospedagem: Vercel para o app e os GLBs estáticos, Postgres gerenciado. A VM da Magalu
foi descartada para não misturar com o AgendaHora.

### 4.1 Pipeline de assets (`packages/pipeline`)

Sem Blender. Etapas, cada uma um script separado, idempotente, com cache em
`packages/pipeline/.cache/`:

1. **baixar**: os dois zips do BodyParts3D e as listas `isa_parts_list_e.txt` e
   `partof_parts_list_e.txt`. Verifica tamanho e SHA-256 gravados no repo.
2. **filtrar**: lê `conteudo/estruturas.csv`, resolve cada `fmaId` para o OBJ
   correspondente. Falha alto se algum `fmaId` do CSV não existir no zip.
3. **converter**: OBJ → glTF com `obj2gltf`. Escala 0,001 (mm → m) para a iluminação
   física do three.js funcionar. Os OBJ não trazem normais: calcular normais suaves com
   limiar de 60°.
4. **otimizar**: `@gltf-transform` para soldar vértices, simplificar com meshoptimizer
   até ≤ 40 mil triângulos por peça (razão ajustável por sistema no CSV), e comprimir
   com meshopt. Sem texturas: os materiais são procedurais em código.
5. **manifestar**: gera `public/models/manifest.json` com, por peça: `fmaId`,
   `nomeLatim`, `nomePt`, `nomeLeigo`, `sistema`, `paiFmaId`, `lado`, `glb`, `bbox`,
   `centro`, `vetorExplosao`, `triangulos`, `bytes`. O `vetorExplosao` padrão é o
   vetor normalizado do centro do corpo ao centro da peça, ponderado por sistema
   (órgãos 1,0; ossos 0,6; músculos 1,2); o CSV pode sobrescrever.

Orçamentos, verificados por teste: ≤ 500 KB por GLB, ≤ 60 MB no total da v1.

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
- Contorno de hover e destaque por `Outline`/`Select` do postprocessing.

### 4.3 Estado da cena

Um único objeto, validado por Zod, é a fonte da verdade da interface, do undo e do link:

```ts
{
  v: 1,
  sistemasVisiveis: string[],
  opacidade: Record<sistema, number>,      // 0–1
  ocultas: fmaId[],
  soltas: { fmaId, pos: [x, y, z] }[],     // peças desmontadas, em metros
  destacadas: { fmaId, cor }[],
  notas: { fmaId, texto }[],               // texto ≤ 280 caracteres
  isolada: fmaId | null,
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
| 0 | Pipeline + `estruturas.csv` + manifesto | 200 GLBs abrem num visualizador mínimo; total < 60 MB | 2-3 dias |
| 1 | Visualizador desktop completo (seções 4.2, 4.3, 5) | E2E de desmontar/encaixar/explodir passa | 1-2 semanas |
| 2 | Login, gerar link, snapshot, lista, revogação | E2E de link passa; revogado dá 404 | 3-4 dias |
| 3 | Celular e fallback | Roda em iPhone 12 e Galaxy A54; fallback dispara em aparelho fraco | 3-4 dias |
| 4 | Conteúdo revisado | 100% das ~200 peças com `status: revisado` | depende do médico revisor (~200 × 5 min) |
| 5 | Ponte com o AgendaHora | spec próprio | fora deste documento |

Estimativas são de esforço de desenvolvimento, não de calendário.

## 12. Riscos

- **Malhas de 2013** têm regiões toscas. Mitigação: normais suaves e simplificação
  cuidadosa; aceitar que o realismo é de atlas bem iluminado, não de cinema.
- **Corpo só masculino** na v1. Metade dos pacientes não se vê no modelo. Declarado na
  interface; atlas feminino é candidato para versão seguinte.
- **Conteúdo é o gargalo**: 200 peças × 3 blocos exigem revisão médica. A regra
  "só revisado vai ao paciente" garante que o produto não mente enquanto isso.
- **Nota livre do médico** pode conter dado de paciente apesar do aviso. Mitigação na
  v1: aviso; versão seguinte pode bloquear padrões de CPF e e-mail.
- **Olho do Olho3D** pode não importar fácil. Portão de um dia na fase 1.
