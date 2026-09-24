import { NeutralToneMapping, type ToneMapping } from 'three';

/**
 * Estúdio neutro (spec pele-realismo §7): tom fiel à cor da pele e dos órgãos, luz principal
 * branca com sombra, preenchimento fraco do lado oposto e contorno frio atrás para separar o
 * corpo do fundo escuro. Só constantes: o E2E `pelos.spec` é o oráculo de que sobrancelha e
 * couro cabeludo continuam legíveis se alguém mexer aqui.
 */
export const TOM: ToneMapping = NeutralToneMapping;
export const EXPOSICAO = 1.0;
export const HDRI_INTENSIDADE = 0.8;

export interface Luz { posicao: [number, number, number]; intensidade: number; cor: string }
export const LUZ_PRINCIPAL: Luz = { posicao: [1.5, 3, 2], intensidade: 1.2, cor: '#ffffff' };
export const PREENCHIMENTO: Luz = { posicao: [-2.5, 1.5, 2.5], intensidade: 0.35, cor: '#ffffff' };
export const CONTORNO: Luz = { posicao: [-1.5, 2.5, -2.5], intensidade: 0.6, cor: '#dfe8ff' };
