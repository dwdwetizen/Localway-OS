import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LocalWay OS - Gestão de Marketing Local e Prospecção GBP',
  description: 'Plataforma SaaS premium para agências de marketing local e gestores de perfis Google Business Profile',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning className="antialiased min-h-screen bg-background">{children}</body>
    </html>
  );
}
