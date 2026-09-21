'use client';
import { Html } from '@react-three/drei';
import type { Vec3 } from '@/lib/estado/store';

/** Etiqueta HTML ancorada a um ponto 3D (nota do médico e/ou destaque). */
export function Nota({ posicao, texto, cor }: { posicao: Vec3; texto: string; cor: string | null }) {
  return (
    <Html position={posicao} center distanceFactor={1.2} zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
      <div className="nota" style={{ borderColor: cor ?? 'var(--muted)' }} data-testid="nota">
        {texto}
      </div>
    </Html>
  );
}
