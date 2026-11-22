'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Gavel,
  Maximize2,
  ChevronUp,
  ChevronDown,
  Zap,
  Users,
  Radio,
  PowerOff,
  X,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { formatIndianCurrency, getStoredUser } from '@/lib/utils';
import { FRANCHISES } from '@/data/franchises';

export const MiniLiveAuctionWidget: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const {
    roomCode: storeRoomCode,
    room,
    franchiseCode,
    placeBid,
    initSocket,
    endAuction,
    leaveAuction,
  } = useAuctionStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const isEndingRef = React.useRef(false);

  // Sync and persist active room code
  useEffect(() => {
    if (storeRoomCode) {
      setActiveCode(storeRoomCode);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ipl_active_room_code', storeRoomCode);
      }
    } else if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ipl_active_room_code');
      if (saved) {
        setActiveCode(saved);
        initSocket(saved);
      }
    }
  }, [storeRoomCode, initSocket]);

  const code = storeRoomCode || activeCode;
  const isArena = pathname ? pathname.includes(`/room/${code}/arena`) : false;
  const isAuctionEnded = typeof window !== 'undefined' && code ? localStorage.getItem('ipl_auction_ended') === code : false;

  // Don't render on the main Live Arena page itself or if dismissed/no active room code or completed auction
  if (!code || isArena || isDismissed || room?.phase === 'COMPLETED' || isAuctionEnded) {
    return null;
  }

  const activePlayer = room?.activePlayer;
  const highestTeam = room?.highestBidderTeam ? FRANCHISES[room.highestBidderTeam] : null;

  const handleReturnToStage = () => {
    router.push(`/room/${code}/arena`);
  };

  const handleReturnToLobby = () => {
    router.push(`/room/${code}/lobby`);
  };

  const handleReturnToSquads = () => {
    router.push(`/room/${code}/squads`);
  };

  const currentUser = getStoredUser();
  const isSuperAdmin = currentUser.isAdmin || currentUser.userEmail?.toLowerCase() === 'hariharan12403@gmail.com';

  const handleEndAuction = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ipl_active_room_code');
        if (code) localStorage.setItem('ipl_auction_ended', code);
      }
      setIsDismissed(true);
      await endAuction();
      await leaveAuction();
    } catch (e) {
      console.warn('Error ending auction:', e);
    }
    router.refresh();
    router.push('/conducted-auctions');
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end select-none animate-in slide-in-from-bottom-5 duration-300">
      {/* Minimized Pill Mode */}
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-slate-900/95 hover:bg-slate-800 border border-amber-500/70 shadow-2xl backdrop-blur-xl px-4 py-2.5 rounded-full flex items-center gap-3 group transition cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="font-mono font-black text-xs text-amber-400 uppercase tracking-wider">
              Live Auction: {code}
            </span>
          </div>

          {activePlayer ? (
            <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
              <span className="text-xs font-bold text-white max-w-[120px] truncate">
                {activePlayer.name}
              </span>
              <span className="text-xs font-black text-amber-400">
                {room && room.currentBid > 0 ? formatIndianCurrency(room.currentBid) : formatIndianCurrency(activePlayer.basePrice)}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-300 font-bold border-l border-slate-700 pl-3">
              {room?.phase === 'LOBBY' ? 'Lobby' : room?.phase || 'Active'}
            </span>
          )}

          <ChevronUp className="w-4 h-4 text-amber-400 group-hover:-translate-y-0.5 transition" />
        </button>
      ) : (
        /* Compact Floating Corner Card */
        <div className="w-80 md:w-96 bg-slate-900/95 border border-amber-500/50 rounded-2xl shadow-2xl backdrop-blur-xl p-4 flex flex-col gap-3">
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="font-black text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
                <Gavel className="w-3.5 h-3.5 text-amber-400" />
                <span>Live Auction Active</span>
                <span className="font-mono text-amber-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  {code}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                title="Minimize to floating pill"
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsDismissed(true)}
                title="Dismiss widget"
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stage Status & Active Player */}
          {activePlayer ? (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {activePlayer.imageUrl ? (
                    <img
                      src={activePlayer.imageUrl}
                      alt={activePlayer.name}
                      className="w-10 h-10 rounded-xl object-cover border border-amber-500/30"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex flex-col items-center justify-center font-black text-[10px] text-amber-400">
                      <span>{activePlayer.role}</span>
                      <span className="text-[8px] text-slate-400">IPL</span>
                    </div>
                  )}

                  <div>
                    <h4 className="font-black text-sm text-white leading-tight">
                      {activePlayer.name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-bold">
                        {activePlayer.role}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {activePlayer.country}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Bid</span>
                  <span className="text-sm font-black text-amber-400 font-mono">
                    {room && room.currentBid > 0 ? formatIndianCurrency(room.currentBid) : formatIndianCurrency(activePlayer.basePrice)}
                  </span>
                </div>
              </div>

              {/* Leading Franchise Pill */}
              <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2 mt-1">
                <span className="text-slate-400 font-bold">Leader:</span>
                {highestTeam ? (
                  <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: highestTeam.primaryColor }}
                    />
                    <span className="font-black text-white">{highestTeam.code}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500 italic">Waiting for 1st bid</span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-xs font-bold text-slate-300 block">
                Session Status: <strong className="text-amber-400">{room?.phase || 'READY'}</strong>
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                {room?.phase === 'LOBBY'
                  ? 'In Lobby — Auctioneer is preparing player pools.'
                  : room?.lastActionMessage || 'Live bidding session in progress.'}
              </p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleReturnToStage}
              className="flex-1 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer transition"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Enter Live Stage</span>
            </button>

            <button
              onClick={handleReturnToLobby}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-2.5 rounded-xl text-xs transition border border-slate-700 cursor-pointer"
            >
              Lobby
            </button>

            <button
              onClick={handleReturnToSquads}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-2.5 rounded-xl text-xs transition border border-slate-700 cursor-pointer"
            >
              Squads
            </button>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={(e) => handleEndAuction(e)}
                className="bg-rose-950 hover:bg-rose-900 text-rose-300 font-black py-2 px-2.5 rounded-xl text-xs transition border border-rose-800 cursor-pointer"
                title="End this live auction session"
              >
                End
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
