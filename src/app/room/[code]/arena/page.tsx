'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Gavel,
  Shield,
  ArrowLeft,
  Crown,
  Sparkles,
  Users,
  X,
  PowerOff,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  Key,
  LogOut,
  Loader2,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { VideoCallStrip } from '@/components/arena/VideoCallStrip';
import { HeroPlayerStage } from '@/components/arena/HeroPlayerStage';
import { BottomControlDock } from '@/components/arena/BottomControlDock';
import { TeamsDrawer } from '@/components/arena/TeamsDrawer';
import { ChatDrawer } from '@/components/arena/ChatDrawer';
import { HuddleDrawer } from '@/components/arena/HuddleDrawer';
import { CatalogModal } from '@/components/arena/CatalogModal';
import { CustomPlayerModal } from '@/components/arena/CustomPlayerModal';
import { AuctioneerAwardModal } from '@/components/arena/AuctioneerAwardModal';
import { SoldPlayerCelebrationModal } from '@/components/arena/SoldPlayerCelebrationModal';
import { ShareTeamCodesModal } from '@/components/arena/ShareTeamCodesModal';
import { TempAuctioneerModal } from '@/components/arena/TempAuctioneerModal';
import { AuctionCompletionModal } from '@/components/arena/AuctionCompletionModal';
import { FRANCHISES, FRANCHISE_LIST } from '@/data/franchises';
import { FranchiseCode } from '@/types/auction';
import { FranchiseLogo } from '@/components/common/FranchiseLogo';
import { livekitClient } from '@/lib/livekitClient';
import { getStoredUser } from '@/lib/utils';

export default function AuctionArenaPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.code as string)?.toUpperCase();

  const isEndingRef = React.useRef(false);

  const {
    room,
    userId,
    userName,
    role,
    isHost,
    franchiseCode,
    teamRole,
    initSocket,
    claimRole,
    leaveAuction,
    endAuction,
    unreadGlobalCount,
    unreadTeamCount,
  } = useAuctionStore();

  const isAuctioneerOrHost =
    role === 'AUCTIONEER' ||
    isHost ||
    room?.auctioneerId === userId ||
    room?.hostId === userId;

  const [isTeamsDrawerOpen, setIsTeamsDrawerOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [isHuddleDrawerOpen, setIsHuddleDrawerOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [isShareCodesOpen, setIsShareCodesOpen] = useState(false);
  const [isTempAuctioneerOpen, setIsTempAuctioneerOpen] = useState(false);
  const [showFranchiseModal, setShowFranchiseModal] = useState(false);
  const [hasPromptedModal, setHasPromptedModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isConcluding, setIsConcluding] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [chatToast, setChatToast] = useState<{ senderName: string; text: string; channel: string } | null>(null);

  const latestIncomingMessage = useAuctionStore((s) => s.latestIncomingMessage);
  const clearLatestIncomingMessage = useAuctionStore((s) => s.clearLatestIncomingMessage);
  const resetUnreadChat = useAuctionStore((s) => s.resetUnreadChat);

  // Soft Web Audio API notification chime for new chat messages
  const playChatChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  useEffect(() => {
    if (!latestIncomingMessage) return;
    if (latestIncomingMessage.senderName === userName) {
      clearLatestIncomingMessage();
      return;
    }

    if (!isChatDrawerOpen) {
      playChatChime();
      setChatToast({
        senderName: latestIncomingMessage.senderName,
        text: latestIncomingMessage.content,
        channel: latestIncomingMessage.channel,
      });

      const timer = setTimeout(() => {
        setChatToast(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [latestIncomingMessage, isChatDrawerOpen, userName, clearLatestIncomingMessage]);

  const handleLeaveAuction = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const isAuctioneer = role === 'AUCTIONEER' || room?.auctioneerId === userId;
    const confirmMsg = isAuctioneer
      ? 'Leave the auction room? The designated Deputy Auctioneer will take over the gavel, and you will return to the dashboard.'
      : 'Are you sure you want to leave this live auction session and return to the dashboard?';

    if (confirm(confirmMsg)) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ipl_active_room_code');
      }
      await leaveAuction();
      router.push('/');
    }
  };

  const handleConcludeAuction = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsConcluding(true);

    try {
      const user = getStoredUser();
      const finalSold = (room?.soldHistory || []).filter((p) => !p.isRetained);
      const finalUnsold = room?.unsoldHistory || [];
      const totalSpentLakhs = finalSold.reduce((sum, p) => sum + (p.soldAmount || 0), 0);
      const isSolo = roomCode.startsWith('SOLO') || room?.hostId?.startsWith('solo_');

      // Prevent floating mini auction widget from ever mounting & backup session locally
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ipl_active_room_code');
        localStorage.setItem('ipl_auction_ended', roomCode);

        try {
          const existingRaw = localStorage.getItem('ipl_conducted_sessions') || '[]';
          const existingList = JSON.parse(existingRaw);
          const participatingTeams = Array.from(
            new Set([
              ...Object.keys(room?.teams || {}),
              ...finalSold.map((p) => p.soldTo).filter(Boolean),
            ])
          );
          const sessionSummary = {
            roomCode: roomCode.toUpperCase(),
            mode: isSolo ? 'Solo Test' : 'Multiplayer',
            status: 'Completed',
            phase: 'COMPLETED',
            soldCount: finalSold.length,
            unsoldCount: finalUnsold.length,
            totalAuctioned: finalSold.length + finalUnsold.length,
            totalSpentLakhs,
            totalPlayers: (room?.allPlayers?.length || 0),
            participatingTeams: participatingTeams.length > 0 ? participatingTeams : ['CSK', 'MI', 'RCB', 'KKR', 'SRH'],
            lastActionMessage: '🏆 LIVE AUCTION OFFICIALLY CONCLUDED! All franchises and final squad rosters are locked.',
            updatedAt: Date.now(),
            createdAt: Date.now(),
            formattedDate: new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              hour12: true,
            }).format(new Date()),
            soldPlayers: finalSold,
            unsoldPlayers: finalUnsold,
            squads: room?.teams || {},
            bidHistory: room?.bidHistory || [],
            hostEmail: user.userEmail || null,
            hostName: user.userName || userName || 'Auctioneer',
          };
          const updatedList = [sessionSummary, ...existingList.filter((s: any) => s.roomCode !== roomCode.toUpperCase())];
          localStorage.setItem('ipl_conducted_sessions', JSON.stringify(updatedList));
        } catch (storageErr) {
          console.warn('LocalStorage backup warning:', storageErr);
        }
      }

      // Strictly await the dedicated HTTP persistence endpoint
      const res = await fetch(`/api/auctions/${roomCode}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: isSolo ? 'SOLO' : 'MULTIPLAYER',
          hostEmail: user.userEmail || null,
          hostName: user.userName || userName || 'Auctioneer',
          soldPlayers: finalSold,
          unsoldPlayers: finalUnsold,
          squads: room?.teams || {},
          bidHistory: room?.bidHistory || [],
          totalSpent: totalSpentLakhs,
          lastActionMessage: '🏆 LIVE AUCTION OFFICIALLY CONCLUDED! All franchises and final squad rosters are locked.',
        }),
      });

      if (!res.ok) {
        console.warn('[Complete] HTTP persistence endpoint returned non-200, continuing...');
      }

      // Emit socket event for peers and show completion modal
      await endAuction();
      setIsCompletionModalOpen(true);
    } catch (err) {
      console.error('Error concluding auction:', err);
      setIsCompletionModalOpen(true);
    } finally {
      setIsConcluding(false);
    }
  };

  const handleViewReportFromCompletion = async () => {
    setIsCompletionModalOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ipl_active_room_code');
      localStorage.setItem('ipl_auction_ended', roomCode || '');
    }
    await leaveAuction();
    router.refresh();
    router.push('/conducted-auctions');
  };

  const handleExitDashboardFromCompletion = async () => {
    setIsCompletionModalOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ipl_active_room_code');
      localStorage.setItem('ipl_auction_ended', roomCode || '');
    }
    await leaveAuction();
    router.push('/');
  };

  useEffect(() => {
    if (room?.phase === 'COMPLETED') {
      setIsCompletionModalOpen(true);
    }
  }, [room?.phase]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (roomCode) {
      initSocket(roomCode);
    }
  }, [roomCode, initSocket]);

  // Connect Broadcast-Grade LiveKit WebRTC for Audio & Video Transmission
  useEffect(() => {
    if (roomCode && userId && userName) {
      livekitClient.connect({
        roomCode,
        userId,
        userName,
        role: isAuctioneerOrHost ? 'AUCTIONEER' : role,
        franchiseCode: isAuctioneerOrHost ? null : franchiseCode,
      });
    }
    return () => {
      livekitClient.disconnect();
    };
  }, [roomCode, userId, userName, role, isAuctioneerOrHost, franchiseCode]);

  // If user joins mid-auction as spectator with no franchise, prompt team picker modal once
  useEffect(() => {
    if (room && !franchiseCode && role === 'SPECTATOR' && !hasPromptedModal) {
      setShowFranchiseModal(true);
      setHasPromptedModal(true);
    }
  }, [room, franchiseCode, role, hasPromptedModal]);

  const handleSelectFranchise = async (code: FranchiseCode) => {
    if (franchiseCode && franchiseCode !== code) {
      alert(`You are permanently locked to ${franchiseCode}. You cannot switch teams.`);
      setShowFranchiseModal(false);
      return;
    }
    await claimRole('TEAM_MEMBER', code);
    setShowFranchiseModal(false);
  };

  const franchise = franchiseCode ? FRANCHISES[franchiseCode] : null;
  const activePlayer = room?.activePlayer;
  const totalUnread = (unreadGlobalCount || 0) + (unreadTeamCount || 0);

  return (
    <div className="h-screen max-h-screen min-h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100 select-none">
      {/* 0. PERSISTENCE & FINALIZING OVERLAY (STAGE REMAINS OPEN, NEVER MINIMIZES) */}
      {isConcluding && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-4 animate-in fade-in select-none">
          <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
          <div className="text-center px-4">
            <h2 className="text-xl font-black text-white tracking-wide">Finalizing & Saving Auction Results...</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-md">
              Persisting completed squad rosters, calculating hammer expenditures & archiving session to Conducted Auctions.
            </p>
          </div>
        </div>
      )}

      {/* 1. TOP BROADCAST BAR (h-12) */}
      <header className="h-12 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-40 shadow-sm">
        {/* Left: Branding, Room Code, Current Set & Recent Sold Ticker */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          {/* Room Code Pill */}
          <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono text-xs font-black text-amber-400 tracking-wider">
              {roomCode}
            </span>
          </div>

          {/* Current Set Badge */}
          <div className="hidden sm:flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md text-[11px] font-bold text-amber-300 shrink-0">
            <span>Set:</span>
            <strong className="text-white">{activePlayer ? activePlayer.set : 'Idle'}</strong>
          </div>

          <div className="hidden md:block h-3.5 w-px bg-slate-800 shrink-0" />

          {/* Single-line scrolling/fading Recent Sold Ticker */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-300 font-medium truncate max-w-sm lg:max-w-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-ping" />
            <span className="truncate">{room?.lastActionMessage || 'Live auction active • Ready for next nomination'}</span>
          </div>
        </div>

        {/* Right: Controls & Identity */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Share Team PINs & Direct Links (Auctioneer / Host only) */}
          {isAuctioneerOrHost && (
            <button
              onClick={() => setIsShareCodesOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition cursor-pointer"
              title="Share Franchise Access PINs & Direct Invite Links"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Team PINs</span>
            </button>
          )}

          {/* Appoint Temp / Deputy Auctioneer (Auctioneer / Host only) */}
          {isAuctioneerOrHost && (
            <button
              onClick={() => setIsTempAuctioneerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition cursor-pointer"
              title="Appoint a Temporary Deputy Auctioneer or Transfer Gavel"
            >
              <Gavel className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Deputy</span>
              {room?.tempAuctioneerId && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          )}

          {/* Hand Raise Notice for Auctioneer in Top Bar */}
          {isAuctioneerOrHost && Object.values(room?.users || {}).filter((u) => u.handRaised).length > 0 && (
            <div className="flex items-center gap-1 bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded-md animate-bounce shadow">
              <span>✋</span>
              <span>
                {Object.values(room?.users || {}).filter((u) => u.handRaised).length} Raised
              </span>
            </div>
          )}

          {/* Teams & Purses Drawer Toggle Button */}
          <button
            onClick={() => setIsTeamsDrawerOpen(!isTeamsDrawerOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
              isTeamsDrawerOpen
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title="Open Franchise Purses & Squads Drawer"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Teams</span>
          </button>

          {/* Claim Auctioneer Gavel for Host if desynced */}
          {isAuctioneerOrHost && role !== 'AUCTIONEER' && (
            <button
              onClick={() => claimRole('AUCTIONEER', null)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-2 py-1 rounded-lg flex items-center gap-1 transition"
            >
              <Gavel className="w-3 h-3" />
              <span>Claim Gavel</span>
            </button>
          )}

          {/* User Identity Pill */}
          <div
            className="hidden sm:flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs"
            suppressHydrationWarning
          >
            {franchise ? (
              <FranchiseLogo code={franchise.code} size="xs" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
            <span className="font-bold text-slate-200" suppressHydrationWarning>
              {isMounted ? userName || 'Connecting...' : 'Connecting...'}
            </span>
            <span className="text-slate-500 font-semibold uppercase text-[10px]" suppressHydrationWarning>
              ({isMounted ? (isAuctioneerOrHost ? 'AUCTIONEER' : franchise ? franchise.code : role) : 'SPECTATOR'})
            </span>
          </div>

          {/* Leave Auction Button (All participants) */}
          <button
            type="button"
            onClick={(e) => handleLeaveAuction(e)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800 transition cursor-pointer"
            title="Leave this auction room and return to dashboard"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>

          {/* Conclude Auction Button (Auctioneer only) */}
          {isAuctioneerOrHost && (
            <button
              type="button"
              onClick={(e) => handleConcludeAuction(e)}
              disabled={isConcluding}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 transition cursor-pointer font-bold text-xs shadow disabled:opacity-50"
              title="Conclude live auction and save final squads to PostgreSQL"
            >
              {isConcluding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  <span className="inline">Finalizing & Saving Auction...</span>
                </>
              ) : (
                <>
                  <PowerOff className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">End Auction</span>
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN CENTER STAGE + VIDEO CALL STRIP */}
      <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden px-2 sm:px-4 py-2 gap-2">
        {/* Top Video Call Rail (Auctioneer + Connected Participants) */}
        <VideoCallStrip />

        {/* Center Hero Player Stage (Maximized Viewport Focus) */}
        <HeroPlayerStage
          onOpenCatalog={() => setIsCatalogOpen(true)}
          onOpenCustomPlayer={() => setIsCustomOpen(true)}
        />
      </main>

      {/* 3. FLOATING BOTTOM CONTROL DOCK (Zoom/Meet Style h-16) */}
      <BottomControlDock
        isTeamsDrawerOpen={isTeamsDrawerOpen}
        setIsTeamsDrawerOpen={setIsTeamsDrawerOpen}
        isChatDrawerOpen={isChatDrawerOpen}
        setIsChatDrawerOpen={setIsChatDrawerOpen}
        isHuddleDrawerOpen={isHuddleDrawerOpen}
        setIsHuddleDrawerOpen={setIsHuddleDrawerOpen}
        onOpenAwardModal={() => setIsAwardModalOpen(true)}
        onOpenCatalog={() => setIsCatalogOpen(true)}
        onOpenCustomPlayer={() => setIsCustomOpen(true)}
      />

      {/* 4. SLIDE-OVER DRAWERS */}
      {/* Left Drawer: Teams & Purses */}
      <TeamsDrawer
        isOpen={isTeamsDrawerOpen}
        onClose={() => setIsTeamsDrawerOpen(false)}
      />

      {/* Right Drawer: Live Chat */}
      <ChatDrawer
        isOpen={isChatDrawerOpen}
        onClose={() => setIsChatDrawerOpen(false)}
      />

      {/* Franchise Team Huddle Drawer */}
      <HuddleDrawer
        isOpen={isHuddleDrawerOpen}
        onClose={() => setIsHuddleDrawerOpen(false)}
        onOpenTeamChat={() => setIsChatDrawerOpen(true)}
        onSwitchTeam={!franchiseCode ? () => setShowFranchiseModal(true) : undefined}
      />

      {/* 5. MODALS */}
      {/* Auctioneer Award & Sold Modal */}
      {activePlayer && isAwardModalOpen && (
        <AuctioneerAwardModal
          player={activePlayer}
          onClose={() => setIsAwardModalOpen(false)}
        />
      )}

      {/* Player Nomination Catalog Modal */}
      <CatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
      />

      {/* Add Custom Player Modal */}
      <CustomPlayerModal
        isOpen={isCustomOpen}
        onClose={() => setIsCustomOpen(false)}
      />

      {/* Celebratory Sold Player Popup Modal */}
      <SoldPlayerCelebrationModal />

      {/* Mid-Auction Franchise Table Selector Modal */}
      {showFranchiseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-400" />
                  Select Your Franchise Table
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Join a franchise table to participate in private team huddles & live floor bidding.
                </p>
              </div>
              <button
                onClick={() => setShowFranchiseModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto p-1 max-h-[50vh]">
              {FRANCHISE_LIST.map((team) => {
                const teamState = room?.teams[team.code];
                const isSelected = franchiseCode === team.code;
                const members = room
                  ? Object.values(room.users).filter(
                      (u) => u.franchiseCode === team.code && u.isOnline
                    )
                  : [];

                return (
                  <button
                    key={team.code}
                    onClick={() => handleSelectFranchise(team.code)}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/10 shadow-md ring-1 ring-amber-400'
                        : 'border-slate-800 bg-slate-950 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FranchiseLogo code={team.code} size="md" className="shadow" />
                      <div>
                        <span className="font-bold text-sm text-white block">
                          {team.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {members.length} member{members.length === 1 ? '' : 's'} online
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-emerald-400 font-mono block">
                        ₹{teamState ? ((teamState.remainingPurse || 0) / 100).toFixed(2) : '100.00'} Cr
                      </span>
                      <span className="text-[10px] text-slate-500">Purse</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Host Share Team Codes Modal */}
      {isAuctioneerOrHost && (
        <ShareTeamCodesModal
          isOpen={isShareCodesOpen}
          onClose={() => setIsShareCodesOpen(false)}
        />
      )}

      {/* Appoint Deputy & Temporary Auctioneer Modal */}
      {isAuctioneerOrHost && (
        <TempAuctioneerModal
          isOpen={isTempAuctioneerOpen}
          onClose={() => setIsTempAuctioneerOpen(false)}
        />
      )}

      {/* Floating Real-Time Chat Notification Toast */}
      {chatToast && !isChatDrawerOpen && (
        <div
          onClick={() => {
            setIsChatDrawerOpen(true);
            resetUnreadChat();
            setChatToast(null);
          }}
          className="fixed bottom-16 right-4 z-50 max-w-xs sm:max-w-sm bg-slate-900/95 border border-amber-500/60 text-slate-100 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-start gap-3 cursor-pointer hover:bg-slate-900 animate-slide-in-up transition-all group ring-1 ring-amber-400/20"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-xs font-black text-amber-400 truncate">
                {chatToast.senderName}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded uppercase bg-slate-800 text-slate-400 border border-slate-700">
                {chatToast.channel === 'GLOBAL' ? 'Global' : chatToast.channel}
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate font-medium">
              {chatToast.text}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setChatToast(null);
            }}
            className="text-slate-500 hover:text-white text-xs font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Official Auction Completion & Squad Download Modal */}
      <AuctionCompletionModal
        isOpen={isCompletionModalOpen || room?.phase === 'COMPLETED'}
        room={room}
        franchiseCode={franchiseCode}
        userName={userName || 'Participant'}
        isAuctioneer={isAuctioneerOrHost}
        onViewReport={handleViewReportFromCompletion}
        onExitDashboard={handleExitDashboardFromCompletion}
      />
    </div>
  );
}
