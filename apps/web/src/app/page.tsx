import Link from 'next/link';
import { Estudio } from '@/components/estudio/Estudio';

export default function Pagina() {
  return (
    <main>
      <h1 className="titulo">Corpo3D</h1>
      <Estudio />
      <p className="rodape">
        Modelos: BodyParts3D, © The Database Center for Life Science, CC BY 4.0 · <Link href="/atribuicao">atribuição</Link>
      </p>
    </main>
  );
}
