'use client';

import React, { useEffect, useState } from 'react';
import {
  Gavel,
  Sparkles,
  Trophy,
  X,
  Dice5,
  ArrowRight,
  Shield,
  Plane,
  Coins,
  CheckCircle2,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FRANCHISES } from '@/data/franchises';
import { formatIndianCurrency } from '@/lib/utils';
import { BoughtPlayer, FranchiseCode } from '@/types/auction';

interface SoldPlayerCelebrationModalProps {
  soldData?: {
    player: BoughtPlayer;
    winningTeam: FranchiseCode;
    finalAmount: number;
    message?: string;
  } | null;
  onClose?: () => void;
}

export const SoldPlayerCelebrationModal: React.FC<SoldPlayerCelebrationModalProps> = ({
  soldData: propSoldData,
  onClose,
}) => {
  const {
    latestSoldPlayer,
    clearLatestSoldPlayer,
    nominateNext,
    role,
    isHost,
    room,
    userId,
  } = useAuctionStore();

  const isAuctioneerOrHost =
    role === 'AUCTIONEER' ||
    isHost ||
    room?.auctioneerId === userId ||
    room?.hostId === userId;

  const data = propSoldData || latestSoldPlayer;
  const [countdown, setCountdown] = useState<number>(8);
  const [isDrawingNext, setIsDrawingNext] = useState<boolean>(false);

  // Play synthesized gavel audio strike on popup
  useEffect(() => {
    if (!data) return;
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        // Double gavel tap sound
        const playTap = (time: number, freq: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, time);
          gain.gain.setValueAtTime(0.3, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(time);
          osc.stop(time + 0.2);
        };
        playTap(ctx.currentTime, 160);
        playTap(ctx.currentTime + 0.14, 140);
        playTap(ctx.currentTime + 0.28, 120);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }, [data]);

  // Countdown timer auto-dismiss for non-auctioneers
  useEffect(() => {
    if (!data) return;
    setCountdown(8);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [data]);

  const handleDismiss = () => {
    if (onClose) onClose();
    clearLatestSoldPlayer();
  };

  const handleNominateNextFromModal = async () => {
    setIsDrawingNext(true);
    try {
      handleDismiss();
      await nominateNext({ mode: 'RANDOM' });
    } catch (e) {
      console.warn('Nominate next from modal info:', e);
    } finally {
      setIsDrawingNext(false);
    }
  };

  if (!data) return null;

  const player = data.player;
  const franchise = FRANCHISES[data.winningTeam];
  const teamState = room?.teams[data.winningTeam];
  const remainingPurse = teamState?.remainingPurse ?? 0;
  const soldAmount = data.finalAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Decorative Gold & Franchise Radial Glow */}
      <div
        className="absolute w-[620px] h-[620px] rounded-full blur-[130px] opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${franchise?.primaryColor || '#F59E0B'} 0%, transparent 70%)`,
        }}
      />

      {/* Main Celebration Card */}
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/80 rounded-3xl p-6 shadow-2xl shadow-amber-500/20 flex flex-col items-center text-center overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Animated Celebration Confetti Ribbons */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-400 animate-pulse" />

        {/* Top Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          title="Close celebration"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Celebratory Header Badge */}
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 border border-amber-400/50 px-4 py-1.5 rounded-full mb-4 shadow-lg">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span className="text-xs font-black uppercase tracking-widest text-amber-300">
            🔨 HAMMER DOWN — SOLD!
          </span>
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
        </div>

        {/* Player Avatar & Details */}
        <div className="relative mb-3">
          <div
            className="w-24 h-24 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-slate-900 shadow-xl"
            style={{ borderColor: franchise?.primaryColor || '#F59E0B' }}
          >
            {player.imageUrl ? (
              <img
                src={player.imageUrl}
                alt={player.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-800 to-slate-900 text-amber-400 font-black text-xl">
                <span>{player.role}</span>
                <span className="text-[10px] text-slate-400">IPL</span>
              </div>
            )}
          </div>

          {/* Franchise Crest Badge Overlay */}
          <div
            className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shadow-lg border-2 border-slate-950"
            style={{
              backgroundColor: franchise?.primaryColor || '#1E293B',
              color: franchise?.textColor || '#FFFFFF',
            }}
          >
            {franchise?.code}
          </div>
        </div>

        {/* Player Name & Role */}
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">
          {player.name}
        </h2>

        <div className="flex items-center gap-2 mb-4 text-xs font-bold">
          <span className="bg-slate-800 text-amber-400 px-2.5 py-0.5 rounded-md border border-slate-700 uppercase">
            {player.role}
          </span>
          <span className="text-slate-400 flex items-center gap-1">
            {player.country}
            {player.isOverseas && (
              <span className="bg-blue-950 text-blue-300 text-[10px] px-1.5 py-0.2 rounded border border-blue-800 flex items-center gap-0.5">
                <Plane className="w-2.5 h-2.5" /> Overseas
              </span>
            )}
          </span>
        </div>

        {/* Sold To Banner */}
        <div
          className="w-full rounded-2xl p-4 mb-4 border flex flex-col items-center gap-2 shadow-inner"
          style={{
            backgroundColor: `${franchise?.primaryColor}15`,
            borderColor: `${franchise?.primaryColor}60`,
          }}
        >
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Sold To Franchise
          </span>

          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full animate-ping"
              style={{ backgroundColor: franchise?.primaryColor }}
            />
            <span
              className="text-xl sm:text-2xl font-black tracking-wide"
              style={{ color: franchise?.primaryColor }}
            >
              {franchise?.name} ({franchise?.code})
            </span>
          </div>

          {/* Winning Hammer Amount */}
          <div className="mt-1 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Winning Final Price
            </span>
            <span className="text-3xl sm:text-4xl font-black text-amber-400 font-mono tracking-tight tabular-nums">
              {formatIndianCurrency(soldAmount)}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              (Base Price: {formatIndianCurrency(player.basePrice)})
            </span>
          </div>
        </div>

        {/* Updated Franchise Purse Metrics */}
        <div className="w-full grid grid-cols-2 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800 mb-4 text-xs">
          <div className="text-left">
            <span className="text-[10px] text-slate-400 block font-bold uppercase">
              Remaining Purse
            </span>
            <span className="font-black text-emerald-400 font-mono">
              {formatIndianCurrency(remainingPurse)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-bold uppercase">
              Roster Size
            </span>
            <span className="font-bold text-slate-200">
              {teamState?.squad?.length ?? 1}/25 ({teamState?.overseasCount ?? 0}/8 OS)
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="w-full flex flex-col sm:flex-row items-center gap-2.5">
          {isAuctioneerOrHost && (
            <button
              onClick={handleNominateNextFromModal}
              disabled={isDrawingNext}
              className="flex-1 w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Dice5 className="w-4 h-4" />
              <span>{isDrawingNext ? 'Drawing Player...' : '🎲 Nominate Next Player'}</span>
            </button>
          )}

          <button
            onClick={handleDismiss}
            className={`w-full py-3 px-4 rounded-xl text-xs font-bold border transition cursor-pointer ${
              isAuctioneerOrHost
                ? 'sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 font-black shadow-lg shadow-emerald-900/30'
            }`}
          >
            <span>Dismiss ({countdown}s)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
