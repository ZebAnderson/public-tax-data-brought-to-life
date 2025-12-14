import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { MainLayout } from '@/components/layout/MainLayout';
import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata: Metadata = {
  title: 'TaxAtlas - Know Your Tax Burden',
  description: 'Explore tax rates, accountability, and pending changes for any location.',
  other: {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org; connect-src 'self' https://tile.openstreetmap.org ws: wss:; font-src 'self' data:; frame-src 'self';",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
