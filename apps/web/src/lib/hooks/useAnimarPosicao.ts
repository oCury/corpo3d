'use client';
import { useEffect, useRef, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import type { Vec3 } from '@/lib/estado/store';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Leva `grupo.position` até `alvo` em `duracaoMs` com easing, chamando `invalidate()` a cada
 * quadro (o Canvas é `frameloop="demand"`). Duração 0 → aplica de imediato. Um alvo novo
 * cancela a animação em curso. `pausado` (arrasto em andamento) não anima nem aplica.
 */
export function useAnimarPosicao(grupo: RefObject<Group | null>, alvo: Vec3, duracaoMs: number, pausado = false) {
  const invalidate = useThree((s) => s.invalidate);
  const quadro = useRef<number | null>(null);
  useEffect(() => {
    const g = grupo.current;
    if (!g || pausado) return;
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    const de = g.position.clone();
    const [x, y, z] = alvo;
    if (duracaoMs <= 0 || de.distanceTo(new Vector3(x, y, z)) < 1e-6) {
      g.position.set(x, y, z);
      invalidate();
      return;
    }
    const t0 = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - t0) / duracaoMs), k = easeOutCubic(t);
      g.position.set(de.x + (x - de.x) * k, de.y + (y - de.y) * k, de.z + (z - de.z) * k);
      invalidate();
      quadro.current = t < 1 ? requestAnimationFrame(passo) : null;
    };
    quadro.current = requestAnimationFrame(passo);
    return () => {
      if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo, alvo[0], alvo[1], alvo[2], duracaoMs, pausado, invalidate]);
}
