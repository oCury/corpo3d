# Corpo3D

Corpo humano 3D desmontável para educação de paciente. Spec em `docs/superpowers/specs/`.

## Rodar

    pnpm install
    pnpm --filter @corpo3d/pipeline baixar      # 143 MB do BodyParts3D, uma vez
    pnpm --filter @corpo3d/pipeline construir   # gera apps/web/public/models/ (~8 MB, ~2 min)
    pnpm --filter @corpo3d/pipeline portao      # confere orçamentos
    pnpm --filter @corpo3d/web dev              # http://localhost:3020
    pnpm --filter @corpo3d/web test:e2e         # portão da fase 0 (precisa dos modelos gerados)

## Conteúdo

`conteudo/estruturas.csv` é a lista das peças (fonte da verdade). Colunas: `fmaId, arvore,
fmaIdsExtras, excluirFmaIds, nomeLatim, nomePt, nomeLeigo, sistema, lado, vetorExplosao,
razaoSimplificacao`. Para adicionar uma peça: achar o ID em `.cache/bp3d/*_parts_list_e.txt`,
inserir a linha, reconstruir, rodar o portão.

Modelos: BodyParts3D, © The Database Center for Life Science, CC BY 4.0.

## Licença

Código sob a licença MIT (`LICENSE`). Os modelos 3D não estão no repositório: são baixados do
BodyParts3D pelo pipeline e seguem a licença CC BY 4.0 do The Database Center for Life Science,
com a atribuição exibida no app (`/atribuicao`).
