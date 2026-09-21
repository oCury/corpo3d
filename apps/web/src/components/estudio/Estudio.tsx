'use client';
import { Cena } from '@/components/viewer/Cena';
import { PainelCamadas } from './PainelCamadas';
import { Controles } from './Controles';

export function Estudio() {
  return (
    <div className="estudio">
      <aside className="painel painel-esquerdo" aria-label="Camadas e montagem">
        <PainelCamadas />
        <Controles />
      </aside>
      <section className="palco" aria-label="Modelo 3D">
        <Cena />
      </section>
      <aside className="painel painel-direito" aria-label="Peça selecionada" data-testid="painel-peca" />
    </div>
  );
}
