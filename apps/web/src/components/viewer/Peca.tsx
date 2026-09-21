'use client';
import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Mesh } from 'three';
import { MeshoptDecoder } from 'meshoptimizer';
import { materialPara } from '@/lib/materiais';
import type { PecaManifesto } from '@/lib/manifesto';

/**
 * O drei 10.7 não expõe `useGLTF.setMeshoptDecoder`; ele injeta o decodificador
 * do three-stdlib por padrão. Desligamos Draco e o meshopt embutido e
 * registramos o decodificador do pacote `meshoptimizer` — o mesmo que o pipeline
 * usou para comprimir os GLBs.
 */
type EstenderLoader = NonNullable<Parameters<typeof useGLTF>[3]>;

const registrarDecodificador: EstenderLoader = (loader) => loader.setMeshoptDecoder(MeshoptDecoder);

export function Peca({ peca }: { peca: PecaManifesto }) {
  const { scene } = useGLTF(`/models/${peca.glb}`, false, false, registrarDecodificador);
  const invalidate = useThree((s) => s.invalidate);
  const material = useMemo(() => materialPara(peca.sistema, peca.nomeLatim), [peca.sistema, peca.nomeLatim]);
  const objeto = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if (o instanceof Mesh) o.material = material;
    });
    clone.name = peca.fmaId;
    return clone;
  }, [scene, material, peca.fmaId]);
  useEffect(() => {
    invalidate();
  }, [objeto, invalidate]);
  return <primitive object={objeto} />;
}
