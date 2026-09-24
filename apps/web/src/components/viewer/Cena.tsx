'use client';
import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Bvh, Environment, OrbitControls } from '@react-three/drei';
import { carregarManifesto } from '@/lib/manifesto';
import { useLoja } from '@/lib/estado/store';
import { pecasVisiveis } from '@/lib/estado/detalhe';
import { useAtalhos } from '@/lib/hooks/useAtalhos';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { CONTORNO, EXPOSICAO, HDRI_INTENSIDADE, LUZ_PRINCIPAL, PREENCHIMENTO, TOM } from '@/lib/luz';
import { definirForcaOclusao } from '@/lib/materiais/pele';
import { Peca } from './Peca';
import { Camera, type ControlesOrbita } from './Camera';

/**
 * Filtro de hits do R3F: malhas marcadas `userData.interativo === false` (opacidade < 0,5) não
 * recebem eventos, e o hit seguinte (a peça de trás) recebe. O raycast acelerado do Bvh fica intacto.
 */
function FiltrarHits() {
  const setEvents = useThree((s) => s.setEvents);
  useEffect(() => {
    setEvents({ filter: (hits) => hits.filter((h) => h.object.userData?.interativo !== false) });
    return () => setEvents({ filter: undefined });
  }, [setEvents]);
  return null;
}

/** Expõe a cena Three.js em `window.__cena` e o gancho `window.__oclusao(v)` (força da oclusão cozida) para os testes E2E. */
function ExporCena() {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const w = window as unknown as { __cena?: unknown; __oclusao?: (v: number) => void };
    w.__cena = scene;
    w.__oclusao = (v: number) => { definirForcaOclusao(v); invalidate(); };
  }, [scene, invalidate]);
  return null;
}

/** Espelha câmera/alvo do OrbitControls no store ao fim de cada gesto (sem histórico). */
function SincronizarCamera() {
  const controles = useThree((s) => s.controls);
  const cam = useThree((s) => s.camera);
  const definirCamera = useLoja((s) => s.definirCamera);
  const definirPreset = useLoja((s) => s.definirPreset);
  return (
    <OrbitControls
      target={[0, 0.85, 0]}
      makeDefault
      enableDamping={false}
      onEnd={() => {
        const c = controles as unknown as ControlesOrbita | null;
        if (!c) return;
        const p = cam.position,
          t = c.target;
        definirCamera([p.x, p.y, p.z], [t.x, t.y, t.z]);
        definirPreset('livre');
      }}
    />
  );
}

export function Cena() {
  const manifesto = useLoja((s) => s.manifesto);
  const definirManifesto = useLoja((s) => s.definirManifesto);
  const estado = useLoja((s) => s.estado);
  const partes = useLoja((s) => s.partes);
  const carregarPartes = useLoja((s) => s.carregarPartes);
  const selecionada = useLoja((s) => s.selecionada);
  const presetCamera = useLoja((s) => s.presetCamera);
  const historico = useLoja((s) => s.historico.length);
  const reduzir = useReducedMotion();
  const erro = useLoja((s) => s.erroManifesto);
  const setErro = useLoja((s) => s.definirErroManifesto);
  useAtalhos();

  useEffect(() => {
    if (manifesto) return;
    let ativo = true; // evita setState depois do unmount
    carregarManifesto()
      .then((m) => { if (ativo) definirManifesto(m); })
      .catch((e: Error) => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, [manifesto, definirManifesto, setErro]);

  // um link que chega com a pilha preenchida precisa das partes de cada nó; `carregarPartes` marca 'carregando' na hora, então não repete
  useEffect(() => {
    for (const id of estado.detalhe) if (partes[id] === undefined) void carregarPartes(id);
  }, [estado.detalhe, partes, carregarPartes]);

  if (erro)
    return (
      <p role="alert" data-testid="erro">
        Não foi possível carregar os modelos: {erro}
      </p>
    );
  if (!manifesto) return <p data-testid="carregando">Carregando manifesto…</p>;

  const visiveis = pecasVisiveis(manifesto, partes, estado);

  return (
    <div
      data-testid="cena"
      data-pecas={manifesto.pecas.length}
      data-visiveis={visiveis.length}
      data-selecionada={selecionada ?? ''}
      data-isolada={estado.isolada ?? ''}
      data-soltas={estado.soltas.length}
      data-explosao={estado.explosao}
      data-historico={historico}
      data-camera={presetCamera}
      data-detalhe={estado.detalhe.join('>')}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Canvas
        shadows="soft"
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.0, 2.6], fov: 40, near: 0.01, far: 20 }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: TOM, toneMappingExposure: EXPOSICAO }}
        onPointerMissed={() => useLoja.getState().selecionar(null)}
      >
        <color attach="background" args={['#101214']} />
        <Environment files="/hdri/studio_small_09_1k.hdr" environmentIntensity={HDRI_INTENSIDADE} />
        <directionalLight
          position={LUZ_PRINCIPAL.posicao}
          intensity={LUZ_PRINCIPAL.intensidade}
          color={LUZ_PRINCIPAL.cor}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0002}
          shadow-normalBias={0.02}
        >
          <orthographicCamera attach="shadow-camera" args={[-1.2, 1.2, 2, -0.2, 0.5, 8]} />
        </directionalLight>
        <directionalLight position={PREENCHIMENTO.posicao} intensity={PREENCHIMENTO.intensidade} color={PREENCHIMENTO.cor} />
        <directionalLight position={CONTORNO.posicao} intensity={CONTORNO.intensidade} color={CONTORNO.cor} />
        <Suspense fallback={null}>
          <Bvh firstHitOnly>
            {visiveis.map((p) => (
              <Peca key={p.fmaId} peca={p} reduzirMovimento={reduzir} />
            ))}
          </Bvh>
        </Suspense>
        <FiltrarHits />
        <SincronizarCamera />
        <Camera />
        {process.env.NODE_ENV !== 'production' && <ExporCena />}
      </Canvas>
    </div>
  );
}
