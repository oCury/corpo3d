'use client';
import { useEffect, useState } from 'react';

/** true quando o sistema pede menos movimento; as animações viram troca imediata. */
export function useReducedMotion(): boolean {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const atualizar = () => setReduzido(mq.matches);
    atualizar();
    mq.addEventListener('change', atualizar);
    return () => mq.removeEventListener('change', atualizar);
  }, []);
  return reduzido;
}
