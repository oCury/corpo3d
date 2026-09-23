'use client';
import { useLoja, corDestaqueDe, notaDe, pecaDe, type CorDestaque } from '@/lib/estado/store';
import { CORES_DESTAQUE, MAX_NOTA } from '@/lib/estado/schema';
import { enquadrar } from '@/lib/estado/geometria';
import { ROTULO_SISTEMA } from '@/lib/manifesto';
import { ehParte } from '@/lib/manifesto';

const NOME_COR: Record<CorDestaque, string> = { '#ffd166': 'amarelo', '#06d6a0': 'verde', '#118ab2': 'azul', '#ef476f': 'rosa', '#c77dff': 'roxo' };
const BLOCOS = ['O que é', 'O que faz', 'O que costuma dar errado'] as const;

export function PainelPeca() {
  const fmaId = useLoja((s) => s.selecionada);
  const peca = useLoja((s) => pecaDe(s, fmaId));
  const estadoPartes = useLoja((s) => (fmaId ? s.partes[fmaId] : undefined));
  const estado = useLoja((s) => s.estado);
  const { isolar, alternarOculta, soltar, encaixar, destacar, anotar, definirCamera, definirPreset, abrirPartes } = useLoja.getState();
  if (!peca) return <p className="dica">Clique numa peça para selecioná-la. Arraste a peça selecionada para desmontar; arrastar sobre qualquer outra gira o modelo.</p>;

  const cor = corDestaqueDe(estado, peca.fmaId);
  const nota = notaDe(estado, peca.fmaId);
  const oculta = estado.ocultas.includes(peca.fmaId);
  const solta = estado.soltas.some((s) => s.fmaId === peca.fmaId);
  const isolada = estado.isolada === peca.fmaId;
  const focar = () => { const q = enquadrar(peca); definirCamera(q.pos, q.alvo); definirPreset('livre'); };
  const desmontar = () => {
    const [x, y, z] = peca.vetorExplosao; const k = 0.25;
    soltar(peca.fmaId, [x * k, y * k, z * k]);
  };

  return (
    <div className="painel-peca">
      <p className="sistema">{ROTULO_SISTEMA[peca.sistema]}{peca.lado !== '-' && ` · lado ${peca.lado === 'D' ? 'direito' : 'esquerdo'}`}</p>
      <h2 className="nome-leigo">{peca.nomeLeigo}{ehParte(peca) && peca.status === 'auto' && <span className="tarja">nome automático, em revisão</span>}</h2>
      <p className="nomes"><span>{peca.nomePt}</span> · <i lang="la">{peca.nomeLatim}</i></p>
      {BLOCOS.map((b) => (
        <section key={b} className="bloco"><h3>{b}</h3><p className="rascunho">Descrição em revisão médica</p></section>
      ))}
      <div className="linha-botoes">
        {(peca.numPartes ?? 0) > 0 && (
          <button type="button" disabled={estadoPartes === 'carregando'} onClick={() => void abrirPartes(peca)}>
            {estadoPartes === 'carregando' ? 'Carregando partes…' : `Ver partes (${peca.numPartes})`}
          </button>
        )}
        {estadoPartes === 'erro' && <span role="alert" className="rascunho">Partes indisponíveis</span>}
        <button type="button" onClick={focar}>Focar</button>
        <button type="button" onClick={() => isolar(isolada ? null : peca.fmaId)}>{isolada ? 'Sair da isolação' : 'Isolar'}</button>
        <button type="button" onClick={() => alternarOculta(peca.fmaId)}>{oculta ? 'Mostrar peça' : 'Ocultar peça'}</button>
        <button type="button" onClick={() => (solta ? encaixar(peca.fmaId) : desmontar())}>{solta ? 'Encaixar' : 'Desmontar'}</button>
      </div>
      <fieldset className="destaque">
        <legend>Destaque</legend>
        <label><input type="radio" name="destaque" checked={cor === null} onChange={() => destacar(peca.fmaId, null)} aria-label="Sem destaque" /> nenhum</label>
        {CORES_DESTAQUE.map((c) => (
          <label key={c} className="cor"><input type="radio" name="destaque" checked={cor === c} onChange={() => destacar(peca.fmaId, c)} aria-label={`Destaque ${NOME_COR[c]}`} />
            <span style={{ background: c }} aria-hidden /></label>
        ))}
      </fieldset>
      <label className="nota-campo">
        <span>Nota para o paciente</span>
        <textarea rows={3} maxLength={MAX_NOTA} value={nota} onChange={(e) => anotar(peca.fmaId, e.currentTarget.value)} />
        <small>Não escreva nome, CPF ou dados que identifiquem o paciente. {nota.length}/{MAX_NOTA}</small>
      </label>
    </div>
  );
}
