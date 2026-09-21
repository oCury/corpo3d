import { Color, DoubleSide, MeshPhysicalMaterial, type WebGLProgramParametersWithUniforms } from 'three';

/** Ruído de valor 3D barato (hash + interpolação suave), em GLSL. */
const GLSL_RUIDO = /* glsl */ `
float hashPele(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ruidoPele(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hashPele(i), hashPele(i + vec3(1,0,0)), f.x), mix(hashPele(i + vec3(0,1,0)), hashPele(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hashPele(i + vec3(0,0,1)), hashPele(i + vec3(1,0,1)), f.x), mix(hashPele(i + vec3(0,1,1)), hashPele(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbmPele(vec3 p) { return 0.5 * ruidoPele(p) + 0.25 * ruidoPele(p * 2.03) + 0.125 * ruidoPele(p * 4.11); }
/**
 * Altura do microrrelevo. Cada oitava gira os eixos (matriz ortonormal) porque o ruído de valor
 * tem células alinhadas aos eixos: somar oitavas sem girar produz uma trama regular de tecido.
 */
const mat3 GIRO_PELE = mat3(0.8, 0.6, 0.0, -0.36, 0.48, 0.8, 0.48, -0.64, 0.6);
float alturaPele(vec3 p) {
  return 0.55 * ruidoPele(p) + 0.30 * ruidoPele(GIRO_PELE * p * 2.17 + 3.1) + 0.15 * ruidoPele(GIRO_PELE * GIRO_PELE * p * 4.73 + 9.2);
}
`;

/**
 * Coeficientes do detalhe. Posição em METROS, então frequência = ciclos por metro:
 * 450 ≈ 2,2 mm (relevo fino), 220 ≈ 4,5 mm (brilho), 60 ≈ 17 mm (mancha), 25 ≈ 40 mm (vaso).
 */
const FREQ_PORO = 420.0;
const FORCA_BUMP = 0.13;
const FREQ_RUGOSIDADE = 220.0;
const FREQ_MANCHA = 60.0;
const AMPL_MANCHA = 0.20;
const FREQ_VASC = 25.0;
const FORCA_VERMELHO = 0.45;
/** O relevo é sub-pixel de longe e vira cintilação: some entre estas distâncias (metros). */
const DIST_BUMP_CHEIO = 0.4;
const DIST_BUMP_ZERO = 1.1;

/**
 * Pele sem UV: todo detalhe é função da posição no mundo (metros).
 * - micro-bump (poros) perturbando a normal pelo gradiente do ruído;
 * - rugosidade variando (brilho não uniforme, como pele de verdade);
 * - manchas de cor e leve avermelhado (vascularização) em baixa frequência.
 *
 * O shader mora no PROTÓTIPO, não numa propriedade de instância: `Material.copy()` do three
 * não copia `onBeforeCompile`/`customProgramCacheKey`, e `Peca.tsx` clona o material por peça.
 */
class MaterialPele extends MeshPhysicalMaterial {
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
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundoPele;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosMundoPele = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundoPele;\n' + GLSL_RUIDO)
      // cor: manchas em baixa frequência + leve vermelho (vasos sob a pele)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float mancha = fbmPele(vPosMundoPele * ${FREQ_MANCHA.toFixed(1)});
        float vasc = fbmPele(vPosMundoPele * ${FREQ_VASC.toFixed(1)} + 7.0);
        diffuseColor.rgb *= ${(1 - AMPL_MANCHA / 2).toFixed(3)} + ${AMPL_MANCHA.toFixed(3)} * mancha;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 0.92, 0.90), ${FORCA_VERMELHO.toFixed(3)} * vasc);`,
      )
      // rugosidade: variação sutil
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor *= 0.85 + 0.30 * ruidoPele(vPosMundoPele * ${FREQ_RUGOSIDADE.toFixed(1)});`,
      )
      // micro-bump: gradiente do ruído em espaço de mundo levado ao espaço de vista
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float forca = ${FORCA_BUMP.toFixed(3)} * (1.0 - smoothstep(${DIST_BUMP_CHEIO.toFixed(2)}, ${DIST_BUMP_ZERO.toFixed(2)}, length(vViewPosition)));
          if (forca > 0.001) {
            vec3 P = vPosMundoPele * ${FREQ_PORO.toFixed(1)};
            const float e = 0.35;
            float h0 = alturaPele(P);
            vec3 g = vec3(alturaPele(P + vec3(e, 0.0, 0.0)) - h0, alturaPele(P + vec3(0.0, e, 0.0)) - h0, alturaPele(P + vec3(0.0, 0.0, e)) - h0) / e;
            vec3 gv = mat3(viewMatrix) * g;
            gv -= normal * dot(normal, gv);        // só a componente tangencial inclina a normal
            normal = normalize(normal - gv * forca);
          }
        }`,
      );
  }

  override customProgramCacheKey(): string {
    return 'pele-procedural-v1';
  }
}

export function materialPele(): MeshPhysicalMaterial {
  return new MaterialPele();
}
