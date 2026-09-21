'use client';
import { useId, useState } from 'react';
import { buscarPecas } from '@/lib/busca';
import { enquadrar } from '@/lib/estado/geometria';
import { useLoja } from '@/lib/estado/store';
import type { PecaManifesto } from '@/lib/manifesto';

const EMPTY: PecaManifesto[] = [];

/** Busca por nome (pt, leigo ou latim), acento-insensível: escolher um resultado seleciona e foca a peça. */
export function Busca() {
  const [consulta, setConsulta] = useState('');
  const manifesto = useLoja((s) => s.manifesto);
  const pecas = manifesto?.pecas ?? EMPTY;
  const id = useId();
  const resultados = buscarPecas(pecas, consulta);
  const escolher = (p: PecaManifesto) => {
    const { selecionar, definirCamera, definirPreset } = useLoja.getState();
    selecionar(p.fmaId);
    const q = enquadrar(p);
    definirCamera(q.pos, q.alvo);
    definirPreset('livre');
    setConsulta('');
  };
  return (
    <section className="painel-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`}>Buscar</h2>
      <input
        type="search"
        role="searchbox"
        aria-label="Buscar peça"
        placeholder="fígado, fêmur, hepar…"
        value={consulta}
        onChange={(e) => setConsulta(e.currentTarget.value)}
        aria-controls={resultados.length > 0 ? `${id}-lista` : undefined}
      />
      {resultados.length > 0 && (
        <ul id={`${id}-lista`} role="listbox" aria-label="Resultados" className="resultados">
          {resultados.map((p) => (
            <li
              key={p.fmaId}
              role="option"
              aria-selected={false}
              tabIndex={0}
              onClick={() => escolher(p)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') escolher(p);
              }}
            >
              <b>{p.nomePt}</b> <span>{p.nomeLeigo}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
