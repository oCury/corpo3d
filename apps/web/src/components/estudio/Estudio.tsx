'use client';
import { Cena } from '@/components/viewer/Cena';
import { Busca } from './Busca';
import { PainelCamadas } from './PainelCamadas';
import { Controles } from './Controles';
import { ListaPecas } from './ListaPecas';
import { PainelPeca } from './PainelPeca';

export function Estudio() {
  return (
    <div className="estudio">
      <aside className="painel painel-esquerdo" aria-label="Camadas e montagem">
        <Busca />
        <PainelCamadas />
        <Controles />
        <ListaPecas />
      </aside>
      <section className="palco" aria-label="Modelo 3D">
        <Cena />
      </section>
      <aside className="painel painel-direito" aria-label="Peça selecionada" data-testid="painel-peca">
        <PainelPeca />
      </aside>
    </div>
  );
}
