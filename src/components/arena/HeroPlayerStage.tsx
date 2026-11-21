'use client';

import React, { useState } from 'react';
import {
  Flame,
  Globe,
  Gavel,
  Dice5,
  Layers,
  UserPlus,
  Radio,
  Plane,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FRANCHISES } from '@/data/franchises';
import { formatIndianCurrency } from '@/lib/utils';
import { PlayerSet } from '@/types/auction';
import { FranchiseLogo } from '@/components/common/FranchiseLogo';

interface HeroPlayerStageProps {
  onOpenCatalog?: () => void;
  onOpenCustomPlayer?: () => void;
}

export const HeroPlayerStage: React.FC<HeroPlayerStageProps> = ({
  onOpenCatalog,
  onOpenCustomPlayer,
}) => {
  const { room, userId, role, isHost, nominateNext } = useAuctionStore();

  const isAuctioneerOrHost =
    role === 'AUCTIONEER' ||
    isHost ||
    room?.auctioneerId === userId ||
    room?.hostId === userId;

  const [selectedSet, setSelectedSet] = useState<string>('ALL');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const activePlayer = room?.activePlayer;
  const highestTeam = room?.highestBidderTeam ? FRANCHISES[room.highestBidderTeam] : null;

  const handleDrawNext = async () => {
    setIsDrawing(true);
    try {
      const res = await nominateNext({
        mode: 'RANDOM',
        set: selectedSet === 'ALL' ? undefined : selectedSet,
      });
      if (!res.success && res.error) {
        alert(res.error);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to draw next player');
    } finally {
      setIsDrawing(false);
    }
  };

  const sets: PlayerSet[] = [
    'Marquee',
    'Batters',
    'All-Rounders',
    'Wicketkeepers',
    'Fast Bowlers',
    'Spinners',
    'Accelerated',
  ];

  return (
    <div className="flex-1 min-h-0 w-full relative flex items-center justify-center p-2">
      {activePlayer ? (
        /* HERO ACTIVE PLAYER CARD */
        <div className="relative w-full max-w-5xl h-full max-h-[500px] bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-900/95 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col justify-between overflow-hidden backdrop-blur-md">
          {/* Dynamic Radial Ambient Glow */}
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[550px] h-64 rounded-full blur-3xl pointer-events-none opacity-25 transition-all duration-500"
            style={{
              backgroundColor: highestTeam ? highestTeam.primaryColor : '#F59E0B',
            }}
          />

          {/* Top Row: Badges & Base Price */}
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow">
                  {activePlayer.role}
                </span>

                {activePlayer.isOverseas ? (
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs px-2.5 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-sm">
                    <Plane className="w-3.5 h-3.5" />
                    Overseas ({activePlayer.country})
                  </span>
                ) : (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-md font-bold shadow-sm">
                    Indian ({activePlayer.country})
                  </span>
                )}

                {activePlayer.previousTeam && (
                  <span className="text-xs text-slate-400 font-semibold bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800">
                    Prev: <strong className="text-white">{activePlayer.previousTeam}</strong>
                  </span>
                )}

                <span className="text-[11px] font-bold text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Set: {activePlayer.set}
                </span>
              </div>

              {/* Player Name */}
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-md">
                {activePlayer.name}
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-xl font-mono truncate">
                {activePlayer.statsSummary}
              </p>
            </div>

            {/* Base Price Card */}
            <div className="text-right bg-slate-950/80 border border-slate-800 rounded-2xl p-3 shadow-inner shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Base Price</span>
              <span className="text-xl md:text-2xl font-black text-white font-mono">
                {formatIndianCurrency(activePlayer.basePrice)}
              </span>
            </div>
          </div>

          {/* Center Stage: Countdown Ring & Dramatic Highest Bid Banner */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-5 my-auto relative z-10">
            {/* Animated SVG Countdown Ring & Stage Emblem */}
            <div className="relative flex items-center justify-center shrink-0">
              <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/40 flex flex-col items-center justify-center shadow-xl shadow-amber-500/10 overflow-hidden">
                {/* SVG Animated Stroke Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="rgba(245, 158, 11, 0.15)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke={highestTeam ? highestTeam.primaryColor : '#F59E0B'}
                    strokeWidth="4"
                    strokeDasharray="276"
                    strokeDashoffset="60"
                    strokeLinecap="round"
                    className="transition-all duration-700 animate-pulse"
                  />
                </svg>

                <Gavel className="w-8 h-8 text-amber-400 mb-1" />
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  Live Block
                </span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Multiplayer
                </span>
              </div>
            </div>

            {/* Dramatic Current Bid Banner */}
            <div
              className="flex-1 w-full rounded-2xl p-5 border shadow-2xl flex flex-col justify-center relative overflow-hidden transition-all duration-300"
              style={{
                backgroundColor: highestTeam ? `${highestTeam.primaryColor}15` : '#0f172a',
                borderColor: highestTeam ? highestTeam.primaryColor : '#334155',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                  {room?.currentBid && room.currentBid > 0 ? 'Current Highest Bid' : 'Opening Price'}
                </span>
              </div>

              {/* Large Big Bid Number */}
              <div
                className="text-5xl md:text-6xl font-black tracking-tight tabular-nums font-mono drop-shadow"
                style={{
                  color: highestTeam ? highestTeam.primaryColor : '#F59E0B',
                }}
              >
                {room?.currentBid && room.currentBid > 0
                  ? formatIndianCurrency(room.currentBid)
                  : formatIndianCurrency(activePlayer.basePrice)}
              </div>

              {/* Leading Franchise Tag */}
              {highestTeam ? (
                <div
                  className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-black shadow-md self-start animate-in fade-in"
                  style={{
                    backgroundColor: `${highestTeam.primaryColor}25`,
                    borderColor: highestTeam.primaryColor,
                    color: highestTeam.primaryColor,
                  }}
                >
                  <FranchiseLogo code={highestTeam.code} size="xs" />
                  <span>Leader: {highestTeam.name} ({highestTeam.code})</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-2">
                  Awaiting opening bid at base price of {formatIndianCurrency(activePlayer.basePrice)}
                </p>
              )}
            </div>
          </div>

          {/* Bottom Live Voice Bidding Indicator */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-slate-300 relative z-10">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="font-bold text-amber-300">Live Voice Bidding:</span>
              <span className="text-slate-400 hidden sm:inline">
                Call out bids over Live Mic / Camera. The Auctioneer enters final price and strikes the gavel.
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              Set: {activePlayer.set} • {activePlayer.role}
            </span>
          </div>
        </div>
      ) : (
        /* IDLE STAGE: Centered "Draw Next Player" Card */
        <div className="w-full max-w-xl bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-900/95 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden backdrop-blur-md">
          {/* Subtle Ambient Gold Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-44 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          {/* Center Stage Icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3 shadow-xl shadow-amber-500/10">
            <Gavel className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">Stage Ready for Next Nomination</h2>
          <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
            Live multiplayer auction is active. Filter by set and draw players onto the center stage.
          </p>

          {/* Quick Session Stats */}
          <div className="flex items-center gap-2 mt-4 text-[11px] text-slate-400">
            <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              ⭐ Sold: <strong className="text-emerald-400">{room?.soldHistory?.length || 0}</strong>
            </span>
            <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              📦 In Pool:{' '}
              <strong className="text-amber-400">
                {room?.allPlayers?.filter((p) => p.status === 'UPCOMING').length || 0}
              </strong>
            </span>
            <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              ❌ Unsold: <strong className="text-rose-400">{room?.unsoldHistory?.length || 0}</strong>
            </span>
          </div>

          {/* Auctioneer Controls / Waiting State */}
          <div className="w-full mt-6" suppressHydrationWarning>
            {isMounted && isAuctioneerOrHost ? (
              <div className="flex flex-col gap-3">
                {/* Pool Filter Dropdown + Draw Button */}
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                  <select
                    value={selectedSet}
                    onChange={(e) => setSelectedSet(e.target.value)}
                    className="w-full sm:w-48 bg-slate-950 border border-slate-700 text-slate-200 text-xs font-bold px-3 py-3 rounded-xl outline-none cursor-pointer focus:border-amber-400"
                  >
                    <option value="ALL">🎲 All Pools (Random)</option>
                    {sets.map((s) => (
                      <option key={s} value={s}>
                        🎲 {s}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleDrawNext}
                    disabled={isDrawing || room?.phase === 'COMPLETED'}
                    className="flex-1 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black py-3 px-6 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition transform hover:scale-[1.02] cursor-pointer"
                  >
                    <Dice5 className="w-5 h-5" />
                    <span>{isDrawing ? 'Drawing Next Player...' : '🎲 Draw Next Player'}</span>
                  </button>
                </div>

                {/* Secondary Pills: Catalog & Add Custom Player */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  {onOpenCatalog && (
                    <button
                      onClick={onOpenCatalog}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition shadow cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Player Catalog ({room?.allPlayers?.filter((p) => p.status === 'UPCOMING').length || 0})</span>
                    </button>
                  )}

                  {onOpenCustomPlayer && (
                    <button
                      onClick={onOpenCustomPlayer}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition shadow cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Add Custom Player</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Waiting for the Auctioneer to nominate the next player onto the stage...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
