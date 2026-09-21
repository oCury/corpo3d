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
