'use client';
import { useEffect } from 'react';
import { useLoja } from '@/lib/estado/store';

const emCampoDeTexto = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

/** Escape: sai da isolação e limpa a seleção. Cmd/Ctrl+Z desfaz; Shift+Cmd/Ctrl+Z ou Ctrl+Y refaz. */
export function useAtalhos() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const loja = useLoja.getState();
      if (e.key === 'Escape') {
        loja.isolar(null);
        loja.selecionar(null);
        return;
      }
      if (emCampoDeTexto(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? loja.refazer() : loja.desfazer();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        loja.refazer();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
