'use client';
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Color, DoubleSide, FrontSide, type Texture } from 'three';
import { geometriaCornea, geometriaCristalino, geometriaEsclera, geometriaIris } from '@/lib/olho/geometria';
import { bumpEsclera, bumpIris, texturaEsclera, texturaIris } from '@/lib/olho/texturas';

/**
 * Posições e ordens de desenho vêm do Olho3D (`EyeStructure.tsx`), em unidades de esfera
 * unitária: abertura da esclera em z ≈ 0,81 (cos 0,62), córnea cobrindo-a a partir de 0,44,
 * íris logo atrás da borda, cavidade pupilar atrás da íris e cristalino com o equador em 0,58.
 */
const CORNEA_Z = 0.44;
const IRIS_Z = 0.8;
const IRIS_PROTRUSAO = 0.045;
const IRIS_RAIO_EXTERNO = 0.58;
/**
 * O Olho3D põe a cavidade pupilar em z 0,74 com raio 0,52 — lá dentro do olho não há mais nada.
 * Aqui há: o crânio do atlas traz um globo embutido que chega a 13,6 mm à frente do centro, e a
 * 0,74 o disco ficaria atrás dele (a pupila viraria uma bola branca). A 0,82 ele passa à frente,
 * e o raio cai para 0,26 para não brigar em profundidade com o cone da íris.
 */
const PUPILA_Z = 0.82;
const PUPILA_CAVIDADE_RAIO = 0.26;
/**
 * Pupila em 0,22 da esfera unitária = 5,5 mm — midríase de penumbra, dentro do fisiológico
 * (2-8 mm) e não os 0,15 do Olho3D (3,75 mm). Lá o olho ocupa a tela inteira; aqui ele tem
 * 25 mm dentro de um corpo de 1,75 m e uma pupila de 4 mm vira meia dúzia de pixels.
 */
const PUPILA_RAIO = 0.22;
const CRISTALINO_Z = 0.58;
/** As geometrias nascem com o polo em +Y; o eixo visual do corpo é +Z. */
const ROT_X = Math.PI / 2;
/**
 * No Olho3D a córnea e o cristalino usam `transmission` (refração de verdade). Aqui não dá:
 * o passe de transmissão do three redesenha a cena inteira — 241 peças — por objeto
 * transmissivo, e o fundo que a córnea amostra num corpo inteiro é o crânio/músculo ao redor,
 * não a íris logo atrás: o olho fica um bolo branco fora do modo isolado. Vidro fino
 * translúcido com clearcoat dá o mesmo brilho úmido, deixa a íris aparecer e não custa um
 * segundo passe de cena.
 */
const OPACIDADE_CORNEA = 0.22;

export interface MaterialOlho {
  opacity: number;
  transparent: boolean;
}
export interface EmissivoOlho {
  cor: string;
  intensidade: number;
}

/**
 * Olho do Olho3D em unidades de esfera unitária, escalado para `raio` metros e olhando
 * para +z do grupo pai (o corpo olha para +z). `semente` fixa o desenho das texturas.
 * `material` propaga a opacidade da peça (isolamento/opacidade do sistema) e `emissivo`
 * o realce de seleção/hover — os dois aplicados na esclera, que é a superfície opaca.
 */
export function OlhoParametrico({
  raio,
  corIris = '#5a3a22',
  semente = 7,
  material,
  emissivo,
}: {
  raio: number;
  corIris?: string;
  semente?: number;
  material?: MaterialOlho;
  emissivo?: EmissivoOlho;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const geos = useMemo(
    () => ({
      esclera: geometriaEsclera(),
      cornea: geometriaCornea(),
      iris: geometriaIris(PUPILA_RAIO, IRIS_RAIO_EXTERNO, IRIS_PROTRUSAO),
      cristalino: geometriaCristalino(),
    }),
    [],
  );
  const texs = useMemo(
    () => ({
      iris: texturaIris(corIris, semente),
      irisBump: bumpIris(semente),
      esclera: texturaEsclera(semente),
      escleraBump: bumpEsclera(semente),
    }),
    [corIris, semente],
  );

  useEffect(() => {
    const anisotropia = gl.capabilities.getMaxAnisotropy();
    for (const t of Object.values(texs) as Texture[]) {
      t.anisotropy = anisotropia;
      gl.initTexture(t);
    }
    invalidate();
    return () => {
      for (const t of Object.values(texs) as Texture[]) t.dispose();
    };
  }, [texs, gl, invalidate]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const op = material?.opacity ?? 1;
  const tr = material?.transparent ?? false;
  const corEmissiva = useMemo(() => new Color(emissivo?.cor ?? '#ffffff'), [emissivo?.cor]);
  useEffect(() => invalidate(), [op, tr, corEmissiva, emissivo?.intensidade, invalidate]);

  return (
    <group scale={raio}>
      {/* ESCLERA — esfera com abertura frontal; é ela que carrega opacidade e realce */}
      <mesh geometry={geos.esclera} rotation={[ROT_X, 0, 0]} renderOrder={3} castShadow receiveShadow>
        <meshPhysicalMaterial
          map={texs.esclera}
          bumpMap={texs.escleraBump}
          bumpScale={0.03}
          color="#f8f4ee"
          roughness={0.42}
          metalness={0}
          sheen={0.12}
          sheenRoughness={0.4}
          sheenColor="#ffe8dd"
          clearcoat={1}
          clearcoatRoughness={0.07}
          specularIntensity={0.7}
          envMapIntensity={1}
          emissive={corEmissiva}
          emissiveIntensity={emissivo?.intensidade ?? 0}
          side={DoubleSide}
          transparent={tr}
          opacity={op}
          depthWrite={!tr}
        />
      </mesh>

      {/* ÍRIS — anel cuja borda interna é a pupila. Precisa ficar opaca: material
          `transparent` sai do buffer de transmissão da córnea e some atrás dela. */}
      <mesh geometry={geos.iris} position={[0, 0, IRIS_Z]} renderOrder={6}>
        <meshPhysicalMaterial
          map={texs.iris}
          bumpMap={texs.irisBump}
          bumpScale={0.02}
          color="#ffffff"
          roughness={0.55}
          metalness={0}
          sheen={0.15}
          sheenRoughness={0.6}
          sheenColor={corIris}
          iridescence={0.08}
          iridescenceIOR={1.3}
          iridescenceThicknessRange={[100, 400]}
          specularIntensity={0.3}
          envMapIntensity={0.85}
          side={DoubleSide}
          transparent={tr}
          opacity={op}
          depthWrite={!tr}
        />
      </mesh>

      {/* RUFF PUPILAR — franja pigmentada na margem da pupila */}
      <mesh position={[0, 0, IRIS_Z + IRIS_PROTRUSAO]} renderOrder={7}>
        <torusGeometry args={[PUPILA_RAIO + 0.004, 0.0075, 8, 96]} />
        <meshStandardMaterial color="#2a1a12" roughness={0.9} transparent={tr} opacity={op} depthWrite={!tr} />
      </mesh>

      {/* PUPILA — cavidade escura atrás da abertura da íris (paralaxe faz ler como buraco) */}
      <mesh position={[0, 0, PUPILA_Z]} renderOrder={7}>
        <circleGeometry args={[PUPILA_CAVIDADE_RAIO, 64]} />
        <meshBasicMaterial color="#050302" side={DoubleSide} transparent={tr} opacity={op} depthWrite={!tr} />
      </mesh>

      {/* CRISTALINO — lente biconvexa. Só aparece pela pupila, e o disco escuro está à frente
          dela, então é fidelidade anatômica, não algo que se veja. */}
      <mesh geometry={geos.cristalino} position={[0, 0, CRISTALINO_Z]} rotation={[ROT_X, 0, 0]} renderOrder={12}>
        <meshPhysicalMaterial color="#fff8e0" roughness={0} transparent opacity={0.35 * op} envMapIntensity={0.5} side={DoubleSide} depthWrite={false} />
      </mesh>

      {/* CORNEA — domo de vidro sobre a íris */}
      <mesh geometry={geos.cornea} position={[0, 0, CORNEA_Z]} rotation={[ROT_X, 0, 0]} renderOrder={13}>
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0}
          transparent
          opacity={OPACIDADE_CORNEA * op}
          envMapIntensity={1.3}
          clearcoat={1}
          clearcoatRoughness={0.04}
          specularIntensity={1}
          side={FrontSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
