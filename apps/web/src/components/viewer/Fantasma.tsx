'use client';
import type { BufferGeometry, Matrix4 } from 'three';
import { materialFantasma } from '@/lib/materiais';

/** Wireframe translúcido na posição de casa (origem) de uma peça solta. */
export function Fantasma({ geometria, matriz }: { geometria: BufferGeometry; matriz: Matrix4 }) {
  return (
    <group matrix={matriz} matrixAutoUpdate={false}>
      <mesh geometry={geometria} material={materialFantasma()} raycast={() => null} />
    </group>
  );
}
