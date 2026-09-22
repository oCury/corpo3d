import { Color, DoubleSide, MeshPhysicalMaterial, Vector3, type WebGLProgramParametersWithUniforms } from 'three';
import { literalGlsl as f } from './glsl';
import { AJUSTE, GLSL_PELOS } from './pelos';

/** Ruído de valor 3D barato (hash + interpolação suave), em GLSL, e os utilitários de relevo que dependem dele. */
const GLSL_RUIDO = /* glsl */ `
float hashPele(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ruidoPele(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hashPele(i), hashPele(i + vec3(1,0,0)), f.x), mix(hashPele(i + vec3(0,1,0)), hashPele(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hashPele(i + vec3(0,0,1)), hashPele(i + vec3(1,0,1)), f.x), mix(hashPele(i + vec3(0,1,1)), hashPele(i + vec3(1,1,1)), f.x), f.y), f.z);
}
/** Três oitavas; amplitude máxima 0,875 (0,5 + 0,25 + 0,125). */
float fbmPele(vec3 p) { return 0.5 * ruidoPele(p) + 0.25 * ruidoPele(p * 2.03) + 0.125 * ruidoPele(p * 4.11); }
/**
 * Altura do microrrelevo. Cada oitava gira os eixos (matriz ortonormal) porque o ruído de valor
 * tem células alinhadas aos eixos: somar oitavas sem girar produz uma trama regular de tecido.
 */
const mat3 GIRO_PELE = mat3(0.8, 0.6, 0.0, -0.36, 0.48, 0.8, 0.48, -0.64, 0.6);
float alturaPele(vec3 p) {
  return 0.55 * ruidoPele(p) + 0.30 * ruidoPele(GIRO_PELE * p * 2.17 + 3.1) + 0.15 * ruidoPele(GIRO_PELE * GIRO_PELE * p * 4.73 + 9.2);
}
/** Gradiente do ruído por diferenças finitas (espaço de mundo escalado). */
vec3 gradienteRuidoPele(vec3 P, float e) {
  float h0 = ruidoPele(P);
  return vec3(ruidoPele(P + vec3(e, 0.0, 0.0)) - h0, ruidoPele(P + vec3(0.0, e, 0.0)) - h0, ruidoPele(P + vec3(0.0, 0.0, e)) - h0) / e;
}
/** Inclina a normal (espaço de vista) pela componente tangencial de um gradiente em espaço de mundo. */
vec3 inclinarNormalPele(vec3 n, vec3 gradMundo, float forca) {
  vec3 gv = mat3(viewMatrix) * gradMundo;
  gv -= n * dot(n, gv);
  return normalize(n - gv * forca);
}
`;

/**
 * Coeficientes do detalhe. Posição em METROS, então frequência = ciclos por metro:
 * 420 ≈ 2,4 mm (relevo fino), 220 ≈ 4,5 mm (brilho), 60 ≈ 17 mm (mancha), 25 ≈ 40 mm (vaso).
 */
const FREQ_PORO = 420;
const FORCA_BUMP = 0.13;
const FREQ_RUGOSIDADE = 220;
const FREQ_MANCHA = 60;
const AMPL_MANCHA = 0.2;
const FREQ_VASC = 25;
const FORCA_VERMELHO = 0.45;
/** O relevo é sub-pixel de longe e vira cintilação: some entre estas distâncias (metros). */
const DIST_BUMP_CHEIO = 0.4;
const DIST_BUMP_ZERO = 1.1;
/** Cor dos pelos em linear (o three converte sRGB → linear no construtor). */
const COR_PELO = new Color(AJUSTE.cor);
const GLSL_COR_PELO = `vec3(${f(COR_PELO.r)}, ${f(COR_PELO.g)}, ${f(COR_PELO.b)})`;

/**
 * Pele sem UV: todo detalhe é função da posição de REPOUSO no mundo (metros).
 * - micro-bump (poros) perturbando a normal pelo gradiente do ruído;
 * - rugosidade variando (brilho não uniforme, como pele de verdade);
 * - manchas de cor e leve avermelhado (vascularização) em baixa frequência;
 * - pelos (couro cabeludo raspado, sobrancelhas, sugestão no corpo) por máscaras de posição (`pelos.ts`).
 *
 * "Repouso": o vértice em espaço de mundo menos `origem`, o deslocamento do grupo da peça
 * (arrasto e explosão). Sem isso, cabelo e sobrancelhas ficariam parados no mundo enquanto a
 * malha se move, e a sobrancelha desceria pela bochecha ao arrastar a pele. `Peca.tsx` copia a
 * posição do grupo para `origem` antes de cada desenho.
 *
 * O shader mora no PROTÓTIPO, não numa propriedade de instância: `Material.copy()` do three
 * não copia `onBeforeCompile`/`customProgramCacheKey`, e `Peca.tsx` clona o material por peça.
 * `origem` sobrevive ao clone porque `clone()` chama o construtor da subclasse.
 */
export class MaterialPele extends MeshPhysicalMaterial {
  /** Posição do grupo da peça no mundo; o shader a subtrai. Atualizada por `Peca.tsx` (onBeforeRender). */
  readonly origem = new Vector3();

  constructor() {
    super({
      color: new Color('#d8a68c'),
      roughness: 0.62,
      metalness: 0,
      sheen: 0.5,
      sheenRoughness: 0.55,
      sheenColor: new Color('#f6d3bf'),
      clearcoat: 0.08,
      clearcoatRoughness: 0.6,
      specularIntensity: 0.55,
      side: DoubleSide,
    });
  }

  override onBeforeCompile(shader: WebGLProgramParametersWithUniforms): void {
    shader.uniforms.uOrigemPele = { value: this.origem };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundoPele;\nuniform vec3 uOrigemPele;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosMundoPele = (modelMatrix * vec4(transformed, 1.0)).xyz - uOrigemPele;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundoPele;\n' + GLSL_RUIDO + GLSL_PELOS)
      // cor: manchas em baixa frequência + leve vermelho (vasos sob a pele) + pelos.
      // As três máscaras ficam no escopo do main(): os trechos de rugosidade e normal as reusam.
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float mancha = fbmPele(vPosMundoPele * ${f(FREQ_MANCHA)});
        float vasc = fbmPele(vPosMundoPele * ${f(FREQ_VASC)} + 7.0);
        diffuseColor.rgb *= ${f(1 - AMPL_MANCHA / 2)} + ${f(AMPL_MANCHA)} * mancha;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 0.92, 0.90), ${f(FORCA_VERMELHO)} * vasc);
        float mCouroPelos = pelosCouro(vPosMundoPele);
        float mSobrPelos = pelosSobrancelha(vPosMundoPele);
        float mCorpoPelos = pelosCorpo(vPosMundoPele);
        float pontilhadoCouro = mCouroPelos > 0.0 ? ruidoPele(vPosMundoPele * ${f(AJUSTE.couro.freqPontilhado)}) : 0.0;
        diffuseColor.rgb = mix(diffuseColor.rgb, ${GLSL_COR_PELO}, ${f(AJUSTE.couro.mistura)} * mCouroPelos * (0.6 + 0.4 * pontilhadoCouro));
        diffuseColor.rgb = mix(diffuseColor.rgb, ${GLSL_COR_PELO}, ${f(AJUSTE.sobrancelha.mistura)} * mSobrPelos);
        diffuseColor.rgb *= 1.0 - ${f(AJUSTE.corpo.escurecimento)} * mCorpoPelos;`,
      )
      // rugosidade: variação sutil; couro cabeludo fosco; pelos do corpo um pouco mais foscos
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor *= 0.85 + 0.30 * ruidoPele(vPosMundoPele * ${f(FREQ_RUGOSIDADE)});
        roughnessFactor = mix(roughnessFactor, ${f(AJUSTE.couro.rugosidade)}, mCouroPelos);
        roughnessFactor = min(1.0, roughnessFactor + ${f(AJUSTE.corpo.rugosidadeExtra)} * mCorpoPelos);`,
      )
      // micro-bump: gradiente do ruído em espaço de mundo levado ao espaço de vista; depois
      // pontilhado do pelo raspado e fios da sobrancelha, com o mesmo esmaecimento por distância
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float fadeBump = 1.0 - smoothstep(${f(DIST_BUMP_CHEIO)}, ${f(DIST_BUMP_ZERO)}, length(vViewPosition));
          if (fadeBump > 0.001) {
            vec3 P = vPosMundoPele * ${f(FREQ_PORO)};
            const float e = 0.35;
            float h0 = alturaPele(P);
            vec3 g = vec3(alturaPele(P + vec3(e, 0.0, 0.0)) - h0, alturaPele(P + vec3(0.0, e, 0.0)) - h0, alturaPele(P + vec3(0.0, 0.0, e)) - h0) / e;
            normal = inclinarNormalPele(normal, g, ${f(FORCA_BUMP)} * fadeBump);
            if (mCouroPelos > 0.001) {
              normal = inclinarNormalPele(normal, gradienteRuidoPele(vPosMundoPele * ${f(AJUSTE.couro.freqPontilhado)}, e), ${f(AJUSTE.couro.forcaBump)} * fadeBump * mCouroPelos);
            }
            if (mSobrPelos > 0.001) {
              vec3 Pf = vPosMundoPele * vec3(${f(AJUSTE.sobrancelha.freqFiosLateral)}, ${f(AJUSTE.sobrancelha.freqFiosVertical)}, ${f(AJUSTE.sobrancelha.freqFiosLateral)});
              normal = inclinarNormalPele(normal, gradienteRuidoPele(Pf, e), ${f(AJUSTE.sobrancelha.forcaBump)} * fadeBump * mSobrPelos);
            }
          }
        }`,
      );
  }

  override customProgramCacheKey(): string {
    return 'pele-procedural-v2';
  }
}

export function materialPele(): MeshPhysicalMaterial {
  return new MaterialPele();
}
