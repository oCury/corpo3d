import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Corpo3D',
  description: 'Corpo humano 3D desmontável para educação de paciente',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
