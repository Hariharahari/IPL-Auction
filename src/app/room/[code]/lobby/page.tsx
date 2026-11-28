'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Gavel,
  Shield,
  Users,
  Copy,
  Check,
  Crown,
  Play,
  ArrowRight,
  Eye,
  Settings,
  Sparkles,
  FileSpreadsheet,
  PowerOff,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FRANCHISE_LIST, FRANCHISES } from '@/data/franchises';
import { FranchiseCode } from '@/types/auction';
import { formatIndianCurrency } from '@/lib/utils';
import { PlayerPoolUploader, UploadTarget } from '@/components/arena/PlayerPoolUploader';
import { FranchiseLogo } from '@/components/common/FranchiseLogo';

export default function RoomLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.code as string)?.toUpperCase();

  const {
    userId,
    userName,
    role,
    franchiseCode,
    room,
    isHost,
    isConnected,
    initSocket,
    claimRole,
    setCaptain,
    startAuction,
  } = useAuctionStore();

  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadInitialTarget, setUploadInitialTarget] = useState<UploadTarget>('RETAINED_SQUADS');
  const [autoRandomStart, setAutoRandomStart] = useState(true);
  const [startSet, setStartSet] = useState('Marquee');

  useEffect(() => {
    if (roomCode) {
      initSocket(roomCode);
    }
  }, [roomCode, initSocket]);

  // If room phase has moved beyond LOBBY, navigate to arena
  useEffect(() => {
    if (room && room.phase !== 'LOBBY') {
      router.push(`/room/${roomCode}/arena`);
    }
  }, [room?.phase, roomCode, router]);

  const copyRoomCode = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClaimAuctioneer = async () => {
    setActionError(null);
    const res = await claimRole('AUCTIONEER');
    if (!res.success && res.error) {
      setActionError(res.error);
    }
  };

  const handleClaimSpectator = async () => {
    setActionError(null);
    await claimRole('SPECTATOR');
  };

  const handleJoinFranchise = async (code: FranchiseCode) => {
    setActionError(null);
    const res = await claimRole('TEAM_MEMBER', code);
    if (!res.success && res.error) {
      setActionError(res.error);
    }
  };

  const handleStartAuction = async () => {
    setIsStarting(true);
    setActionError(null);
    try {
      const res = await startAuction({
        autoNominate: autoRandomStart,
        mode: 'RANDOM',
        set: startSet,
      });
      if (res.success) {
        router.push(`/room/${roomCode}/arena`);
      } else {
        setActionError(res.error || 'Failed to start auction');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const auctioneerUser = room?.auctioneerId ? room.users[room.auctioneerId] : null;
  const isAuctioneerOccupied = !!auctioneerUser && auctioneerUser.isOnline;

  // Solo / Multiplayer Mode: Host or Auctioneer can start anytime
  const canStart = isHost || role === 'AUCTIONEER';

  return (
    <div className="min-h-screen ipl-stadium-bg text-slate-100 flex flex-col selection:bg-amber-400 selection:text-slate-950 font-sans">
      {/* Top Header */}
      <header className="border-b border-amber-500/30 bg-[#091136]/90 backdrop-blur-xl px-6 py-4 sticky top-0 z-30 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="ipl-slant px-3 py-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-display font-black text-sm uppercase shadow-md">
              <Gavel className="w-4 h-4 mr-1.5" />
              <span>TATA IPL</span>
            </div>
            <div>
              <h1 className="text-base font-display font-black text-white leading-none uppercase tracking-wide">
                AUCTION LOBBY
              </h1>
              <p className="text-xs text-amber-300/80 mt-0.5 font-sans">Franchise & Role Selection Stage</p>
            </div>
          </div>

          {/* Room Code Badge with Copy button */}
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 px-3 py-1.5 rounded-xl transition text-xs group"
          >
            <span className="text-slate-400 font-bold uppercase text-[10px]">Room Code:</span>
            <span className="font-mono font-black text-amber-400 tracking-wider text-sm">
              {roomCode}
            </span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
            )}
          </button>
        </div>

        {/* Start Live Auction Button & Admin Controls */}
        <div className="flex items-center gap-2.5">
          {/* View All Squads Showcase Navigation */}
          <Link
            href={`/room/${roomCode}/squads`}
            className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow"
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span>View All Squads</span>
          </Link>

          {(isHost || role === 'AUCTIONEER') && (
            <>
              {/* Button 1: Upload Current Squad */}
              <button
                onClick={() => {
                  setUploadInitialTarget('RETAINED_SQUADS');
                  setIsUploadModalOpen(true);
                }}
                className="bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border border-blue-800/80 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>Upload Current Squad</span>
              </button>

              {/* Button 2: Upload Auction Pool */}
              <button
                onClick={() => {
                  setUploadInitialTarget('AUCTION_POOL');
                  setIsUploadModalOpen(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700/80 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                <span>Upload Auction Pool</span>
              </button>

              {/* Start Mode Options */}
              <div className="flex items-center gap-1.5 bg-slate-900 border border-amber-500/30 px-2.5 py-1.5 rounded-xl text-xs">
                <input
                  type="checkbox"
                  id="autoRandom"
                  checked={autoRandomStart}
                  onChange={(e) => setAutoRandomStart(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="autoRandom" className="text-slate-300 font-bold text-[11px] cursor-pointer flex items-center gap-1">
                  <span>🎲 Random 1st:</span>
                </label>
                <select
                  value={startSet}
                  onChange={(e) => setStartSet(e.target.value)}
                  disabled={!autoRandomStart}
                  className="bg-slate-950 border border-slate-700 text-amber-300 font-bold text-[11px] rounded px-1.5 py-0.5 outline-none cursor-pointer disabled:opacity-40"
                >
                  <option value="Marquee">Marquee</option>
                  <option value="Batters">Batters</option>
                  <option value="All-Rounders">All-Rounders</option>
                  <option value="Wicketkeepers">Wicketkeepers</option>
                  <option value="Fast Bowlers">Fast Bowlers</option>
                  <option value="Spinners">Spinners</option>
                  <option value="ALL">All Pools</option>
                </select>
              </div>

              <button
                onClick={handleStartAuction}
                disabled={!canStart || isStarting}
                className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 uppercase tracking-wider transition shadow-lg ${
                  canStart
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:brightness-110 shadow-amber-500/20 cursor-pointer animate-pulse'
                    : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isStarting ? 'Starting...' : 'Start Live Auction'}</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('Are you sure you want to end this auction session?')) {
                    if (typeof window !== 'undefined') localStorage.removeItem('ipl_active_room_code');
                    router.push('/');
                  }
                }}
                className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
                title="End Auction session"
              >
                <PowerOff className="w-3.5 h-3.5" />
                <span>End Auction</span>
              </button>
            </>
          )}

          {/* Jump directly to arena if already begun */}
          {room && room.phase !== 'LOBBY' && (
            <Link
              href={`/room/${roomCode}/arena`}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5"
            >
              <span>Enter Arena</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* Settings & Status Bar */}
        {room && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-300">Room Rules:</span>
              <span className="text-slate-400">
                Purse: <strong className="text-amber-400">{formatIndianCurrency(room.settings.initialPurse)}</strong>
              </span>
              <span className="text-slate-400">
                Squad: <strong className="text-white">{room.settings.minSquadSize} - {room.settings.maxSquadSize}</strong>
              </span>
              <span className="text-slate-400">
                Max OS: <strong className="text-white">{room.settings.maxOverseas}</strong>
              </span>
              <span className="text-slate-400">
                Pacing: <strong className="text-emerald-400">Auctioneer Gavel (No Timer Limit)</strong>
              </span>
              <span className="text-slate-400">
                Rule: <strong className="text-white">{room.settings.biddingPermission.replace('_', ' ')}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">
                {Object.values(room.users).filter((u) => u.isOnline).length} Users Online
              </span>
            </div>
          </div>
        )}

        {actionError && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs font-bold text-rose-300 text-center">
            {actionError}
          </div>
        )}

        {/* Top Tier: Special Seats (Auctioneer Podium & Spectator Box) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Auctioneer Seat */}
          <div
            className={`border rounded-2xl p-5 flex items-center justify-between transition ${
              role === 'AUCTIONEER'
                ? 'bg-amber-950/20 border-amber-500 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Gavel className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm text-white uppercase tracking-wider">
                    Auctioneer Seat
                  </h3>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                    1 Seat Only
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Controls player nominations, gavel hammer, timer, and RTM decisions.
                </p>
                {auctioneerUser && (
                  <p className="text-xs font-bold text-amber-400 mt-1">
                    Occupied by: {auctioneerUser.name} {auctioneerUser.id === userId && '(You)'}
                  </p>
                )}
              </div>
            </div>

            {role === 'AUCTIONEER' ? (
              <span className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg">
                Your Seat
              </span>
            ) : (
              <button
                onClick={handleClaimAuctioneer}
                disabled={isAuctioneerOccupied}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-xl border border-slate-700 transition"
              >
                {isAuctioneerOccupied ? 'Occupied' : 'Claim Podium'}
              </button>
            )}
          </div>

          {/* Spectator Option */}
          <div
            className={`border rounded-2xl p-5 flex items-center justify-between transition ${
              role === 'SPECTATOR'
                ? 'bg-blue-950/20 border-blue-500 shadow-lg shadow-blue-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Eye className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white uppercase tracking-wider">
                  Spectator Lounge
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Watch the live broadcast stream and listen to stage bidding as an audience member.
                </p>
              </div>
            </div>

            {role === 'SPECTATOR' ? (
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold text-xs px-3 py-1.5 rounded-lg">
                Spectating
              </span>
            ) : (
              <button
                onClick={handleClaimSpectator}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2 rounded-xl border border-slate-700 transition"
              >
                Join as Spectator
              </button>
            )}
          </div>
        </div>

        {/* 10 IPL Franchise Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-white uppercase tracking-wide flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              10 IPL Franchise Tables
            </h3>
            <span className="text-xs text-slate-400">
              Pick your franchise to strategize in team voice huddles & place live bids
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {FRANCHISE_LIST.map((team) => {
              const isMyTeam = franchiseCode === team.code;
              const teamMembers = room
                ? Object.values(room.users).filter(
                    (u) => u.franchiseCode === team.code && u.isOnline
                  )
                : [];
              const captain = teamMembers.find((u) => u.teamRole === 'CAPTAIN');

              return (
                <div
                  key={team.code}
                  className={`bg-slate-900/90 border rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 relative overflow-hidden group shadow-lg ${
                    isMyTeam
                      ? 'border-amber-400 bg-slate-900 shadow-amber-500/10 ring-1 ring-amber-400'
                      : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {/* Top Franchise Accent Bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: team.primaryColor }}
                  />

                  <div>
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-3">
                      <FranchiseLogo code={team.code} size="md" className="shadow-md" />

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                        {teamMembers.length} Members
                      </span>
                    </div>

                    <h4 className="font-black text-sm text-white mb-0.5 group-hover:text-amber-400 transition">
                      {team.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium mb-3">
                      {team.city}
                    </p>

                    {/* Members List */}
                    <div className="space-y-1 mb-4 min-h-[60px]">
                      {teamMembers.length === 0 ? (
                        <p className="text-[11px] text-slate-600 italic">No members yet</p>
                      ) : (
                        teamMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between text-xs bg-slate-950/60 rounded px-2 py-1 border border-slate-800/80"
                          >
                            <span className="truncate text-slate-300 font-medium">
                              {m.name} {m.id === userId && '(You)'}
                            </span>
                            {m.teamRole === 'CAPTAIN' && (
                              <span className="flex items-center gap-0.5 text-amber-400 text-[10px] font-bold shrink-0">
                                <Crown className="w-3 h-3" />
                                Capt
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Join / Status Button */}
                  <div>
                    {isMyTeam ? (
                      <div className="w-full bg-amber-500/20 text-amber-400 border border-amber-500/40 font-black text-xs py-2 rounded-xl text-center">
                        Joined Team Table
                      </div>
                    ) : (
                      <button
                        onClick={() => handleJoinFranchise(team.code)}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2 rounded-xl border border-slate-700 transition"
                      >
                        Join {team.code}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Upload Player Pool Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <PlayerPoolUploader
            initialTarget={uploadInitialTarget}
            onClose={() => setIsUploadModalOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
