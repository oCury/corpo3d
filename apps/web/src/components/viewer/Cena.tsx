'use client';
import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { carregarManifesto, type Manifesto } from '@/lib/manifesto';
import { Peca } from './Peca';

export function Cena() {
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true; // evita setState depois do unmount
    carregarManifesto()
      .then((m) => { if (ativo) setManifesto(m); })
      .catch((e: Error) => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, []);

  if (erro)
    return (
      <p role="alert" data-testid="erro">
        Não foi possível carregar os modelos: {erro}
      </p>
    );
  if (!manifesto) return <p data-testid="carregando">Carregando manifesto…</p>;

  return (
    <div data-testid="cena" data-pecas={manifesto.pecas.length} style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.0, 2.6], fov: 40, near: 0.01, far: 20 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#101214']} />
        <Environment files="/hdri/studio_small_09_1k.hdr" />
        <Suspense fallback={null}>
          {manifesto.pecas.map((p) => (
            <Peca key={p.fmaId} peca={p} />
          ))}
        </Suspense>
        <OrbitControls target={[0, 0.85, 0]} makeDefault enableDamping={false} />
      </Canvas>
    </div>
  );
}
