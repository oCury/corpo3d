'use client';
import { useLoja } from '@/lib/estado/store';
import { PRESETS_CAMERA } from '@/lib/estado/geometria';
import { useDeslizador } from '@/lib/hooks/useDeslizador';

const ROTULO_PRESET = { frente: 'Frente', costas: 'Costas', esquerda: 'Esquerda', direita: 'Direita', superior: 'Superior' } as const;

export function Controles() {
  const explosao = useLoja((s) => s.estado.explosao);
  const podeDesfazer = useLoja((s) => s.historico.length > 0);
  const podeRefazer = useLoja((s) => s.futuro.length > 0);
  const soltas = useLoja((s) => s.estado.soltas.length);
  const { definirExplosao, remontarTudo, desfazer, refazer, definirCamera, definirPreset } = useLoja.getState();
  const deslizador = useDeslizador((v) => definirExplosao(v, { historico: false }));
  const irPara = (p: keyof typeof PRESETS_CAMERA) => { definirCamera(PRESETS_CAMERA[p].pos, PRESETS_CAMERA[p].alvo); definirPreset(p); };
  return (
    <>
    <section aria-labelledby="controles-titulo" className="painel-bloco">
      <h2 id="controles-titulo">Montagem</h2>
      <label className="camada"><span>Explosão</span>
        <input type="range" min={0} max={1} step={0.05} value={explosao} aria-label="Explosão" {...deslizador} />
      </label>
      <div className="linha-botoes">
        <button type="button" onClick={remontarTudo} disabled={explosao === 0 && soltas === 0}>Remontar tudo</button>
        <button type="button" onClick={desfazer} disabled={!podeDesfazer} aria-keyshortcuts="Meta+Z Control+Z">Desfazer</button>
        <button type="button" onClick={refazer} disabled={!podeRefazer} aria-keyshortcuts="Shift+Meta+Z Shift+Control+Z">Refazer</button>
      </div>
    </section>
    <section aria-labelledby="camera-titulo" className="painel-bloco">
      <h2 id="camera-titulo">Câmera</h2>
      <div className="linha-botoes">
        {(Object.keys(ROTULO_PRESET) as (keyof typeof ROTULO_PRESET)[]).map((p) => (
          <button key={p} type="button" onClick={() => irPara(p)}>{ROTULO_PRESET[p]}</button>
        ))}
        <button type="button" onClick={() => irPara('frente')}>Recentrar</button>
      </div>
    </section>
    </>
  );
}
