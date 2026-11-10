import type { Metadata } from 'next';
import './globals.css';
import { ErrorReporter } from '@/components/ErrorReporter';
import { tokensCss } from './tokens';

export const metadata: Metadata = {
  title: 'Preuvio',
  description: 'La preuve de pose pour les entreprises RGE.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        <style>{tokensCss}</style>
      </head>
      <body className="flex min-h-full flex-col bg-bg text-text">
        <ErrorReporter />
        {children}
      </body>
    </html>
  );
}
