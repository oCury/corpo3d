import Link from 'next/link';
export const metadata = { title: 'Atribuição — Corpo3D' };
export default function Atribuicao() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px', height: 'auto' }}>
      <h1>Atribuição e licenças</h1>
      <p>Os modelos anatômicos deste site derivam do banco de dados BodyParts3D:</p>
      <blockquote>BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International</blockquote>
      <p>Licença: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Fonte: <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/">dbarchive.biosciencedbc.jp/en/bodyparts3d</a>.</p>
      <p>As malhas foram convertidas, simplificadas e comprimidas para uso no navegador. Os nomes em português, os
        textos explicativos e o software deste site são de autoria própria e não fazem parte do banco original.</p>
      <p>Material educativo. Não substitui consulta nem orientação do seu médico.</p>
      <p><Link href="/">← voltar ao modelo</Link></p>
    </main>
  );
}
