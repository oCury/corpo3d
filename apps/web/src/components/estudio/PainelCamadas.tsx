'use client';
import { SISTEMAS, ROTULO_SISTEMA, type Sistema } from '@/lib/manifesto';
import { useLoja } from '@/lib/estado/store';
import { useDeslizador } from '@/lib/hooks/useDeslizador';

function Camada({ sistema }: { sistema: Sistema }) {
  const valor = useLoja((s) => s.estado.opacidade[sistema]);
  const definirOpacidade = useLoja((s) => s.definirOpacidade);
  const deslizador = useDeslizador((v) => definirOpacidade(sistema, v, { historico: false }));
  return (
    <label className="camada">
      <span>{ROTULO_SISTEMA[sistema]}</span>
      <input type="range" min={0} max={1} step={0.05} value={valor} aria-label={ROTULO_SISTEMA[sistema]} {...deslizador} />
      <output aria-hidden>{Math.round(valor * 100)}%</output>
    </label>
  );
}

export function PainelCamadas() {
  return (
    <section aria-labelledby="camadas-titulo" className="painel-bloco">
      <h2 id="camadas-titulo">Camadas</h2>
      {SISTEMAS.map((s) => <Camada key={s} sistema={s} />)}
    </section>
  );
}
