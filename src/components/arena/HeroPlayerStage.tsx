'use client';

import React, { useState, useEffect } from 'react';
import {
  Flame,
  Gavel,
  Dice5,
  Layers,
  UserPlus,
  Radio,
  Plane,
  Sparkles,
  Trophy,
  Shield,
  Clock,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FRANCHISES } from '@/data/franchises';
import { formatIndianCurrency } from '@/lib/utils';
import { PlayerSet } from '@/types/auction';
import { FranchiseLogo } from '@/components/common/FranchiseLogo';
import { getFranchiseTheme, BroadcastCricketSilhouette } from '@/lib/franchiseThemes';

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
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activePlayer = room?.activePlayer;
  const highestTeam = room?.highestBidderTeam ? FRANCHISES[room.highestBidderTeam] : null;
  const franchiseTheme = getFranchiseTheme(room?.highestBidderTeam);

  // 15-second TV broadcast shot-clock countdown reset on new bid or active player change
  useEffect(() => {
    if (!activePlayer) {
      setTimeLeft(15);
      return;
    }
    setTimeLeft(15);
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [activePlayer?.id, room?.currentBid]);

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
      alert(err instanceof Error ? err.message : 'Failed to nominate next player');
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

  // Derive role label format
  const getRoleBadge = (roleStr?: string) => {
    switch (roleStr?.toUpperCase()) {
      case 'BAT':
        return 'BATTER';
      case 'WK':
        return 'WICKETKEEPER';
      case 'AR':
        return 'ALL-ROUNDER';
      case 'BOWL':
        return 'BOWLER';
      default:
        return roleStr || 'PLAYER';
    }
  };

  // Check if player was just hammered
  const lastAction = room?.lastActionMessage || '';
  const isJustSold =
    room?.phase === 'SOLD' ||
    (lastAction.includes('SOLD to') && lastAction.includes(activePlayer?.name || '---'));
  const isJustUnsold =
    room?.phase === 'UNSOLD' ||
    (lastAction.includes('UNSOLD') && lastAction.includes(activePlayer?.name || '---'));

  return (
    <div className="flex-1 min-h-0 w-full relative flex items-center justify-center p-2">
      {activePlayer ? (
        /* HERO ACTIVE PLAYER TV LOWER-THIRD CARD */
        <div className="relative w-full max-w-5xl h-full max-h-[500px] bg-[#0A1138]/90 border border-amber-500/30 rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col justify-between overflow-hidden backdrop-blur-xl">
          {/* Dynamic Radial Ambient Spotlight */}
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-72 rounded-full blur-3xl pointer-events-none opacity-30 transition-all duration-700"
            style={{
              backgroundColor: highestTeam ? franchiseTheme.primaryColor : '#F59E0B',
            }}
          />

          {/* Diagonal Watermark Stripes */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(255,255,255,0.06) 12px, rgba(255,255,255,0.06) 24px)',
            }}
          />

          {/* OVERLAY: TV BROADCAST STAMP SLAM (SOLD / UNSOLD) */}
          {isJustSold && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
              <div className="animate-stamp-slam border-8 border-emerald-400 bg-emerald-950/95 text-emerald-400 font-display font-black text-4xl sm:text-6xl px-10 py-4 rounded-3xl tracking-widest uppercase shadow-2xl drop-shadow-[0_15px_30px_rgba(16,185,129,0.6)] text-center">
                <span>SOLD • {highestTeam?.name || 'FRANCHISE'}</span>
                <span className="block text-2xl sm:text-3xl font-mono text-white mt-1 tabular-nums">
                  {formatIndianCurrency(room?.currentBid || activePlayer.basePrice)}
                </span>
              </div>
            </div>
          )}

          {isJustUnsold && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
              <div className="animate-stamp-slam border-8 border-rose-500 bg-rose-950/95 text-rose-400 font-display font-black text-4xl sm:text-6xl px-12 py-4 rounded-3xl tracking-widest uppercase shadow-2xl drop-shadow-[0_15px_30px_rgba(244,63,94,0.6)]">
                UNSOLD
              </div>
            </div>
          )}

          {/* Split Stage: Left Portrait Stage + Right Broadcast Stack */}
          <div className="flex flex-col md:flex-row items-center gap-6 relative z-10 my-auto">
            {/* Left Framed Portrait / Silhouette Stage */}
            <div className="relative shrink-0 flex items-center justify-center">
              <div className="relative w-36 h-44 sm:w-44 sm:h-52 rounded-2xl bg-gradient-to-b from-[#121E5C] via-[#091136] to-[#04081E] border-2 border-amber-500/40 p-2 shadow-2xl flex flex-col items-center justify-center overflow-hidden group">
                {/* Glowing radial spotlight behind player */}
                <div
                  className="absolute inset-0 rounded-full blur-xl opacity-40 transition-colors duration-500"
                  style={{
                    backgroundColor: highestTeam ? franchiseTheme.primaryColor : '#F59E0B',
                  }}
                />

                {activePlayer.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activePlayer.imageUrl}
                    alt={activePlayer.name}
                    className="w-full h-full object-contain relative z-10 drop-shadow-2xl transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <BroadcastCricketSilhouette
                    code={highestTeam?.code || 'CSK'}
                    size="lg"
                    className="relative z-10"
                  />
                )}

                {/* Country / Overseas Badge */}
                <div className="absolute top-2 left-2 z-20">
                  {activePlayer.isOverseas ? (
                    <div className="ipl-slant bg-amber-400 text-slate-950 font-display font-extrabold text-[10px] px-2.5 py-0.5 tracking-wider flex items-center gap-1 shadow-md">
                      <Plane className="w-3 h-3" />
                      <span>OVERSEAS</span>
                    </div>
                  ) : (
                    <div className="ipl-slant bg-emerald-500 text-slate-950 font-display font-extrabold text-[10px] px-2.5 py-0.5 tracking-wider shadow-md">
                      <span>INDIA</span>
                    </div>
                  )}
                </div>

                {/* Set Tag Bottom Ribbon */}
                <div className="absolute bottom-1 right-2 z-20 text-[10px] font-display font-bold uppercase tracking-wider text-amber-300">
                  {activePlayer.set}
                </div>
              </div>
            </div>

            {/* Right Broadcast Data Stack */}
            <div className="flex-1 w-full flex flex-col justify-between gap-3">
              {/* Row 1: Role, Country & Base Price */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="ipl-slant bg-amber-500 text-slate-950 font-display font-extrabold text-xs px-3 py-0.5 uppercase tracking-wider shadow">
                    {getRoleBadge(activePlayer.role)}
                  </span>
                  <span className="text-xs font-semibold text-slate-300 font-sans">
                    {activePlayer.country}
                  </span>
                  {activePlayer.previousTeam && (
                    <span className="text-xs text-slate-400 font-sans">
                      • Prev: <strong className="text-white">{activePlayer.previousTeam}</strong>
                    </span>
                  )}
                </div>

                {/* Base Price Crisp White Angled Slab */}
                <div className="ipl-slant bg-white text-[#070D26] px-4 py-1 shadow-lg shrink-0 flex items-center gap-2">
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-slate-600">
                    BASE PRICE
                  </span>
                  <span className="font-display font-extrabold text-lg tabular-nums">
                    {formatIndianCurrency(activePlayer.basePrice)}
                  </span>
                </div>
              </div>

              {/* Row 2: Huge Barlow Condensed Player Name */}
              <div>
                <h1 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-white tracking-tight uppercase leading-none drop-shadow-md">
                  {activePlayer.name}
                </h1>
                {activePlayer.statsSummary && (
                  <p className="text-xs text-amber-300/80 font-mono mt-1 truncate">
                    {activePlayer.statsSummary}
                  </p>
                )}
              </div>

              {/* Row 3: Dynamic Leading Team TV Banner & Shot-Clock */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-1">
                {/* Dynamic Leading Team Bid Slab */}
                <div
                  className="ipl-slant flex-1 px-4 py-3 shadow-xl transition-all duration-300 flex items-center justify-between gap-4"
                  style={{
                    background: highestTeam
                      ? franchiseTheme.bannerGradient
                      : 'linear-gradient(90deg, #1E293B 0%, #0F172A 100%)',
                    color: highestTeam ? franchiseTheme.textColor : '#FFFFFF',
                  }}
                >
                  {/* Left: Leader Info */}
                  <div className="flex items-center gap-3">
                    {highestTeam ? (
                      <FranchiseLogo code={highestTeam.code} size="md" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                        <Flame className="w-5 h-5 text-amber-400 animate-bounce" />
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest block opacity-85">
                        {room?.currentBid && room.currentBid > 0
                          ? 'LEADING FRANCHISE BID'
                          : 'OPENING STAGE PRICE'}
                      </span>
                      <strong className="font-display font-extrabold text-base md:text-lg tracking-tight uppercase block leading-none">
                        {highestTeam ? highestTeam.name : 'AWAITING OPENING BID'}
                      </strong>
                    </div>
                  </div>

                  {/* Right: Big Price Figure */}
                  <div className="text-right shrink-0">
                    <span className="font-display font-black text-3xl sm:text-4xl md:text-5xl tracking-tight tabular-nums block leading-none drop-shadow-md">
                      {room?.currentBid && room.currentBid > 0
                        ? formatIndianCurrency(room.currentBid)
                        : formatIndianCurrency(activePlayer.basePrice)}
                    </span>
                  </div>
                </div>

                {/* TV Shot-Clock Timer Ring / Bar */}
                <div
                  className={`ipl-slant shrink-0 px-4 py-2 flex flex-col items-center justify-center transition-colors duration-300 ${
                    timeLeft <= 5
                      ? 'bg-rose-950/90 text-rose-300 border-2 border-rose-500 animate-pulse'
                      : 'bg-slate-900/90 text-amber-400 border border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-display font-black text-2xl tabular-nums">
                      {timeLeft}s
                    </span>
                  </div>
                  <span className="text-[8px] font-display font-bold uppercase tracking-widest text-slate-400">
                    HAMMER TIMER
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Live Action Ribbon */}
          <div className="bg-[#050922]/90 border border-white/10 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-slate-300 relative z-10 mt-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
              <span className="font-display font-bold text-amber-400 tracking-wide uppercase">
                TATA IPL LIVE ARENA:
              </span>
              <span className="text-slate-300 text-xs truncate max-w-md hidden sm:inline">
                {room?.lastActionMessage || 'Franchises actively bidding • Auctioneer controlling gavel'}
              </span>
            </div>
            <span className="font-display font-bold text-slate-400 uppercase text-[11px] shrink-0">
              SET: {activePlayer.set} • {getRoleBadge(activePlayer.role)}
            </span>
          </div>
        </div>
      ) : (
        /* IDLE STAGE: TATA IPL 2027 AUCTION CENTERPIECE */
        <div className="w-full max-w-2xl bg-gradient-to-b from-[#101A4F]/95 via-[#0A1138]/95 to-[#060A22]/95 border-2 border-amber-500/40 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden backdrop-blur-xl">
          {/* Ambient Floodlight Beams */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-56 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />

          {/* Stadium Diagonal Watermark Stripes */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(255,255,255,0.06) 12px, rgba(255,255,255,0.06) 24px)',
            }}
          />

          {/* TATA IPL Podium Crest */}
          <div className="relative mb-3 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-0.5 shadow-2xl shadow-amber-500/30">
              <div className="w-full h-full bg-[#070D26] rounded-2xl flex flex-col items-center justify-center">
                <Gavel className="w-9 h-9 text-amber-400 animate-pulse" />
              </div>
            </div>
            <div className="absolute -bottom-2 bg-amber-400 text-slate-950 font-display font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
              OFFICIAL GAVEL
            </div>
          </div>

          <span className="text-xs font-display font-bold uppercase tracking-widest text-amber-400 mb-1">
            TATA IPL 2027 MINI-AUCTION
          </span>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight uppercase drop-shadow">
            LIVE AUCTION STAGE
          </h2>
          <p className="text-xs text-slate-300 max-w-md mt-1 leading-relaxed font-sans">
            Ready for next player nomination onto the auction block. Filter by pool or draw directly.
          </p>

          {/* Session Stats Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5 text-xs font-display">
            <span className="bg-[#050922] border border-emerald-500/40 text-emerald-300 font-bold px-3.5 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5">
              <span>⭐ SOLD:</span>
              <strong className="text-white tabular-nums font-black">{room?.soldHistory?.length || 0}</strong>
            </span>
            <span className="bg-[#050922] border border-amber-500/40 text-amber-300 font-bold px-3.5 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5">
              <span>📦 IN POOL:</span>
              <strong className="text-white tabular-nums font-black">
                {room?.allPlayers?.filter((p) => p.status === 'UPCOMING').length || 0}
              </strong>
            </span>
            <span className="bg-[#050922] border border-rose-500/40 text-rose-300 font-bold px-3.5 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5">
              <span>❌ UNSOLD:</span>
              <strong className="text-white tabular-nums font-black">{room?.unsoldHistory?.length || 0}</strong>
            </span>
          </div>

          {/* Auctioneer Controls / Waiting State */}
          <div className="w-full mt-6" suppressHydrationWarning>
            {isMounted && isAuctioneerOrHost ? (
              <div className="flex flex-col gap-3">
                {/* Pool Filter Dropdown + CTA Button */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
                  <select
                    value={selectedSet}
                    onChange={(e) => setSelectedSet(e.target.value)}
                    className="w-full sm:w-52 bg-[#050922] border-2 border-amber-500/40 text-amber-300 text-xs font-display font-bold px-3.5 py-3 rounded-xl outline-none cursor-pointer focus:border-amber-400 uppercase tracking-wide"
                  >
                    <option value="ALL">🎲 ALL POOLS (RANDOM)</option>
                    {sets.map((s) => (
                      <option key={s} value={s}>
                        🏏 {s.toUpperCase()}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleDrawNext}
                    disabled={isDrawing || room?.phase === 'COMPLETED'}
                    className="ipl-slant flex-1 w-full ipl-gold-gradient hover:brightness-110 disabled:opacity-40 text-slate-950 font-display font-black py-3.5 px-6 text-base tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition transform hover:scale-[1.01] cursor-pointer uppercase"
                  >
                    <Dice5 className="w-5 h-5" />
                    <span>{isDrawing ? 'NOMINATING PLAYER...' : 'NOMINATE NEXT PLAYER'}</span>
                  </button>
                </div>

                {/* Secondary Actions */}
                <div className="flex items-center justify-center gap-2 pt-1 font-display">
                  {onOpenCatalog && (
                    <button
                      onClick={onOpenCatalog}
                      className="bg-[#070D26] hover:bg-[#0E1B4D] text-slate-200 border border-white/15 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow cursor-pointer uppercase tracking-wider"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Player Pool ({room?.allPlayers?.filter((p) => p.status === 'UPCOMING').length || 0})</span>
                    </button>
                  )}

                  {onOpenCustomPlayer && (
                    <button
                      onClick={onOpenCustomPlayer}
                      className="bg-[#070D26] hover:bg-[#0E1B4D] text-slate-200 border border-white/15 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow cursor-pointer uppercase tracking-wider"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Add Custom Player</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#050922] border border-amber-500/30 text-xs text-slate-300 flex items-center justify-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="font-display font-bold uppercase tracking-wide text-amber-300">
                  AWAITING AUCTIONEER TO NOMINATE NEXT PLAYER ONTO THE STAGE...
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
