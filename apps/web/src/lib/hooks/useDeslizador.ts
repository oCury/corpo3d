'use client';
import { useEffect, useRef, type ChangeEvent } from 'react';
import { useLoja } from '@/lib/estado/store';
import type { EstadoCena } from '@/lib/estado/schema';

/**
 * Para `<input type="range">`: cada movimento aplica o valor SEM histórico (React `onChange`
 * dispara a cada `input`); o evento nativo `change` (soltar o mouse, ou o `fill` do Playwright)
 * registra UMA entrada de histórico com o estado de antes do gesto.
 */
export function useDeslizador(aplicar: (valor: number) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const antes = useRef<EstadoCena | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onChange = () => {
      if (antes.current) {
        useLoja.getState().registrarSnapshot(antes.current);
        antes.current = null;
      }
    };
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!antes.current) antes.current = useLoja.getState().estado;
    aplicar(Number(e.currentTarget.value));
  };
  return { ref, onChange };
}
