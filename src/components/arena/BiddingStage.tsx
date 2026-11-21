'use client';

import React, { useState } from 'react';
import {
  Flame,
  Globe,
  Sparkles,
  Gavel,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Dice5,
  Mic,
  MicOff,
  Radio,
  Video,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FRANCHISES } from '@/data/franchises';
import { formatIndianCurrency } from '@/lib/utils';
import { getNextBidAmount, validateBid } from '@/server/rules';

export const BiddingStage: React.FC = () => {
  const {
    room,
    userId,
    userName,
    role,
    isHost,
    franchiseCode,
    placeBid,
    nominateNext,
    micRoute,
    setMicRoute,
  } = useAuctionStore();

  const isAuctioneerOrHost =
    role === 'AUCTIONEER' ||
    isHost ||
    room?.auctioneerId === userId ||
    room?.hostId === userId;

  const [bidError, setBidError] = useState<string | null>(null);
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [isDrawingNext, setIsDrawingNext] = useState(false);

  const activePlayer = room?.activePlayer;
  const highestTeam = room?.highestBidderTeam ? FRANCHISES[room.highestBidderTeam] : null;

  // Calculate next bid amount
  const hasBids = !!room?.highestBidderTeam;
  const nextBidAmount = activePlayer
    ? getNextBidAmount(room?.currentBid || 0, hasBids, activePlayer.basePrice)
    : 0;

  // Validate bid state for current user
  let canBid = false;
  let bidDisabledReason = '';

  if (room?.isAuctionPaused) {
    canBid = false;
    bidDisabledReason = 'Auction is currently paused by the Auctioneer';
  } else if (room && franchiseCode && room.users[userId]) {
    const validation = validateBid(room, franchiseCode, room.users[userId]);
    canBid = validation.valid;
    bidDisabledReason = validation.error || '';
  } else if (!franchiseCode) {
    bidDisabledReason = 'Join a franchise team in the lobby to place bids';
  } else if (role === 'AUCTIONEER') {
    bidDisabledReason = 'The Auctioneer cannot place bids';
  }

  const handleBidClick = async () => {
    if (!canBid || isSubmittingBid) return;
    setIsSubmittingBid(true);
    setBidError(null);
    try {
      const res = await placeBid();
      if (!res.success && res.error) {
        setBidError(res.error);
      }
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const handleDrawNextFromPool = async () => {
    setIsDrawingNext(true);
    try {
      const res = await nominateNext({ mode: 'RANDOM' });
      if (!res.success && res.error) {
        alert(res.error);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to draw next player');
    } finally {
      setIsDrawingNext(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Set Badge & Recent Ticker Bar */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2 text-xs backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Current Set:</span>
          <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded border border-amber-500/30">
            {activePlayer ? activePlayer.set : 'Auction Block Idle'}
          </span>
        </div>

        {/* Live Broadcast Action Message */}
        <div className="flex items-center gap-1.5 text-slate-300 font-medium truncate max-w-[380px]">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="truncate">{room?.lastActionMessage || 'Waiting for next player nomination...'}</span>
        </div>
      </div>

      {/* Paused Banner Alert */}
      {room?.isAuctionPaused && (
        <div className="bg-amber-950/90 border border-amber-500/70 rounded-xl p-3 flex items-center justify-between text-amber-300 text-xs font-bold animate-pulse shadow-lg">
          <span className="flex items-center gap-2">
            <span className="text-base">⏸️</span>
            <span>LIVE AUCTION PAUSED BY AUCTIONEER — Bidding is temporarily on hold.</span>
          </span>
          <span className="text-[10px] text-amber-400/80 font-mono">Status: Paused</span>
        </div>
      )}

      {/* Main Active Player Stage Card */}
      <div className="relative bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden backdrop-blur-md">
        {/* Ambient Top Glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{
            backgroundColor: highestTeam ? highestTeam.primaryColor : '#F59E0B',
          }}
        />

        {activePlayer ? (
          <div className="flex flex-col gap-6 relative z-10">
            {/* Player Info Row */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="bg-slate-800 text-amber-400 font-black text-xs px-2.5 py-0.5 rounded-md border border-slate-700 uppercase tracking-wider">
                    {activePlayer.role}
                  </span>
                  {activePlayer.isOverseas ? (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      Overseas ({activePlayer.country})
                    </span>
                  ) : (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-md font-bold">
                      Indian ({activePlayer.country})
                    </span>
                  )}
                  {activePlayer.previousTeam && (
                    <span className="text-[11px] text-slate-400 font-medium">
                      Prev: <strong className="text-white">{activePlayer.previousTeam}</strong>
                    </span>
                  )}
                </div>

                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-sm">
                  {activePlayer.name}
                </h1>
                <p className="text-xs text-slate-400 mt-1 max-w-lg font-mono">
                  {activePlayer.statsSummary}
                </p>
              </div>

              {/* Base Price Pill */}
              <div className="text-right bg-slate-950/80 border border-slate-800 rounded-xl p-3 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Base Price</span>
                <span className="text-xl font-black text-white">
                  {formatIndianCurrency(activePlayer.basePrice)}
                </span>
              </div>
            </div>

            {/* Live Bid Readout & Live Stage Emblem (No Deadline Timer) */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-950/90 border border-slate-800/80 rounded-2xl p-6 shadow-inner">
              {/* Broadcast Stage Emblem (No Deadline Numbers) */}
              <div className="relative flex items-center justify-center shrink-0">
                <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/50 flex flex-col items-center justify-center shadow-xl shadow-amber-500/10 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-amber-500/5 animate-pulse" />
                  <Gavel className="w-9 h-9 text-amber-400 mb-1" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                    Live Bidding
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Auction Block
                  </span>
                </div>
              </div>

              {/* Current Bid Display */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
                  <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                    {room?.currentBid && room.currentBid > 0 ? 'Current Highest Bid' : 'Opening Price'}
                  </span>
                </div>

                <div className="text-5xl md:text-6xl font-black text-amber-400 tracking-tight tabular-nums">
                  {room?.currentBid && room.currentBid > 0
                    ? formatIndianCurrency(room.currentBid)
                    : formatIndianCurrency(activePlayer.basePrice)}
                </div>

                {/* Highest Bidder Franchise Pill */}
                {highestTeam ? (
                  <div
                    className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold shadow-md animate-in fade-in"
                    style={{
                      backgroundColor: `${highestTeam.primaryColor}25`,
                      borderColor: highestTeam.primaryColor,
                      color: highestTeam.primaryColor,
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: highestTeam.primaryColor }} />
                    <span>Leader: {highestTeam.name} ({highestTeam.code})</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-2">
                    Awaiting opening bid at base price of {formatIndianCurrency(activePlayer.basePrice)}
                  </p>
                )}
              </div>
            </div>

            {/* Voice Bidding Action Panel: Manual Auction Mode (No button needed, voice out bids) */}
            <div className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl mt-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500/20 to-amber-400/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded uppercase tracking-wider">
                      Manual Voice Bidding Active
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      No bid buttons required
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    Franchises call out your bids out loud over <strong className="text-amber-400">Live Voice / Camera</strong>. The Auctioneer enters the final hammer price and awards the player.
                  </p>
                </div>
              </div>

              {/* Franchise Quick Mic Toggle Shortcut */}
              {franchiseCode && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setMicRoute(micRoute === 'MAIN' ? 'MUTED' : 'MAIN')}
                    className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition shadow-lg cursor-pointer ${
                      micRoute === 'MAIN'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-rose-900/40 ring-2 ring-rose-400'
                        : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 shadow-amber-500/25'
                    }`}
                  >
                    {micRoute === 'MAIN' ? (
                      <>
                        <MicOff className="w-4 h-4" />
                        <span>Mute Floor Mic</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>🎙️ Unmute Floor Mic</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : room?.phase === 'COMPLETED' ? (
          /* Concluded Stage View */
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Sparkles className="w-14 h-14 text-amber-400 mb-3 animate-bounce" />
            <h2 className="text-2xl font-black text-amber-400">IPL Auction Officially Concluded</h2>
            <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
              The live bidding session has been completed by the Auctioneer. All franchise squads, final bids, and remaining purses are locked on the server.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Players Sold</span>
                <span className="text-base font-black text-emerald-400">{room?.soldHistory?.length || 0}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Unsold Players</span>
                <span className="text-base font-black text-rose-400">{room?.unsoldHistory?.length || 0}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Active Auction Stage View: Waiting for Next Nomination */
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3 shadow-lg shadow-amber-500/10">
              <Gavel className="w-8 h-8 text-amber-400 animate-pulse" />
            </div>
            <h2 className="text-xl font-black text-white">Stage Ready for Next Nomination</h2>
            <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
              Live auction is actively running on the server. Nominate players from the pool or draw randomly to bring them to the block.
            </p>

            {/* Quick Session Stats */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] text-slate-400">
              <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                ⭐ Sold: <strong className="text-emerald-400">{room?.soldHistory?.length || 0}</strong>
              </span>
              <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                📦 In Pool: <strong className="text-amber-400">{room?.allPlayers?.filter((p) => p.status === 'UPCOMING').length || 0}</strong>
              </span>
              <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                ❌ Unsold: <strong className="text-rose-400">{room?.unsoldHistory?.length || 0}</strong>
              </span>
            </div>

            {isAuctioneerOrHost ? (
              <p className="text-xs text-amber-300 font-semibold mt-4 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-xl">
                ⬇️ Use the <strong>Nomination Desk</strong> below to draw or select the next player.
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 mt-4 animate-pulse">
                ⏳ Waiting for the Auctioneer to nominate the next player...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
