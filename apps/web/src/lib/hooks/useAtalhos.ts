'use client';
import { useEffect } from 'react';
import { useLoja } from '@/lib/estado/store';

const emCampoDeTexto = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

/** Escape: tira seleção/isolação; sem nada selecionado, fecha um nível do detalhe. Cmd/Ctrl+Z desfaz; Shift+Cmd/Ctrl+Z ou Ctrl+Y refaz. */
export function useAtalhos() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const loja = useLoja.getState();
      if (e.key === 'Escape') {
        if (loja.selecionada || loja.estado.isolada) { loja.isolar(null); loja.selecionar(null); return; }
        // nada selecionado nem isolado: com detalhe aberto, fecha um nível (não dentro da busca/nota: lá o Esc é do campo)
        if (!emCampoDeTexto(e.target) && loja.estado.detalhe.length) loja.fecharPartes(loja.estado.detalhe.length - 1);
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
