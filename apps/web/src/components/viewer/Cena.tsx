'use client';
import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Bvh, Environment, OrbitControls } from '@react-three/drei';
import { carregarManifesto } from '@/lib/manifesto';
import { useLoja } from '@/lib/estado/store';
import { useAtalhos } from '@/lib/hooks/useAtalhos';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { Peca } from './Peca';
import { Camera, type ControlesOrbita } from './Camera';

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

  if (erro)
    return (
      <p role="alert" data-testid="erro">
        Não foi possível carregar os modelos: {erro}
      </p>
    );
  if (!manifesto) return <p data-testid="carregando">Carregando manifesto…</p>;

  const visiveis = manifesto.pecas.filter((p) => estado.opacidade[p.sistema] > 0 && !estado.ocultas.includes(p.fmaId));

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
      style={{ position: 'absolute', inset: 0 }}
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.0, 2.6], fov: 40, near: 0.01, far: 20 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => useLoja.getState().selecionar(null)}
      >
        <color attach="background" args={['#101214']} />
        <Environment files="/hdri/studio_small_09_1k.hdr" />
        <Suspense fallback={null}>
          <Bvh firstHitOnly>
            {visiveis.map((p) => (
              <Peca key={p.fmaId} peca={p} reduzirMovimento={reduzir} />
            ))}
          </Bvh>
        </Suspense>
        <SincronizarCamera />
        <Camera />
      </Canvas>
    </div>
  );
}
