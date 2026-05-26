import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Condomínio App',
  description: 'Sistema de gestão condominial',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
