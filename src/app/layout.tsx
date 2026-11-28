import type { Metadata } from 'next';
import './globals.css';
import { MiniLiveAuctionWidget } from '@/components/layout/MiniLiveAuctionWidget';

export const metadata: Metadata = {
  title: 'TATA IPL 2027 Live Auction Arena',
  description: 'Authentic TATA IPL live television broadcast match center and real-time multiplayer auction arena.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-[#070D26] text-slate-100 antialiased selection:bg-amber-400 selection:text-slate-950">
        {children}
        <MiniLiveAuctionWidget />
      </body>
    </html>
  );
}
