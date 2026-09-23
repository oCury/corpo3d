'use client';
import { useLoja, pecaDe } from '@/lib/estado/store';
import { enquadrar } from '@/lib/estado/geometria';
import { SISTEMAS, ROTULO_SISTEMA, type PecaManifesto } from '@/lib/manifesto';
import { partesDe, dentroDoDetalhe } from '@/lib/estado/detalhe';

const EMPTY: PecaManifesto[] = [];

/** Todas as peças, agrupadas por sistema: Enter seleciona e foca, Espaço desmonta/encaixa. */
export function ListaPecas() {
  const manifesto = useLoja((s) => s.manifesto);
  const pecas = manifesto?.pecas ?? EMPTY;
  const selecionada = useLoja((s) => s.selecionada);
  const soltas = useLoja((s) => s.estado.soltas);
  // com detalhe aberto, as partes do nó mais fundo carregado entram como primeiro grupo da lista
  const noAberto = useLoja((s) => {
    for (let i = s.estado.detalhe.length - 1; i >= 0; i--) if (partesDe(s.partes, s.estado.detalhe[i])) return s.estado.detalhe[i];
    return null;
  });
  const partesAbertas = useLoja((s) => (noAberto ? partesDe(s.partes, noAberto) : null));
  const nomeNoAberto = useLoja((s) => (noAberto ? pecaDe(s, noAberto)?.nomePt ?? noAberto : ''));
  const agir = (p: PecaManifesto, acao: 'selecionar' | 'alternar') => {
    const loja = useLoja.getState();
    if (acao === 'selecionar') {
      loja.selecionar(p.fmaId);
      const q = enquadrar(p);
      loja.definirCamera(q.pos, q.alvo);
      loja.definirPreset('livre');
      return;
    }
    if (soltas.some((s) => s.fmaId === p.fmaId)) loja.encaixar(p.fmaId);
    else {
      const [x, y, z] = p.vetorExplosao;
      loja.soltar(p.fmaId, [x * 0.25, y * 0.25, z * 0.25]);
    }
  };
  // Estrutura ACHATADA de propósito: um único <ul role="listbox"> com os rótulos de grupo
  // como <li role="presentation"> e as peças como <li role="option"> irmãos diretos — o axe
  // (aria-required-children/aria-required-parent) exige que os únicos filhos de um listbox
  // sejam options/presentation/group, e um <ul role="group"> aninhado dentro de um
  // role="presentation" quebra essa regra.
  return (
    <details className="painel-bloco" open>
      <summary>Todas as peças ({pecas.length}{partesAbertas ? ` + ${partesAbertas.length} partes` : ''})</summary>
      <ul role="listbox" aria-label="Peças" className="lista-pecas">
        {partesAbertas && [
          <li key="grupo-partes" role="presentation" className="grupo">Partes de {nomeNoAberto}</li>,
          ...partesAbertas.map((p) => (
            <li key={`parte-${p.fmaId}`} role="option" tabIndex={0} aria-selected={selecionada === p.fmaId}
              onClick={() => agir(p, 'selecionar')}
              onKeyDown={(e) => { if (e.key === 'Enter') agir(p, 'selecionar'); if (e.key === ' ') { e.preventDefault(); agir(p, 'alternar'); } }}>
              {p.nomePt}{soltas.some((x) => x.fmaId === p.fmaId) && <span aria-label="solta"> ⇢</span>}
            </li>
          )),
        ]}
        {SISTEMAS.flatMap((s) => [
          <li key={s} role="presentation" className="grupo">
            {ROTULO_SISTEMA[s]}
          </li>,
          ...pecas
            .filter((p) => p.sistema === s)
            .map((p) => (
              <li
                key={p.fmaId}
                role="option"
                tabIndex={0}
                aria-selected={selecionada === p.fmaId}
                onClick={() => agir(p, 'selecionar')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') agir(p, 'selecionar');
                  if (e.key === ' ') {
                    e.preventDefault();
                    agir(p, 'alternar');
                  }
                }}
              >
                {p.nomePt}
                {soltas.some((x) => x.fmaId === p.fmaId) && <span aria-label="solta"> ⇢</span>}
              </li>
            )),
        ])}
      </ul>
    </details>
  );
}
