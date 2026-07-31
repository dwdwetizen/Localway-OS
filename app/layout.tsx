import type {Metadata} from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { ClientCrashRecovery } from '@/components/ClientCrashRecovery';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LocalWay OS - Gestão de Marketing Local e Prospecção GBP',
  description: 'Plataforma SaaS premium para agências de marketing local e gestores de perfis Google Business Profile',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning className={`${outfit.variable} antialiased min-h-screen bg-background`}>
        <ClientCrashRecovery />
        {children}
      </body>
    </html>
  );
}
