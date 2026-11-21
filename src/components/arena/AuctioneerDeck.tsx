'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Gavel,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  UserPlus,
  Search,
  CheckCircle,
  XCircle,
  Users,
  ChevronDown,
  Layers,
  Filter,
  FileSpreadsheet,
  TrendingUp,
  Zap,
  Shield,
  SkipForward,
  Shuffle,
  Dice5,
  Square,
  AlertTriangle,
  X,
  AlertCircle,
  Check,
  Crown,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FranchiseCode, Player, PlayerRole, PlayerSet, PlayerStatus } from '@/types/auction';
import { formatIndianCurrency } from '@/lib/utils';
import { FRANCHISE_LIST, FRANCHISES } from '@/data/franchises';

export const AuctioneerDeck: React.FC = () => {
  const router = useRouter();
  const {
    role,
    room,
    userId,
    isHost,
    claimRole,
    endAuction,
    leaveAuction,
    nominatePlayer,
    nominateNext,
    skipPlayer,
    hammerSold,
    hammerUnsold,
    pauseTimer,
    resumeTimer,
    resetTimer,
    triggerRTM,
    addCustomPlayer,
    simulateBid,
    togglePauseAuction,
  } = useAuctionStore();

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isEndAuctionModalOpen, setIsEndAuctionModalOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSet, setSelectedSet] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('UPCOMING');
  const [randomDrawSet, setRandomDrawSet] = useState<string>('ALL');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  // Manual Sold Entry Modal State
  const [isManualSoldModalOpen, setIsManualSoldModalOpen] = useState(false);
  const [soldWinningTeam, setSoldWinningTeam] = useState<FranchiseCode>('CSK');
  const [soldPriceCr, setSoldPriceCr] = useState<string>('2.00');
  const [soldPriceLakhs, setSoldPriceLakhs] = useState<number>(200);
  const [soldError, setSoldError] = useState<string | null>(null);
  const [isSubmittingSold, setIsSubmittingSold] = useState(false);

  // Solo testing bid simulator state
  const [simTeam, setSimTeam] = useState<FranchiseCode>('CSK');
  const [simBidError, setSimBidError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Custom player form state
  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState<PlayerRole>('BAT');
  const [customCountry, setCustomCountry] = useState('India');
  const [customIsOverseas, setCustomIsOverseas] = useState(false);
  const [customBasePrice, setCustomBasePrice] = useState(100);
  const [customPrevTeam, setCustomPrevTeam] = useState<string>('');
  const [customStats, setCustomStats] = useState('');
  const [customSet, setCustomSet] = useState<PlayerSet>('Accelerated');

  const isAuctioneerOrHost =
    role === 'AUCTIONEER' ||
    isHost ||
    room?.auctioneerId === userId ||
    room?.hostId === userId;

  if (!isAuctioneerOrHost) {
    return null;
  }

  const allPlayers = room?.allPlayers || [];
  const activePlayer = room?.activePlayer;

  // Filter players
  const filteredPlayers = allPlayers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSet = selectedSet === 'ALL' || p.set === selectedSet;
    const matchesRole = selectedRole === 'ALL' || p.role === selectedRole;
    const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    return matchesSearch && matchesSet && matchesRole && matchesStatus;
  });

  const handleCreateCustomPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    await addCustomPlayer({
      name: customName.trim(),
      role: customRole,
      country: customCountry.trim(),
      isOverseas: customIsOverseas,
      basePrice: customBasePrice,
      previousTeam: (customPrevTeam as any) || null,
      statsSummary: customStats.trim() || 'Custom Nominated Player',
      set: customSet,
    });

    setIsCustomModalOpen(false);
    setCustomName('');
    setCustomStats('');
  };

  const handleRandomDraw = async () => {
    setIsDrawing(true);
    try {
      const res = await nominateNext({ mode: 'RANDOM', set: randomDrawSet });
      if (!res.success && res.error) {
        alert(res.error);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to draw next player');
    } finally {
      setIsDrawing(false);
    }
  };

  const handleSkip = async (playerId?: string) => {
    setIsSkipping(true);
    try {
      await skipPlayer(playerId);
    } finally {
      setIsSkipping(false);
    }
  };

  const handleEndAuction = async () => {
    setIsEnding(true);
    try {
      await endAuction();
      setIsEndAuctionModalOpen(false);
      await leaveAuction();
      router.push('/?tab=REPORTS');
    } finally {
      setIsEnding(false);
    }
  };

  const handleOpenSoldModal = () => {
    if (!activePlayer) return;
    const initialTeam = room?.highestBidderTeam || 'CSK';
    const initialLakhs =
      room?.currentBid && room.currentBid > 0 ? room.currentBid : activePlayer.basePrice;
    setSoldWinningTeam(initialTeam);
    setSoldPriceLakhs(initialLakhs);
    setSoldPriceCr((initialLakhs / 100).toFixed(2));
    setSoldError(null);
    setIsManualSoldModalOpen(true);
  };

  const handlePriceCrChange = (val: string) => {
    setSoldPriceCr(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      setSoldPriceLakhs(Math.round(parsed * 100));
    }
  };

  const handlePriceLakhsChange = (lakhs: number) => {
    setSoldPriceLakhs(lakhs);
    setSoldPriceCr((lakhs / 100).toFixed(2));
  };

  const handleQuickAddLakhs = (addLakhs: number) => {
    const next = Math.max(0, soldPriceLakhs + addLakhs);
    handlePriceLakhsChange(next);
  };

  const handleConfirmManualSold = async () => {
    if (!activePlayer || isSubmittingSold) return;
    setIsSubmittingSold(true);
    setSoldError(null);

    try {
      const res = await hammerSold({
        winningTeam: soldWinningTeam,
        finalPrice: soldPriceLakhs,
      });

      if (res.success) {
        setIsManualSoldModalOpen(false);
      } else {
        setSoldError(res.error || 'Failed to hammer sold');
      }
    } catch (err: unknown) {
      setSoldError(err instanceof Error ? err.message : 'Error awarding player');
    } finally {
      setIsSubmittingSold(false);
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
    <>
      <div className="bg-slate-900/95 border border-amber-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
        {/* Deck Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="font-black text-sm uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Gavel className="w-4 h-4" />
              Auctioneer Control Pod
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Random Draw Control from Pool / Set */}
            <div className="flex items-center gap-1 bg-slate-950/90 border border-amber-500/30 p-1 rounded-xl">
              <select
                value={randomDrawSet}
                onChange={(e) => setRandomDrawSet(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold px-2 py-1 rounded-lg outline-none cursor-pointer"
              >
                <option value="ALL">🎲 All Pools (Random)</option>
                {Array.from(new Set(allPlayers.map((p) => p.set).filter(Boolean))).map((s) => (
                  <option key={s} value={s}>🎲 {s}</option>
                ))}
              </select>
              <button
                onClick={handleRandomDraw}
                disabled={isDrawing || room?.phase === 'COMPLETED'}
                title="Randomly draw and nominate a player without sequential order"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-black text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow transition cursor-pointer"
              >
                <Dice5 className="w-3.5 h-3.5" />
                <span>{isDrawing ? 'Drawing...' : 'Draw Random'}</span>
              </button>
            </div>

            <button
              onClick={() => setIsCustomModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Player</span>
            </button>

            <button
              onClick={() => setIsQueueOpen(!isQueueOpen)}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Nominate ({filteredPlayers.length})</span>
            </button>

            {/* Pause / Resume Button */}
            <button
              onClick={() => togglePauseAuction()}
              title={room?.isAuctionPaused ? 'Resume live bidding' : 'Pause live bidding'}
              className={`text-xs font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow cursor-pointer ${
                room?.isAuctionPaused
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
              }`}
            >
              {room?.isAuctionPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsEndAuctionModalOpen(true)}
              title="Officially conclude the live auction session"
              className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 text-rose-400" />
              <span>End Auction</span>
            </button>
          </div>
        </div>

        {/* Tactical Gavel & Player Nomination Controls */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Button 1: Next from Pool */}
          <button
            onClick={handleRandomDraw}
            disabled={isDrawing}
            title="Immediately draw next random player from pool onto stage"
            className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-black py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <Dice5 className="w-4 h-4" />
            <span>{isDrawing ? 'Drawing Next...' : '🎲 Next from Pool'}</span>
          </button>

          {/* Button 2: Skip Player (Defer) */}
          <button
            onClick={() => handleSkip()}
            disabled={!activePlayer || isSkipping}
            title="Skip current player and defer to later rounds"
            className="bg-amber-950/70 hover:bg-amber-900 border border-amber-700/80 disabled:opacity-40 text-amber-300 font-black py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
            <span>{isSkipping ? 'Skipping...' : 'Skip Player'}</span>
          </button>

          {/* Button 3: Hammer UNSOLD */}
          <button
            onClick={() => hammerUnsold()}
            disabled={!activePlayer}
            className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800 disabled:opacity-40 text-rose-300 font-black py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>Hammer UNSOLD</span>
          </button>

          {/* Button 4: Hammer SOLD */}
          <button
            onClick={handleConfirmManualSold}
            disabled={!activePlayer || isSubmittingSold}
            title="Hammer SOLD and award player to selected franchise"
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/30 transition cursor-pointer"
          >
            <Gavel className="w-4 h-4" />
            <span>{isSubmittingSold ? 'Awarding...' : '🔨 Hammer SOLD!'}</span>
          </button>
        </div>

        {/* Voice Bidding Award Pod (No Bid Buttons - Voice Raised Bids Finalized Here) */}
        {activePlayer ? (
          <div className="mt-4 pt-3 border-t border-slate-800/80 bg-slate-950/80 p-4 rounded-xl border border-amber-500/30 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="font-extrabold text-white text-xs uppercase tracking-wider">
                  🏆 Award & Finalize Player (Voice Bidding Result)
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Nominated: <strong className="text-white">{activePlayer.name}</strong> ({activePlayer.role}, Base: ₹{(activePlayer.basePrice / 100).toFixed(2)} Cr)
              </span>
            </div>

            {/* Step 1: Select Winning Franchise (All 10 Franchises) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Step 1: Select Winning Franchise
              </label>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {FRANCHISE_LIST.map((f) => {
                  const teamData = room?.teams[f.code];
                  const remainingCr = ((teamData?.remainingPurse || 0) / 100).toFixed(1);
                  const isSelected = soldWinningTeam === f.code;
                  return (
                    <button
                      key={f.code}
                      type="button"
                      onClick={() => {
                        setSoldWinningTeam(f.code);
                        setSoldError(null);
                      }}
                      className={`p-1.5 rounded-lg border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/20 text-white shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                          : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                      }`}
                      style={{
                        borderColor: isSelected ? f.primaryColor : undefined,
                      }}
                    >
                      <span className="font-black text-xs leading-none" style={{ color: f.primaryColor }}>
                        {f.code}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 mt-0.5 leading-none">
                        ₹{remainingCr}Cr
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Enter Final Sold Price */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Step 2: Final Hammer Price
                </label>
                <span className="text-[11px] text-amber-400 font-bold font-mono">
                  {formatIndianCurrency(soldPriceLakhs)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                  <span className="text-amber-400 font-black text-xs">₹</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={soldPriceCr}
                    onChange={(e) => handlePriceCrChange(e.target.value)}
                    className="w-20 bg-transparent text-white font-black text-sm outline-none font-mono"
                    placeholder="2.00"
                  />
                  <span className="text-slate-400 font-bold text-xs">Cr</span>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={soldPriceLakhs}
                    onChange={(e) => handlePriceLakhsChange(Number(e.target.value))}
                    className="w-20 bg-transparent text-white font-black text-sm outline-none font-mono"
                    placeholder="200"
                  />
                  <span className="text-slate-400 font-bold text-xs">Lakhs</span>
                </div>

                {/* Quick Addition Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handlePriceLakhsChange(activePlayer.basePrice)}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    Base Price
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddLakhs(10)}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-amber-300 border border-slate-700 cursor-pointer"
                  >
                    +10L
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddLakhs(25)}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-amber-300 border border-slate-700 cursor-pointer"
                  >
                    +25L
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddLakhs(50)}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-amber-300 border border-slate-700 cursor-pointer"
                  >
                    +50L
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddLakhs(100)}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-emerald-300 border border-slate-700 cursor-pointer"
                  >
                    +1.00 Cr
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddLakhs(200)}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-emerald-300 border border-slate-700 cursor-pointer"
                  >
                    +2.00 Cr
                  </button>
                </div>
              </div>
            </div>

            {/* Validation & Warning */}
            {soldError && (
              <div className="p-2 rounded bg-rose-950/70 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{soldError}</span>
              </div>
            )}

            {/* Step 3: Big Gavel SOLD Button */}
            <button
              type="button"
              onClick={handleConfirmManualSold}
              disabled={isSubmittingSold}
              className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:brightness-110 disabled:opacity-40 text-white font-black py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/30 transition cursor-pointer"
            >
              <Gavel className="w-4 h-4" />
              <span>
                {isSubmittingSold
                  ? 'Finalizing Sold Award...'
                  : `🔨 HAMMER SOLD: Award ${activePlayer.name} to ${soldWinningTeam} for ₹${soldPriceCr} Cr`}
              </span>
            </button>
          </div>
        ) : (
          <div className="mt-4 pt-3 border-t border-slate-800/80 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              No player currently on stage. Click <strong className="text-amber-400">🎲 Next from Pool</strong> above to draw the next player onto the auction block.
            </p>
          </div>
        )}
      </div>

      {/* Player Queue Drawer / Nomination Modal */}
      {isQueueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  Player Nomination Catalog
                </h2>
                <p className="text-xs text-slate-400">Select any upcoming player to bring them to the live block.</p>
              </div>
              <button
                onClick={() => setIsQueueOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                ✕
              </button>
            </div>

            {/* Filters Bar */}
            <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap gap-2 text-xs">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search player or country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Set selector */}
              <select
                value={selectedSet}
                onChange={(e) => setSelectedSet(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="ALL">All Sets</option>
                {sets.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Role selector */}
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="ALL">All Roles</option>
                <option value="BAT">Batters</option>
                <option value="BOWL">Bowlers</option>
                <option value="AR">All-Rounders</option>
                <option value="WK">Wicketkeepers</option>
              </select>

              {/* Status selector */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="ALL">All Statuses</option>
                <option value="UPCOMING">Upcoming Only</option>
                <option value="SOLD">Sold</option>
                <option value="UNSOLD">Unsold</option>
              </select>
            </div>

            {/* Players Table / List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="text-xs text-slate-400">
                  Showing <strong className="text-white">{filteredPlayers.length}</strong> players
                </span>
                <button
                  onClick={async () => {
                    await nominateNext({ mode: 'RANDOM', set: selectedSet });
                    setIsQueueOpen(false);
                  }}
                  disabled={room?.phase !== 'IDLE' && room?.phase !== 'SOLD' && room?.phase !== 'UNSOLD'}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Dice5 className="w-3.5 h-3.5" />
                  <span>🎲 Pick Random from {selectedSet === 'ALL' ? 'Current Pool' : selectedSet}</span>
                </button>
              </div>

              {filteredPlayers.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No players matched the current filters
                </div>
              ) : (
                filteredPlayers.map((player) => {
                  const isNominated = activePlayer?.id === player.id;

                  return (
                    <div
                      key={player.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition ${
                        isNominated
                          ? 'bg-amber-500/10 border-amber-500 text-white'
                          : player.status === 'SOLD'
                          ? 'bg-emerald-950/20 border-emerald-900/40 text-slate-400'
                          : player.status === 'UNSOLD'
                          ? 'bg-rose-950/20 border-rose-900/40 text-slate-400'
                          : player.status === 'SKIPPED'
                          ? 'bg-amber-950/10 border-amber-900/40 text-amber-300/80'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-xs text-amber-400">
                          {player.role}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{player.name}</span>
                            <span className="text-[10px] text-slate-400">({player.country})</span>
                            <span className="bg-slate-800 text-slate-300 text-[9px] px-1.5 py-0.2 rounded font-semibold">
                              {player.set}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{player.statsSummary}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs font-bold text-amber-400">{formatIndianCurrency(player.basePrice)}</p>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              player.status === 'SOLD'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : player.status === 'UNSOLD'
                                ? 'bg-rose-500/20 text-rose-400'
                                : player.status === 'SKIPPED'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {player.status}
                          </span>
                        </div>

                        {(player.status === 'UPCOMING' || player.status === 'SKIPPED') && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleSkip(player.id)}
                              title="Skip and defer to later rounds"
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2 py-1.5 rounded-lg text-xs transition border border-slate-700 flex items-center gap-1 cursor-pointer"
                            >
                              <SkipForward className="w-3 h-3 text-amber-400" />
                              <span>Skip</span>
                            </button>
                            <button
                              onClick={() => {
                                nominatePlayer(player.id);
                                setIsQueueOpen(false);
                              }}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
                            >
                              Nominate
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Player Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateCustomPlayer}
            className="w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                Add Custom Player to Auction
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Player Full Name</label>
              <input
                type="text"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Robin Uthappa"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Role</label>
                <select
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value as PlayerRole)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                >
                  <option value="BAT">Batter (BAT)</option>
                  <option value="BOWL">Bowler (BOWL)</option>
                  <option value="AR">All-Rounder (AR)</option>
                  <option value="WK">Wicketkeeper (WK)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Base Price (Lakhs)</label>
                <select
                  value={customBasePrice}
                  onChange={(e) => setCustomBasePrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                >
                  <option value={20}>₹20 Lakhs</option>
                  <option value={50}>₹50 Lakhs</option>
                  <option value={75}>₹75 Lakhs</option>
                  <option value={100}>₹1.00 Crore (100L)</option>
                  <option value={150}>₹1.50 Crore (150L)</option>
                  <option value={200}>₹2.00 Crore (200L)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Country</label>
                <input
                  type="text"
                  required
                  value={customCountry}
                  onChange={(e) => setCustomCountry(e.target.value)}
                  placeholder="e.g. India or England"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Previous Franchise (RTM)</label>
                <select
                  value={customPrevTeam}
                  onChange={(e) => setCustomPrevTeam(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                >
                  <option value="">None (No RTM)</option>
                  {FRANCHISE_LIST.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.name} ({f.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isOverseas"
                checked={customIsOverseas}
                onChange={(e) => setCustomIsOverseas(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="isOverseas" className="font-bold text-slate-300 cursor-pointer">
                Is Overseas Player (Counts towards 8 Overseas Quota)
              </label>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Career Stats Summary</label>
              <input
                type="text"
                value={customStats}
                onChange={(e) => setCustomStats(e.target.value)}
                placeholder="e.g. Matches: 85 | Runs: 2150 | SR: 135.4"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg"
              >
                Save & Add to Pool
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal: End Live Auction */}
      {isEndAuctionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Officially End Live Auction?</h3>
                <p className="text-xs text-slate-400">This action concludes the active bidding session.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              Ending the auction will lock in all franchise rosters, final sold prices, and remaining purses. The session will stay archived on the server permanently.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsEndAuctionModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                Keep Auction Live
              </button>
              <button
                type="button"
                onClick={handleEndAuction}
                disabled={isEnding}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-900/40 transition disabled:opacity-40"
              >
                {isEnding ? 'Concluding...' : 'Yes, End Auction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manual Hammer SOLD Award Dialog */}
      {isManualSoldModalOpen && activePlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/60 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-slate-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Gavel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    Hammer SOLD: Award Player
                  </h3>
                  <p className="text-xs text-slate-400">
                    Enter the winning franchise and final price from the voice bidding war.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManualSoldModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active Player Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-slate-800 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded border border-slate-700 uppercase">
                    {activePlayer.role}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    {activePlayer.country} {activePlayer.isOverseas ? '• Overseas' : '• Indian'}
                  </span>
                </div>
                <h4 className="text-2xl font-black text-white">{activePlayer.name}</h4>
                <p className="text-xs text-slate-400">{activePlayer.statsSummary}</p>
              </div>
              <div className="text-right bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Base Price</span>
                <span className="text-base font-black text-amber-400">
                  {formatIndianCurrency(activePlayer.basePrice)}
                </span>
              </div>
            </div>

            {/* Step 1: Select Winning Team */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>1. Select Winning Franchise</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {FRANCHISE_LIST.map((team) => {
                  const isSelected = soldWinningTeam === team.code;
                  const teamData = room?.teams[team.code];
                  const purseLakhs = teamData?.remainingPurse ?? 0;
                  const squadCount = teamData?.squad?.length ?? 0;
                  const overseasCount = teamData?.overseasCount ?? 0;

                  return (
                    <button
                      key={team.code}
                      type="button"
                      onClick={() => setSoldWinningTeam(team.code)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'ring-2 shadow-lg bg-slate-800'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                      style={{
                        borderColor: isSelected ? team.primaryColor : undefined,
                        boxShadow: isSelected ? `0 0 15px ${team.primaryColor}30` : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center font-black text-[11px]"
                          style={{
                            backgroundColor: team.primaryColor,
                            color: team.textColor,
                          }}
                        >
                          {team.code}
                        </div>
                        {isSelected && (
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-slate-950 font-black"
                            style={{ backgroundColor: team.primaryColor }}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-black text-white block truncate leading-tight">
                        {team.shortName}
                      </span>
                      <div className="text-[10px] text-amber-400 font-bold font-mono mt-0.5">
                        {formatIndianCurrency(purseLakhs)}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                        {squadCount}/25 {activePlayer.isOverseas ? `• OS:${overseasCount}/8` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Enter Final Sold Price */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>2. Enter Final Sold Price</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2.5">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">
                    Price in Crores (₹ Cr)
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.05"
                      min="0.2"
                      value={soldPriceCr}
                      onChange={(e) => handlePriceCrChange(e.target.value)}
                      placeholder="e.g. 14.50"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-12 py-2.5 text-base font-black text-amber-400 focus:outline-none focus:border-amber-500 transition"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      Cr
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">
                    Price in Lakhs (L)
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      step="5"
                      min="20"
                      value={soldPriceLakhs}
                      onChange={(e) => handlePriceLakhsChange(Number(e.target.value))}
                      placeholder="e.g. 1450"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-base font-black text-slate-200 focus:outline-none focus:border-amber-500 transition"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      Lakhs
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Increment Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 mr-1">Quick Add:</span>
                <button
                  type="button"
                  onClick={() => handlePriceLakhsChange(activePlayer.basePrice)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-700 cursor-pointer"
                >
                  Base ({formatIndianCurrency(activePlayer.basePrice)})
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddLakhs(25)}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-700 cursor-pointer"
                >
                  +25 L
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddLakhs(50)}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-700 cursor-pointer"
                >
                  +50 L
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddLakhs(100)}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-700 cursor-pointer"
                >
                  +1.00 Cr
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddLakhs(200)}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-700 cursor-pointer"
                >
                  +2.00 Cr
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddLakhs(500)}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-700 cursor-pointer"
                >
                  +5.00 Cr
                </button>
              </div>
            </div>

            {/* Validation & Purchase Preview */}
            {(() => {
              const teamState = room?.teams[soldWinningTeam];
              const remaining = teamState?.remainingPurse ?? 0;
              const isAffordable = remaining >= soldPriceLakhs;
              const isOverseasBlocked =
                !!activePlayer.isOverseas && (teamState?.overseasCount ?? 0) >= 8;
              const isSquadFull = (teamState?.squad?.length ?? 0) >= 25;

              if (soldPriceLakhs <= 0) {
                return (
                  <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Please enter a sold price greater than zero.</span>
                  </div>
                );
              }

              if (!isAffordable) {
                return (
                  <div className="bg-rose-950/60 border border-rose-800 p-3 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>
                      <strong>Insufficient Purse:</strong> {teamState?.name} only has{' '}
                      {formatIndianCurrency(remaining)} remaining. Short by{' '}
                      {formatIndianCurrency(soldPriceLakhs - remaining)}.
                    </span>
                  </div>
                );
              }

              if (isOverseasBlocked) {
                return (
                  <div className="bg-rose-950/60 border border-rose-800 p-3 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>
                      <strong>Overseas Limit Reached:</strong> {teamState?.name} already has 8
                      overseas players. Cannot sign another overseas star.
                    </span>
                  </div>
                );
              }

              if (isSquadFull) {
                return (
                  <div className="bg-rose-950/60 border border-rose-800 p-3 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>
                      <strong>Squad Capacity Full:</strong> {teamState?.name} already has the maximum
                      25 players.
                    </span>
                  </div>
                );
              }

              return (
                <div className="bg-emerald-950/40 border border-emerald-800/80 p-3 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Sale Validated:</strong> Awarding {activePlayer.name} to{' '}
                      <strong className="text-white">{teamState?.name} ({soldWinningTeam})</strong> for{' '}
                      <strong className="text-amber-400">{formatIndianCurrency(soldPriceLakhs)}</strong>.
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Post-sale Purse: {formatIndianCurrency(remaining - soldPriceLakhs)}
                  </span>
                </div>
              );
            })()}

            {soldError && (
              <div className="bg-rose-950/70 border border-rose-800 p-3 rounded-xl text-xs font-bold text-rose-300 text-center">
                {soldError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsManualSoldModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmManualSold}
                disabled={
                  isSubmittingSold ||
                  soldPriceLakhs <= 0 ||
                  ((room?.teams[soldWinningTeam]?.remainingPurse ?? 0) < soldPriceLakhs)
                }
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/40 transition flex items-center gap-2 cursor-pointer"
              >
                <Gavel className="w-4 h-4" />
                <span>
                  {isSubmittingSold
                    ? 'Hammering SOLD...'
                    : `🔨 CONFIRM SOLD TO ${soldWinningTeam} (${formatIndianCurrency(soldPriceLakhs)})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
