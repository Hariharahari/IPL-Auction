'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Video,
  VideoOff,
  Sparkles,
  Gavel,
  Pause,
  Play,
  Dice5,
  XCircle,
  SkipForward,
  Shield,
  MessageSquare,
  Zap,
  Flame,
  Users,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FRANCHISE_LIST, FRANCHISES } from '@/data/franchises';
import { FranchiseCode } from '@/types/auction';
import { formatIndianCurrency } from '@/lib/utils';
import { getNextBidAmount, validateBid } from '@/server/rules';
import {
  startWebcamStream,
  startVirtualCamStream,
  stopMediaStream,
} from '@/lib/mediaStream';
import { livekitClient } from '@/lib/livekitClient';

interface BottomControlDockProps {
  isTeamsDrawerOpen: boolean;
  setIsTeamsDrawerOpen: (open: boolean) => void;
  isChatDrawerOpen: boolean;
  setIsChatDrawerOpen: (open: boolean) => void;
  isHuddleDrawerOpen: boolean;
  setIsHuddleDrawerOpen: (open: boolean) => void;
  onOpenAwardModal: () => void;
  onOpenCatalog: () => void;
  onOpenCustomPlayer: () => void;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  isTeamsDrawerOpen,
  setIsTeamsDrawerOpen,
  isChatDrawerOpen,
  setIsChatDrawerOpen,
  isHuddleDrawerOpen,
  setIsHuddleDrawerOpen,
  onOpenAwardModal,
  onOpenCatalog,
  onOpenCustomPlayer,
}) => {
  const {
    room,
    userId,
    userName,
    role,
    isHost,
    franchiseCode,
    micRoute,
    setMicRoute,
    isCameraActive,
    setIsCameraActive,
    unreadGlobalCount,
    unreadTeamCount,
    resetUnreadChat,
    isHandRaised,
    toggleHandRaise,
    placeBid,
    nominateNext,
    skipPlayer,
    hammerUnsold,
    togglePauseAuction,
    simulateBid,
  } = useAuctionStore();

  const isAuctioneerOrHost =
    role === 'AUCTIONEER' ||
    isHost ||
    room?.auctioneerId === userId ||
    room?.hostId === userId;

  const [isBidding, setIsBidding] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activePlayer = room?.activePlayer;
  const userFranchise = franchiseCode ? FRANCHISES[franchiseCode] : null;
  const myTeamState = franchiseCode && room?.teams ? room.teams[franchiseCode] : null;

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
    bidDisabledReason = 'Auction Paused';
  } else if (!activePlayer) {
    canBid = false;
    bidDisabledReason = 'Stage Idle';
  } else if (room && franchiseCode && room.users[userId]) {
    const validation = validateBid(room, franchiseCode, room.users[userId]);
    canBid = validation.valid;
    bidDisabledReason = validation.error || '';
  } else if (!franchiseCode) {
    bidDisabledReason = 'Join a franchise to bid';
  } else if (role === 'AUCTIONEER') {
    bidDisabledReason = 'Auctioneer cannot bid';
  }

  const handlePlaceBid = async () => {
    if (!canBid || isBidding) return;
    setIsBidding(true);
    try {
      await placeBid();
    } finally {
      setIsBidding(false);
    }
  };

  const handleCameraToggle = async () => {
    if (isCameraActive) {
      stopMediaStream();
      setIsCameraActive(false);
      await livekitClient.unpublishVideoTrack();
    } else {
      setCameraLoading(true);
      try {
        await startWebcamStream();
        setIsCameraActive(true);
        await livekitClient.publishCurrentStream();
      } catch (err) {
        console.warn('Camera failed, switching to virtual cam:', err);
        startVirtualCamStream(userName || 'Broadcaster');
        setIsCameraActive(true);
        await livekitClient.publishCurrentStream();
      } finally {
        setCameraLoading(false);
      }
    }
  };

  const handleVirtualCam = async () => {
    startVirtualCamStream(userName || 'Broadcaster');
    setIsCameraActive(true);
    await livekitClient.publishCurrentStream();
  };

  const handleMicRoute = async (target: 'MUTED' | 'TEAM' | 'MAIN') => {
    setMicRoute(target);
    await livekitClient.setMicRoute(target);
  };

  const totalUnread = (unreadGlobalCount || 0) + (unreadTeamCount || 0);

  return (
    <footer className="h-16 bg-[#070D26]/95 border-t border-amber-500/30 backdrop-blur-xl px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-2xl relative">
      {/* Championship Gold Border Glow Accent */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent pointer-events-none" />

      {/* LEFT GROUP: Media Controls (Mic, Camera, Virtual Cam) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Mic Routing Toggle */}
        <div className="flex items-center bg-[#050922] p-1 rounded-xl border border-white/10" suppressHydrationWarning>
          <button
            onClick={() => handleMicRoute('MUTED')}
            className={`p-2 rounded-lg text-xs font-display font-bold transition flex items-center gap-1 cursor-pointer uppercase tracking-wider ${
              micRoute === 'MUTED'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-[#0E1A4A]'
            }`}
            title="Mute microphone"
          >
            <MicOff className="w-4 h-4" />
            <span className="hidden md:inline">Mute</span>
          </button>

          {!isAuctioneerOrHost && role === 'TEAM_MEMBER' && franchiseCode && (
            <button
              onClick={() => handleMicRoute('TEAM')}
              className={`p-2 rounded-lg text-xs font-display font-bold transition flex items-center gap-1 cursor-pointer uppercase tracking-wider ${
                micRoute === 'TEAM'
                  ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-[#0E1A4A]'
              }`}
              title="Speak in Private Team Huddle"
            >
              <Users className="w-4 h-4 text-blue-300" />
              <span className="hidden md:inline">Huddle</span>
            </button>
          )}

          <button
            onClick={() => handleMicRoute('MAIN')}
            className={`p-2 rounded-lg text-xs font-display font-black transition flex items-center gap-1 cursor-pointer uppercase tracking-wider ${
              micRoute === 'MAIN'
                ? 'ipl-gold-gradient text-slate-950 shadow-md animate-pulse'
                : 'text-slate-400 hover:text-white hover:bg-[#0E1A4A]'
            }`}
            title="Speak on Main Stage (All Teams Hear)"
          >
            <Radio className="w-4 h-4" />
            <span className="hidden md:inline">Floor</span>
          </button>
        </div>

        {/* Camera Toggle Button */}
        <button
          onClick={handleCameraToggle}
          disabled={cameraLoading}
          className={`p-2.5 rounded-xl text-xs font-display font-bold flex items-center gap-1.5 transition border cursor-pointer uppercase tracking-wider ${
            isCameraActive
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md'
              : 'bg-[#050922] hover:bg-[#0E1A4A] text-slate-300 border-white/10'
          }`}
          title={isCameraActive ? 'Turn Camera Off' : 'Turn Camera On (Webcam)'}
        >
          {isCameraActive ? <Video className="w-4 h-4 text-white" /> : <VideoOff className="w-4 h-4 text-slate-400" />}
          <span className="hidden lg:inline">{isCameraActive ? 'Cam ON' : 'Cam OFF'}</span>
        </button>

        {/* Studio Virtual Cam */}
        <button
          onClick={handleVirtualCam}
          className="p-2.5 rounded-xl text-xs font-display font-bold bg-[#050922] hover:bg-[#0E1A4A] text-amber-300 border border-amber-500/30 transition flex items-center gap-1 cursor-pointer hidden sm:flex uppercase tracking-wider"
          title="Switch to Animated Studio Virtual Cam"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="hidden lg:inline">Studio Cam</span>
        </button>
      </div>

      {/* CENTER GROUP: Primary Auction Action */}
      <div className="flex items-center gap-2 font-display" suppressHydrationWarning>
        {isMounted && isAuctioneerOrHost ? (
          /* AUCTIONEER ACTION SUITE */
          activePlayer ? (
            <div className="flex items-center gap-2">
              {/* Skip / Defer */}
              <button
                onClick={async () => {
                  setIsSkipping(true);
                  try {
                    await skipPlayer();
                  } finally {
                    setIsSkipping(false);
                  }
                }}
                disabled={isSkipping}
                className="bg-[#070D26] hover:bg-[#0E1A4A] text-slate-300 border border-white/15 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center gap-1.5 transition cursor-pointer uppercase tracking-wider"
                title="Skip player and defer to later rounds"
              >
                <SkipForward className="w-4 h-4 text-amber-400" />
                <span className="hidden md:inline">Skip</span>
              </button>

              {/* Pause / Resume */}
              <button
                onClick={() => togglePauseAuction()}
                className={`text-xs font-bold py-2.5 px-3 rounded-xl flex items-center gap-1.5 transition cursor-pointer border uppercase tracking-wider ${
                  room?.isAuctionPaused
                    ? 'ipl-gold-gradient text-slate-950 border-amber-400 animate-pulse font-black'
                    : 'bg-[#070D26] text-slate-300 border-white/15 hover:bg-[#0E1A4A]'
                }`}
                title={room?.isAuctionPaused ? 'Resume live bidding' : 'Pause live bidding'}
              >
                {room?.isAuctionPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                <span className="hidden md:inline">{room?.isAuctionPaused ? 'Resume' : 'Pause'}</span>
              </button>

              {/* Hammer UNSOLD */}
              <button
                onClick={() => hammerUnsold()}
                className="ipl-slant bg-rose-950/90 hover:bg-rose-900 text-rose-300 border border-rose-700 text-xs font-black py-2.5 px-4 flex items-center gap-1.5 transition cursor-pointer uppercase tracking-wider shadow-md"
                title="Hammer UNSOLD and pass player"
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>UNSOLD</span>
              </button>

              {/* Hammer SOLD (Opens Award Modal) */}
              <button
                onClick={onOpenAwardModal}
                className="ipl-slant bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:brightness-110 text-white font-black text-xs sm:text-sm py-2.5 px-5 flex items-center gap-2 shadow-xl shadow-emerald-950/40 transition transform hover:scale-105 cursor-pointer uppercase tracking-wider"
                title="Hammer SOLD and award player to winning franchise"
              >
                <Gavel className="w-4 h-4" />
                <span>🔨 Hammer SOLD!</span>
              </button>

              {/* Solo Test Bid As Dropdown */}
              <div className="hidden xl:flex items-center gap-1 bg-[#050922] border border-amber-500/30 px-2 py-1.5 rounded-xl">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Test Bid:</span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      simulateBid(e.target.value as FranchiseCode);
                      e.target.value = '';
                    }
                  }}
                  className="bg-transparent text-slate-200 text-xs font-bold outline-none cursor-pointer uppercase font-display"
                >
                  <option value="" disabled>Franchise...</option>
                  {FRANCHISE_LIST.map((f) => (
                    <option key={f.code} value={f.code} className="bg-[#070D26] text-white">
                      {f.code} (+{formatIndianCurrency(nextBidAmount)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Hand Raise Notice for Auctioneer */}
              {Object.values(room?.users || {}).filter((u) => u.handRaised).length > 0 && (
                <div
                  className="bg-amber-400 text-slate-950 font-black text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/30 animate-bounce cursor-default uppercase tracking-wider"
                  title={`Hands Raised to Bid: ${Object.values(room?.users || {})
                    .filter((u) => u.handRaised)
                    .map((u) => `${u.name} (${u.franchiseCode || 'Spectator'})`)
                    .join(', ')}`}
                >
                  <span className="text-sm">✋</span>
                  <span>
                    {Object.values(room?.users || {}).filter((u) => u.handRaised).length} Hand
                    {Object.values(room?.users || {}).filter((u) => u.handRaised).length > 1 ? 's' : ''} Raised
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Idle Stage Auctioneer Actions */
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setIsDrawing(true);
                  try {
                    await nominateNext({ mode: 'RANDOM' });
                  } finally {
                    setIsDrawing(false);
                  }
                }}
                disabled={isDrawing || room?.phase === 'COMPLETED'}
                className="ipl-slant ipl-gold-gradient hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm py-2.5 px-6 flex items-center gap-2 shadow-lg shadow-amber-500/25 transition transform hover:scale-105 cursor-pointer uppercase tracking-wider"
              >
                <Dice5 className="w-4 h-4" />
                <span>{isDrawing ? 'Nomination Active...' : '🎲 Nominate Next Player'}</span>
              </button>

              <button
                onClick={() => togglePauseAuction()}
                className={`text-xs font-bold py-2.5 px-3 rounded-xl flex items-center gap-1.5 transition cursor-pointer border uppercase tracking-wider ${
                  room?.isAuctionPaused
                    ? 'ipl-gold-gradient text-slate-950 border-amber-400 animate-pulse font-black'
                    : 'bg-[#070D26] text-slate-300 border-white/15 hover:bg-[#0E1A4A]'
                }`}
              >
                {room?.isAuctionPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                <span className="hidden sm:inline">{room?.isAuctionPaused ? 'Resume' : 'Pause'}</span>
              </button>

              {/* Hand Raise Notice for Auctioneer */}
              {Object.values(room?.users || {}).filter((u) => u.handRaised).length > 0 && (
                <div
                  className="bg-amber-400 text-slate-950 font-black text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/30 animate-bounce cursor-default uppercase tracking-wider"
                  title={`Hands Raised to Bid: ${Object.values(room?.users || {})
                    .filter((u) => u.handRaised)
                    .map((u) => `${u.name} (${u.franchiseCode || 'Spectator'})`)
                    .join(', ')}`}
                >
                  <span className="text-sm">✋</span>
                  <span>
                    {Object.values(room?.users || {}).filter((u) => u.handRaised).length} Hand
                    {Object.values(room?.users || {}).filter((u) => u.handRaised).length > 1 ? 's' : ''} Raised
                  </span>
                </div>
              )}
            </div>
          )
        ) : (
          /* PARTICIPANT MANUAL VOICE BIDDING SUITE (HAND RAISE) */
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Remaining Purse Pill */}
            {myTeamState && userFranchise && (
              <div className="hidden md:flex flex-col text-right pr-3 border-r border-white/10">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">{userFranchise.code} Purse</span>
                <span className="text-sm font-black text-emerald-400 font-mono tabular-nums">
                  {formatIndianCurrency(myTeamState.remainingPurse)}
                </span>
              </div>
            )}

            {/* Hand Raise Toggle Button */}
            <button
              onClick={() => toggleHandRaise()}
              className={`ipl-slant font-black text-xs sm:text-sm py-2.5 px-6 sm:px-8 flex items-center gap-2 shadow-xl transition transform cursor-pointer uppercase tracking-wider ${
                isHandRaised
                  ? 'ipl-gold-gradient text-slate-950 ring-2 ring-amber-300 shadow-amber-500/40 animate-pulse scale-105'
                  : 'bg-[#070D26] hover:bg-[#0E1A4A] text-amber-300 border border-amber-500/40 hover:scale-102'
              }`}
              title={isHandRaised ? 'Click to lower your hand' : 'Raise hand to signal auctioneer you want to bid by voice'}
            >
              <span className="text-base">✋</span>
              <span>{isHandRaised ? 'HAND RAISED (VOICE BID)' : 'RAISE HAND TO BID'}</span>
            </button>
          </div>
        )}
      </div>

      {/* RIGHT GROUP: Drawers (Huddle, Teams & Purses, Chat) */}
      <div className="flex items-center gap-2 font-display">
        {/* Huddle Drawer Toggle Button (Only for franchise team members) */}
        {!isAuctioneerOrHost && role === 'TEAM_MEMBER' && franchiseCode && (
          <button
            onClick={() => setIsHuddleDrawerOpen(!isHuddleDrawerOpen)}
            className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer uppercase tracking-wider ${
              isHuddleDrawerOpen
                ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-1 ring-blue-400'
                : 'bg-[#050922] hover:bg-[#0E1A4A] text-slate-300 border-white/10'
            }`}
            title="Toggle Franchise Team Huddle Panel"
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span className="hidden md:inline">Huddle</span>
          </button>
        )}

        {/* Teams & Purses Toggle Button */}
        <button
          onClick={() => setIsTeamsDrawerOpen(!isTeamsDrawerOpen)}
          className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer uppercase tracking-wider ${
            isTeamsDrawerOpen
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow'
              : 'bg-[#050922] hover:bg-[#0E1A4A] text-slate-300 border-white/10'
          }`}
          title="Toggle Teams & Purses Drawer"
        >
          <Shield className="w-4 h-4 text-amber-400" />
          <span className="hidden md:inline">Teams</span>
        </button>

        {/* Chat Drawer Toggle Button */}
        <button
          onClick={() => {
            const nextState = !isChatDrawerOpen;
            setIsChatDrawerOpen(nextState);
            if (nextState) resetUnreadChat();
          }}
          className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border relative cursor-pointer uppercase tracking-wider ${
            isChatDrawerOpen
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow'
              : 'bg-[#050922] hover:bg-[#0E1A4A] text-slate-300 border-white/10'
          }`}
          title="Toggle Live Comms & Team Chat"
        >
          <MessageSquare className="w-4 h-4 text-blue-400" />
          <span className="hidden md:inline">Chat</span>

          {totalUnread > 0 && !isChatDrawerOpen && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center animate-pulse">
              {totalUnread}
            </span>
          )}
        </button>
      </div>
    </footer>
  );
};
