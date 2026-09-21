import Link from 'next/link';
import { Cena } from '@/components/viewer/Cena';

export default function Pagina() {
  return (
    <main>
      <h1 style={{ position: 'absolute', margin: 0, padding: '12px 16px', fontSize: 16, zIndex: 1 }}>Corpo3D</h1>
      <Cena />
      <p className="rodape">
        Modelos: BodyParts3D, © The Database Center for Life Science, CC BY 4.0 ·{' '}
        <Link href="/atribuicao">atribuição</Link>
      </p>
    </main>
  );
}
