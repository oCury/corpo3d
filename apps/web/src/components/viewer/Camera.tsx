'use client';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useLoja } from '@/lib/estado/store';

/** Forma mínima do OrbitControls (three-stdlib) que usamos; o tipo real não é importável com pnpm estrito. */
export interface ControlesOrbita {
  enabled: boolean;
  target: Vector3;
  update(): void;
}

/**
 * Sem UI: observa `estado.camera` e move câmera + alvo do OrbitControls quando ele muda por
 * ação nossa (preset, enquadrar, link). Mudanças feitas pelo mouse chegam ao store via `onEnd`
 * na Cena, com os mesmos valores, então não há laço.
 */
export function Camera() {
  const camera = useLoja((s) => s.estado.camera);
  const cam = useThree((s) => s.camera);
  const controlesBrutos = useThree((s) => s.controls);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const controles = controlesBrutos as unknown as ControlesOrbita | null;
    const pos = new Vector3(...camera.pos),
      alvo = new Vector3(...camera.alvo);
    if (cam.position.distanceTo(pos) < 1e-6 && controles && controles.target.distanceTo(alvo) < 1e-6) return;
    cam.position.copy(pos);
    if (controles) {
      controles.target.copy(alvo);
      controles.update();
    } else cam.lookAt(alvo);
    invalidate();
  }, [camera, cam, controlesBrutos, invalidate]);
  return null;
}
