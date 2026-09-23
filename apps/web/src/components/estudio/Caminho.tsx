'use client';
import { useLoja, pecaDe } from '@/lib/estado/store';
import { useShallow } from 'zustand/react/shallow';

/** Corpo › Coração › Ventrículo esquerdo. Cada nível anterior fecha até ali; some sem detalhe. */
export function Caminho() {
  const detalhe = useLoja((s) => s.estado.detalhe);
  const nomes = useLoja(useShallow((s) => s.estado.detalhe.map((id) => pecaDe(s, id)?.nomePt ?? id)));
  const fecharPartes = useLoja((s) => s.fecharPartes);
  if (detalhe.length === 0) return null;
  return (
    <nav aria-label="Caminho" className="caminho">
      <button type="button" onClick={() => fecharPartes(0)}>Corpo</button>
      {detalhe.map((id, i) => (
        <span key={id}>
          <span aria-hidden> › </span>
          {i === detalhe.length - 1
            ? <span aria-current="location">{nomes[i]}</span>
            : <button type="button" onClick={() => fecharPartes(i + 1)}>{nomes[i]}</button>}
        </span>
      ))}
    </nav>
  );
}
