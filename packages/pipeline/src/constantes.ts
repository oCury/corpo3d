import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Sistema } from './catalogo';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = resolve(AQUI, '..', '..', '..'); // corpo3d/
export const DIR_CACHE = resolve(RAIZ, '.cache', 'bp3d');
export const CSV_ESTRUTURAS = resolve(RAIZ, 'conteudo', 'estruturas.csv');
export const DIR_SAIDA = resolve(RAIZ, 'apps', 'web', 'public', 'models');

export const BASE_URL = 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST';
export const ZIP_NOME = 'isa_BP3D_4.0_obj_99.zip';
export const ZIP_SHA256 = '40665852c49f218326590e204db91064a1ecfc3c6f8cbd7bbbcaac62c7cd409e';
export const ZIP_BYTES = 142_903_898;
export const DIR_OBJ_NO_ZIP = 'isa_BP3D_4.0_obj_99'; // prefixo dos arquivos dentro do zip
export const TOTAL_OBJS_ESPERADOS = 2234;
export const ARQUIVOS_TEXTO = [
  'isa_parts_list_e.txt',
  'partof_parts_list_e.txt',
  'isa_element_parts.txt',
  'partof_element_parts.txt',
] as const;

export const MM_PARA_M = 0.001;
export const ERRO_SIMPLIFICACAO = 0.005;
/** Confinar na pele: vértice fora fica a esta distância para dentro; só vértices a menos de ALCANCE são tocados. */
export const FOLGA_CONFINAR_M = 0.001;
export const ALCANCE_CONFINAR_M = 0.012;
/** Peça que serve de envelope para `confinar=pele`. */
export const FMA_PELE = 'FMA7163';
export const RAZAO_PADRAO: Record<Sistema, number> = {
  pele: 0.3,
  nervoso: 0.4,
  olho: 0.6,
  esqueleto: 0.5,
  musculos: 0.5,
  cardiovascular: 0.5,
  respiratorio: 0.5,
  digestivo: 0.5,
  linfatico: 0.5,
  urinario: 0.5,
  reprodutor: 0.5,
  endocrino: 0.5,
};
export const ORCAMENTO_BYTES_POR_PECA = 1024 * 1024;
export const ORCAMENTO_BYTES_TOTAL = 30 * 1024 * 1024;
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

/** Inflar sem dobrar (spec pele-realismo §3): vértice dobrado = normal média das faces infladas discorda da normal de partida. */
export const LIMIAR_DOBRA = 0.2;
/** Reduções pela metade do deslocamento nos vértices dobrados e vizinhos (3,5 → 1,75 → 0,875 → 0,44 mm); o que ainda dobrar vai a zero. */
export const MAX_REDUCOES_DOBRA = 3;
/** Oclusão ambiente cozida por vértice (spec §4): raios por vértice, alcance e afastamento da origem para não acertar a própria face. */
export const AMOSTRAS_OCLUSAO = 48;
export const ALCANCE_OCLUSAO_M = 0.3;
export const AFASTAMENTO_RAIO_M = 0.0005;
/** Peças que recebem `_OCLUSAO`. Ligar outra é acrescentar aqui. */
export const PECAS_COM_OCLUSAO = new Set([FMA_PELE]);
/** Passar disto não falha: fica no log. */
export const ORCAMENTO_SEGUNDOS_OCLUSAO = 30;
/** Portão da oclusão (spec §5). */
export const OCLUSAO_MEDIA_MIN = 0.05;
export const OCLUSAO_MEDIA_MAX = 0.5;    // medido 0,385 na pele: coxas encostadas e braços junto ao tronco
export const OCLUSAO_MAXIMO_MIN = 0.5;
export const OCLUSAO_ALTA = 0.9;
export const OCLUSAO_FRACAO_ALTA_MAX = 0.2; // medido 11,6 % (coxas, pés): contato real; raios entrando na malha dariam > 50 %
/** Portão das normais: vértice cuja área incidente é menor que isto é lasca sub-pixel que a quantização vira sem efeito visível. */
export const AREA_MINIMA_NORMAIS_M2 = 1e-7;
/** Resíduo da quantização de 14 bits em triângulos longos e finos: medido em 24/09 até 6 por GLB (o defeito real da pele dava 2.108). */
export const NORMAIS_OPOSTAS_TOLERADAS = 20;
