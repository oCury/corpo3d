'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGLTF, useCursor } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, Mesh, Vector3, type BufferGeometry, type Group, type Matrix4, type MeshPhysicalMaterial } from 'three';
import { MeshoptDecoder } from 'meshoptimizer';
import { materialFantasma, materialPara } from '@/lib/materiais';
import type { PecaManifesto } from '@/lib/manifesto';
import { useLoja, corDestaqueDe, notaDe, type Vec3 } from '@/lib/estado/store';
import {
  posicaoAlvo,
  estaEmCasa,
  projetarNoPlanoDaCamera,
  LIMIAR_ARRASTO_PX,
  DURACAO_ENCAIXE_MS,
} from '@/lib/estado/geometria';
import { useAnimarPosicao } from '@/lib/hooks/useAnimarPosicao';
import type { ControlesOrbita } from './Camera';
import { Fantasma } from './Fantasma';
import { Nota } from './Nota';
import { OlhoParametrico } from './OlhoParametrico';

/**
 * O drei 10.7 não expõe `useGLTF.setMeshoptDecoder`; desligamos Draco e o meshopt embutido e
 * registramos o decodificador do pacote `meshoptimizer` — o mesmo que comprimiu os GLBs.
 */
type EstenderLoader = NonNullable<Parameters<typeof useGLTF>[3]>;
const registrarDecodificador: EstenderLoader = (loader) => loader.setMeshoptDecoder(MeshoptDecoder);

const OPACIDADE_FORA_DA_ISOLACAO = 0.1;
/**
 * Realce por emissivo, não por contorno: o `Outlines` do drei expande a malha ao longo da normal
 * em unidades LOCAIS, e aqui as posições vêm quantizadas com a escala na matriz do nó — o contorno
 * some. Em modo `screenspace` ele aparece, mas a casca atravessa a malha (`DoubleSide`) e mancha
 * o corpo inteiro. O emissivo é estável e não depende da escala da geometria.
 */
const EMISSIVO_DESTAQUE = 0.45;
const EMISSIVO_SELECAO = 0.3;
const EMISSIVO_HOVER = 0.18;
/** Abaixo disto a peça é quase invisível e não deve capturar o ponteiro. */
const OPACIDADE_MINIMA_INTERATIVA = 0.5;
const BRANCO = new Color('#ffffff');

/**
 * Os dois globos oculares não usam a malha do atlas: o BodyParts3D entrega o "direito"
 * (FMA12514) com OS DOIS olhos dentro (81 mm de largura), então a geometria dele é
 * inservível. Nos dois casos desenhamos o olho paramétrico do Olho3D e tiramos a posição
 * do centro do globo ESQUERDO, espelhando em x para o direito (`+x` = lado esquerdo do
 * paciente). Sementes diferentes dão a cada olho suas próprias veias, sem deixar de ser
 * reprodutíveis.
 */
const OLHOS: Record<string, { espelharX: boolean; semente: number }> = {
  FMA12515: { espelharX: false, semente: 7 },
  FMA12514: { espelharX: true, semente: 11 },
};
const FMA_OLHO_ESQUERDO = 'FMA12515';
/** Raio do globo: 12,5 mm (o globo do atlas mede 26,3 mm de largura). */
const RAIO_OLHO = 0.0125;
/**
 * O globo vai 4 mm à frente do centro que o manifesto dá. Medido nos GLBs: a peça do CRÂNIO
 * (`FMA46565`) traz um globo ocular embutido cuja superfície chega a **13,6 mm à frente do
 * centro do olho** no cone da pupila. Centrado, o nosso olho fica com a íris a 10 mm — atrás
 * dessa casca — e pela fenda palpebral só se vê a bola branca do crânio. Com +4 mm a íris vai
 * para 14 mm e passa à frente dela; a pele ainda tem superfície até 20,3 mm ali, então o olho
 * continua dentro da pálpebra. O conserto de verdade é tirar o globo de dentro do crânio no
 * pipeline; isto é o que dá para fazer sem reprocessar o atlas.
 */
const DESLOCAMENTO_Z_OLHO = 0.004;

/**
 * Extrai geometria e matriz de desquantização do único Mesh do GLB. As posições vêm
 * quantizadas (KHR_mesh_quantization) e a desquantização mora na transformação do nó —
 * por isso a matriz de mundo do Mesh não é a identidade e precisa ser preservada.
 */
function malhaDoGltf(scene: Group): { geometria: BufferGeometry; matriz: Matrix4 } {
  scene.updateMatrixWorld(true);
  const malhas: Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof Mesh) malhas.push(o);
  });
  const malha = malhas[0];
  if (!malha) throw new Error('GLB sem Mesh');
  return { geometria: malha.geometry, matriz: malha.matrixWorld.clone() };
}

export const Peca = memo(function Peca({ peca, reduzirMovimento }: { peca: PecaManifesto; reduzirMovimento: boolean }) {
  const { scene } = useGLTF(`/models/${peca.glb}`, false, false, registrarDecodificador);
  const { geometria, matriz } = useMemo(() => malhaDoGltf(scene), [scene]);
  const camera = useThree((s) => s.camera);
  const controles = useThree((s) => s.controls);
  const invalidate = useThree((s) => s.invalidate);
  const grupo = useRef<Group>(null);

  // --- estado que afeta esta peça (seletores finos: só re-renderiza quando algo dela muda)
  const opacidadeSistema = useLoja((s) => s.estado.opacidade[peca.sistema]);
  const isolada = useLoja((s) => s.estado.isolada);
  const alvo = useLoja(useShallow((s) => posicaoAlvo(peca, s.estado))); // igualdade rasa: [x,y,z] iguais → sem re-render
  const solta = useLoja((s) => s.estado.soltas.some((x) => x.fmaId === peca.fmaId));
  const cor = useLoja((s) => corDestaqueDe(s.estado, peca.fmaId));
  const nota = useLoja((s) => notaDe(s.estado, peca.fmaId));
  const selecionada = useLoja((s) => s.selecionada === peca.fmaId);
  const emHover = useLoja((s) => s.hover === peca.fmaId);
  const arrastando = useLoja((s) => s.arrastando === peca.fmaId);
  const { selecionar, passarMouse, definirArrastando, soltar, encaixar, isolar } = useLoja.getState();

  // --- material próprio (opacidade/emissivo por peça), derivado do material do sistema
  const material = useMemo(
    () => materialPara(peca.sistema, peca.nomeLatim).clone() as MeshPhysicalMaterial,
    [peca.sistema, peca.nomeLatim],
  );
  useEffect(() => () => material.dispose(), [material]);
  const opacidade = opacidadeSistema * (isolada && isolada !== peca.fmaId ? OPACIDADE_FORA_DA_ISOLACAO : 1);
  useEffect(() => {
    material.opacity = opacidade;
    material.transparent = opacidade < 1;
    material.depthWrite = opacidade >= 1;
    material.needsUpdate = true;
    invalidate();
  }, [material, opacidade, invalidate]);
  useEffect(() => {
    material.emissive.copy(cor ? new Color(cor) : BRANCO);
    material.emissiveIntensity = cor ? EMISSIVO_DESTAQUE : selecionada ? EMISSIVO_SELECAO : emHover ? EMISSIVO_HOVER : 0;
    invalidate();
  }, [material, cor, selecionada, emHover, invalidate]);

  // --- posição: animada, exceto durante o arrasto
  useAnimarPosicao(grupo, alvo, reduzirMovimento ? 0 : DURACAO_ENCAIXE_MS, arrastando);
  useCursor(emHover && !arrastando, 'grab', 'auto');

  // --- arrasto (spec §5): plano paralelo à câmera pelo centro da peça
  const inicio = useRef<{ x: number; y: number; deslocamento: Vector3; plano: Vector3 } | null>(null);
  const [virouArrasto, setVirouArrasto] = useState(false);

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0 || opacidade < OPACIDADE_MINIMA_INTERATIVA) return; // peças quase invisíveis não capturam
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      const g = grupo.current;
      if (!g) return;
      const direcao = camera.getWorldDirection(new Vector3()); // normal do plano de arrasto
      inicio.current = {
        x: e.nativeEvent.clientX,
        y: e.nativeEvent.clientY,
        deslocamento: e.point.clone().sub(g.position),
        plano: direcao,
      };
      setVirouArrasto(false);
    },
    [opacidade, camera],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const ini = inicio.current;
      const g = grupo.current;
      if (!ini || !g) return;
      const dx = e.nativeEvent.clientX - ini.x,
        dy = e.nativeEvent.clientY - ini.y;
      if (!virouArrasto) {
        if (Math.hypot(dx, dy) < LIMIAR_ARRASTO_PX) return;
        setVirouArrasto(true);
        definirArrastando(peca.fmaId);
        const c = controles as unknown as ControlesOrbita | null;
        if (c) c.enabled = false;
      }
      const referencia = g.position.clone().add(ini.deslocamento);
      const p = projetarNoPlanoDaCamera(e.ray, ini.plano, referencia);
      if (!p) return;
      g.position.copy(p.sub(ini.deslocamento));
      invalidate();
    },
    [virouArrasto, definirArrastando, peca.fmaId, controles, invalidate],
  );

  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const g = grupo.current;
      const ini = inicio.current;
      inicio.current = null;
      if (!g || !ini) return;
      (e.target as Element).releasePointerCapture(e.pointerId);
      if (!virouArrasto) {
        selecionar(peca.fmaId); // foi clique
        return;
      }
      const c = controles as unknown as ControlesOrbita | null;
      if (c) c.enabled = true;
      const pos: Vec3 = [g.position.x, g.position.y, g.position.z];
      // primeiro o destino novo, depois liberar a animação: assim ela parte para o alvo certo
      if (estaEmCasa(pos)) encaixar(peca.fmaId);
      else soltar(peca.fmaId, pos);
      setVirouArrasto(false);
      definirArrastando(null);
    },
    [virouArrasto, selecionar, definirArrastando, encaixar, soltar, peca.fmaId, controles],
  );

  const onDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      isolar(isolada === peca.fmaId ? null : peca.fmaId);
    },
    [isolar, isolada, peca.fmaId],
  );
  const onPointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      passarMouse(peca.fmaId);
    },
    [passarMouse, peca.fmaId],
  );
  const onPointerOut = useCallback(() => {
    if (useLoja.getState().hover === peca.fmaId) passarMouse(null);
  }, [passarMouse, peca.fmaId]);

  const centroNoGrupo = useMemo<Vec3>(() => [peca.centro[0], peca.bbox.max[1] + 0.03, peca.centro[2]], [peca]);

  // --- globos oculares: olho paramétrico em vez da malha do atlas
  const olho = OLHOS[peca.fmaId];
  const centroOlhoEsquerdo = useLoja(
    useShallow((s) => s.manifesto?.pecas.find((p) => p.fmaId === FMA_OLHO_ESQUERDO)?.centro ?? null),
  );
  const posicaoOlho = useMemo<Vec3 | null>(() => {
    if (!olho || !centroOlhoEsquerdo) return null;
    const [x, y, z] = centroOlhoEsquerdo;
    return [olho.espelharX ? -x : x, y, z + DESLOCAMENTO_Z_OLHO];
  }, [olho, centroOlhoEsquerdo]);
  const materialOlho = useMemo(() => ({ opacity: opacidade, transparent: opacidade < 1 }), [opacidade]);
  const emissivoOlho = useMemo(
    () => ({
      cor: cor ?? '#ffffff',
      intensidade: cor ? EMISSIVO_DESTAQUE : selecionada ? EMISSIVO_SELECAO : emHover ? EMISSIVO_HOVER : 0,
    }),
    [cor, selecionada, emHover],
  );

  return (
    <>
      {solta &&
        (posicaoOlho ? (
          // O fantasma do olho é uma esfera simples: a malha do atlas está errada para o direito
          <mesh position={posicaoOlho} material={materialFantasma()} raycast={() => null}>
            <sphereGeometry args={[RAIO_OLHO, 16, 12]} />
          </mesh>
        ) : (
          <Fantasma geometria={geometria} matriz={matriz} />
        ))}
      <group
        ref={grupo}
        name={peca.fmaId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        {posicaoOlho && olho ? (
          <group position={posicaoOlho}>
            <OlhoParametrico raio={RAIO_OLHO} semente={olho.semente} material={materialOlho} emissivo={emissivoOlho} />
            {/* Colisor para clique/arrasto/hover: o raio precisa parar numa superfície só, não
                nas cinco camadas do olho (e a córnea nem escreve profundidade). Não dá para usar
                `visible={false}`: o R3F descarta objetos invisíveis nos eventos. `colorWrite`
                desligado some com ele na tela e o mantém no raycast. */}
            <mesh userData={{ fmaId: peca.fmaId, interativo: opacidade >= OPACIDADE_MINIMA_INTERATIVA }} renderOrder={-1}>
              <sphereGeometry args={[RAIO_OLHO * 1.05, 24, 24]} />
              <meshBasicMaterial colorWrite={false} depthWrite={false} />
            </mesh>
          </group>
        ) : (
          <group matrix={matriz} matrixAutoUpdate={false}>
            {/* `interativo=false` faz o filtro de hits da Cena ignorar esta malha: o raio segue para a peça de trás */}
            <mesh geometry={geometria} material={material} userData={{ fmaId: peca.fmaId, interativo: opacidade >= OPACIDADE_MINIMA_INTERATIVA }} />
          </group>
        )}
        {(nota || cor) && <Nota posicao={centroNoGrupo} texto={nota || peca.nomeLeigo} cor={cor} />}
      </group>
    </>
  );
});
