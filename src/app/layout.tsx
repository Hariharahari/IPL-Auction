import type { Metadata } from 'next';
import './globals.css';
import { MiniLiveAuctionWidget } from '@/components/layout/MiniLiveAuctionWidget';

export const metadata: Metadata = {
  title: 'Live Multiplayer IPL Auction Arena',
  description: 'Broadcast-grade real-time multiplayer IPL Auction web application with Next.js, Socket.io, Zustand, and LiveKit.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-black">
        {children}
        <MiniLiveAuctionWidget />
      </body>
    </html>
  );
}
