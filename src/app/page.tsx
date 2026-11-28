'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Gavel,
  Shield,
  Trophy,
  Users,
  ArrowRight,
  Settings,
  Sparkles,
  Zap,
  Play,
  Download,
  Upload,
  Layers,
  FileSpreadsheet,
  Dice5,
  SkipForward,
  Radio,
  ExternalLink,
  Calendar,
  Lock,
  LogOut,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { getStoredUser, saveStoredUser, SUPER_ADMIN_EMAIL, StoredSession } from '@/lib/utils';
import { BiddingPermission } from '@/types/auction';
import { FRANCHISE_LIST } from '@/data/franchises';
import { PlayerPoolUploader, UploadTarget } from '@/components/arena/PlayerPoolUploader';
import { LoginModal } from '@/components/auth/LoginModal';
import { AdminSchedulerDeck } from '@/components/admin/AdminSchedulerDeck';
import { AllSquadsInspector } from '@/components/arena/AllSquadsInspector';
import { ConductedAuctionsReport } from '@/components/arena/ConductedAuctionsReport';

type ActiveTab = 'JOIN' | 'SCHEDULES' | 'CREATE' | 'SOLO' | 'SQUADS' | 'POOLS' | 'REPORTS';

export default function HomePage() {
  const router = useRouter();
  const { createRoom, setIdentity, startAuction, initSocket, room } = useAuctionStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('SQUADS');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [teamAccessCode, setTeamAccessCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isSoloLaunching, setIsSoloLaunching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadInitialTarget, setUploadInitialTarget] = useState<UploadTarget>('RETAINED_SQUADS');

  // Room Configuration Form
  const [initialPurse, setInitialPurse] = useState(10000); // 10000 Lakhs = ₹100 Cr
  const [maxSquadSize, setMaxSquadSize] = useState(25);
  const [minSquadSize, setMinSquadSize] = useState(18);
  const [maxOverseas, setMaxOverseas] = useState(8);
  const [rtmCardsPerTeam, setRtmCardsPerTeam] = useState(2);
  const [bidTimerSeconds, setBidTimerSeconds] = useState(15);
  const [biddingPermission, setBiddingPermission] =
    useState<BiddingPermission>('ANY_MEMBER');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  useEffect(() => {
    const session = getStoredUser();
    if (session.userName) setUserName(session.userName);
    if (session.userEmail) setUserEmail(session.userEmail);
    setIsSuperAdmin(session.isAdmin || session.userEmail?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());

    if (session.userName && session.userEmail) {
      // Verify role & privileges strictly server-side against PostgreSQL
      fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: session.userName, email: session.userEmail }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            setIsSuperAdmin(!!data.user.isAdmin);
          }
        })
        .catch((err) => console.warn('Could not sync user with server:', err));
    }

    // Prompt login if name or email missing
    if (!session.userName || !session.userEmail) {
      setIsLoginOpen(true);
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      const urlCode = params.get('code');

      if (urlRoom) {
        setJoinCode(urlRoom.toUpperCase());
        setActiveTab('JOIN');
      }
      if (urlCode) {
        setTeamAccessCode(urlCode.toUpperCase());
        setActiveTab('JOIN');
      }

      const urlTab = params.get('tab');
      if (urlTab === 'REPORTS') {
        setActiveTab('REPORTS');
      }

      const savedCode = localStorage.getItem('ipl_active_room_code');
      if (savedCode && !urlRoom) {
        setActiveRoomCode(savedCode);
        initSocket(savedCode);
      }
    }
  }, [initSocket]);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const displayName = userName.trim();
    const email = userEmail.trim() || `${displayName.toLowerCase().replace(/\s+/g, '_')}@ipl.test`;

    if (!displayName) {
      setErrorMsg('Please enter your Display Name');
      return;
    }
    if (!joinCode.trim()) {
      setErrorMsg('Please enter a 6-character room code');
      return;
    }
    if (!teamAccessCode.trim()) {
      setErrorMsg('Please enter your Team Access PIN (e.g. CSK-4821) or SPEC-XXXX for Spectators');
      return;
    }

    setIsJoining(true);
    const code = joinCode.trim().toUpperCase();
    const pin = teamAccessCode.trim().toUpperCase();

    saveStoredUser(displayName, email);
    setIdentity(displayName);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ipl_active_room_code', code);
      sessionStorage.setItem(`ipl_team_pin_${code}`, pin);
    }

    try {
      const res = await useAuctionStore.getState().joinRoom(code, displayName, email, pin);
      if (res.success) {
        router.push(`/room/${code}/arena`);
      } else {
        setErrorMsg(res.error || 'Failed to join room. Verify your code and team access PIN.');
        setIsJoining(false);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
      setIsJoining(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) {
      setIsLoginOpen(true);
      return;
    }

    setIsCreating(true);
    setErrorMsg(null);
    saveStoredUser(userName.trim(), userEmail.trim());
    setIdentity(userName.trim());

    try {
      const res = await createRoom(userName.trim(), {
        initialPurse,
        maxSquadSize,
        minSquadSize,
        maxOverseas,
        rtmCardsPerTeam,
        bidTimerSeconds,
        biddingPermission,
      });

      if (res.success && res.roomCode) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('ipl_active_room_code', res.roomCode);
        }
        // Guarantee session row exists in PostgreSQL on creation
        await fetch('/api/auctions/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: res.roomCode,
            mode: 'MULTIPLAYER',
            hostEmail: userEmail.trim().toLowerCase(),
            hostName: userName.trim(),
            settings: {
              initialPurse,
              maxSquadSize,
              minSquadSize,
              maxOverseas,
              rtmCardsPerTeam,
              bidTimerSeconds,
              biddingPermission,
            },
          }),
        }).catch(console.warn);

        router.push(`/room/${res.roomCode}/lobby`);
      } else {
        setErrorMsg(res.error || 'Failed to create auction room');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsCreating(false);
    }
  };

  // 1-Click Solo Test Launch
  const handleLaunchSoloTest = async () => {
    const name = userName.trim() || 'Solo Auctioneer';
    const email = userEmail.trim().toLowerCase() || 'solo@ipl.local';
    setIsSoloLaunching(true);
    setErrorMsg(null);
    saveStoredUser(name, email);
    setIdentity(name);

    try {
      const res = await createRoom(name, {
        initialPurse: 10000,
        maxSquadSize: 25,
        minSquadSize: 18,
        maxOverseas: 8,
        rtmCardsPerTeam: 2,
        bidTimerSeconds: 15,
        biddingPermission: 'ANY_MEMBER',
      });

      if (res.success && res.roomCode) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('ipl_active_room_code', res.roomCode);
        }
        // Guarantee Solo Test session is created in PostgreSQL immediately on start
        await fetch('/api/auctions/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: res.roomCode,
            mode: 'SOLO',
            hostEmail: email,
            hostName: name,
            settings: {
              initialPurse: 10000,
              maxSquadSize: 25,
              minSquadSize: 18,
              maxOverseas: 8,
              rtmCardsPerTeam: 2,
              bidTimerSeconds: 15,
              biddingPermission: 'ANY_MEMBER',
            },
          }),
        }).catch(console.warn);

        // Auto-start live auction immediately with random draw
        await startAuction({
          autoNominate: true,
          mode: 'RANDOM',
          set: 'Marquee',
        });
        router.push(`/room/${res.roomCode}/arena`);
      } else {
        setErrorMsg(res.error || 'Failed to initialize solo test room');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Solo launch failed');
    } finally {
      setIsSoloLaunching(false);
    }
  };

  const applyPreset = (preset: 'MEGA' | 'MINI' | 'BLITZ') => {
    if (preset === 'MEGA') {
      setInitialPurse(12000);
      setMaxSquadSize(25);
      setMinSquadSize(18);
      setMaxOverseas(8);
      setRtmCardsPerTeam(2);
      setBidTimerSeconds(15);
    } else if (preset === 'MINI') {
      setInitialPurse(4000);
      setMaxSquadSize(18);
      setMinSquadSize(15);
      setMaxOverseas(8);
      setRtmCardsPerTeam(1);
      setBidTimerSeconds(15);
    } else if (preset === 'BLITZ') {
      setInitialPurse(10000);
      setMaxSquadSize(20);
      setMinSquadSize(16);
      setMaxOverseas(8);
      setRtmCardsPerTeam(2);
      setBidTimerSeconds(10);
    }
  };

  return (
    <div className="min-h-screen ipl-stadium-bg text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans">
      {/* Dynamic Stadium Floodlight Beams */}
      <div className="fixed inset-0 pointer-events-none opacity-25">
        <div className="absolute top-0 left-1/4 w-[700px] h-[500px] bg-amber-400/10 rounded-full blur-[140px]" />
        <div className="absolute top-10 right-1/4 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[140px]" />
      </div>

      {/* Broadcast Navigation Header */}
      <header className="border-b border-amber-500/30 bg-[#091136]/90 backdrop-blur-xl px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 relative z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="ipl-slant px-3 py-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-display font-black text-sm tracking-wider uppercase shadow-md flex items-center gap-1.5">
            <Trophy className="w-4 h-4" />
            <span>TATA IPL 2027</span>
          </div>
          <div>
            <h1 className="font-display font-black text-lg tracking-wide text-white uppercase flex items-center gap-2">
              LIVE AUCTION COMMAND
              <span className="text-[10px] bg-rose-600 text-white font-display font-black px-1.5 py-0.2 rounded uppercase animate-pulse">
                ON AIR
              </span>
            </h1>
            <p className="text-[11px] text-amber-300/80 font-sans font-medium">
              Authentic Television Broadcast Match Center & Multi-Franchise Stage
            </p>
          </div>
        </div>

        {/* Global Hub Navigation Tabs & User Profile */}
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex items-center gap-1 bg-[#050922] border border-amber-500/30 p-1 rounded-xl text-xs font-display font-bold uppercase tracking-wider">
            <button
              onClick={() => setActiveTab('SQUADS')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'SQUADS'
                  ? 'ipl-gold-gradient text-slate-950 font-black shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-[#0E1A4A]'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>All Squads</span>
            </button>

            <button
              onClick={() => setActiveTab('JOIN')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'JOIN'
                  ? 'ipl-gold-gradient text-slate-950 font-black shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-[#0E1A4A]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Join Stage</span>
            </button>

            <button
              onClick={() => setActiveTab('SCHEDULES')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'SCHEDULES'
                  ? 'ipl-gold-gradient text-slate-950 font-black shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-[#0E1A4A]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSuperAdmin ? 'Admin & Schedules' : 'Schedules'}</span>
            </button>

            <button
              onClick={() => setActiveTab('CREATE')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'CREATE'
                  ? 'ipl-gold-gradient text-slate-950 font-black shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-[#0E1A4A]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Create Arena</span>
            </button>

            <button
              onClick={() => setActiveTab('SOLO')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'SOLO'
                  ? 'ipl-gold-gradient text-slate-950 font-black shadow-md'
                  : 'text-amber-400 hover:bg-[#0E1A4A]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Solo Test</span>
            </button>

            <button
              onClick={() => setActiveTab('REPORTS')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'REPORTS'
                  ? 'ipl-gold-gradient text-slate-950 font-black shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-[#0E1A4A]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conducted Auctions</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => {
                  setUploadInitialTarget('RETAINED_SQUADS');
                  setIsUploadModalOpen(true);
                }}
                className="ipl-slant px-3 py-1.5 transition flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-display font-black shadow-md cursor-pointer ml-1 uppercase tracking-wider"
                title="Upload Current Squad or Auction Pool to Server"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Catalog</span>
              </button>
            )}
          </nav>

          {/* User Persona Badge */}
          <div className="flex items-center gap-2">
            {userEmail ? (
              <div className="flex items-center gap-2 bg-[#050922] border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-sans">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 flex items-center justify-center font-display font-black text-xs text-slate-950">
                  {userName.slice(0, 1).toUpperCase() || 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="font-bold text-white block leading-none">{userName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{userEmail}</span>
                </div>
                {isSuperAdmin ? (
                  <span className="text-[9px] ipl-gold-gradient text-slate-950 font-display font-black px-1.5 py-0.2 rounded uppercase">
                    ADMIN
                  </span>
                ) : (
                  <span className="text-[9px] bg-slate-800 text-slate-300 font-display font-bold px-1.5 py-0.2 rounded uppercase">
                    MEMBER
                  </span>
                )}
                <button
                  onClick={() => setIsLoginOpen(true)}
                  title="Switch account"
                  className="text-[10px] text-slate-400 hover:text-amber-400 underline ml-1 cursor-pointer"
                >
                  Switch
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl shadow transition cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={`flex-1 mx-auto w-full px-4 sm:px-6 py-6 relative z-10 flex flex-col ${
          activeTab === 'SQUADS' || activeTab === 'REPORTS' ? 'max-w-[1720px]' : 'max-w-5xl justify-center'
        }`}
      >
        {errorMsg && (
          <div className="max-w-md mx-auto w-full mb-6 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs font-bold text-rose-300 text-center animate-in fade-in">
            {errorMsg}
          </div>
        )}

        {/* TAB 1: JOIN AUCTION ROOM */}
        {activeTab === 'JOIN' && (
          <div className="max-w-md mx-auto w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md animate-in fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Join Live Auction</h3>
                <p className="text-xs text-slate-400">Enter a 6-letter room code to enter the lobby or live arena.</p>
              </div>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Your Display Name
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. MS Dhoni"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  6-Letter Room Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. GLZ8PJ"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-lg font-mono font-black text-amber-400 tracking-widest placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Team Access PIN / Code
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono">e.g. CSK-4821 or SPEC-XXXX</span>
                </div>
                <input
                  type="text"
                  required
                  value={teamAccessCode}
                  onChange={(e) => setTeamAccessCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CSK-4821"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-base font-mono font-black text-blue-400 tracking-wider placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  This PIN permanently locks your session to this franchise. Enter SPEC-XXXX to join as Spectator.
                </p>
              </div>

              <button
                type="submit"
                disabled={isJoining}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <span>{isJoining ? 'Connecting & Locking Seat...' : 'Enter Live Auction'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB: SCHEDULED AUCTIONS & ADMIN DECK */}
        {activeTab === 'SCHEDULES' && (
          <div className="max-w-4xl mx-auto w-full">
            <AdminSchedulerDeck />
          </div>
        )}

        {/* TAB 2: CREATE CUSTOM AUCTION ROOM */}
        {activeTab === 'CREATE' && (
          <div className="max-w-2xl mx-auto w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md animate-in fade-in">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Create Custom Auction</h3>
                  <p className="text-xs text-slate-400">Host your own tournament with custom rules.</p>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('MEGA')}
                  className="bg-slate-800 hover:bg-slate-700 text-[11px] font-bold px-2 py-1 rounded text-slate-300"
                >
                  Mega (₹120 Cr)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('MINI')}
                  className="bg-slate-800 hover:bg-slate-700 text-[11px] font-bold px-2 py-1 rounded text-slate-300"
                >
                  Mini (₹40 Cr)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('BLITZ')}
                  className="bg-slate-800 hover:bg-slate-700 text-[11px] font-bold px-2 py-1 rounded text-slate-300"
                >
                  Blitz
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <div className="flex justify-between font-bold text-slate-300 text-xs mb-1">
                  <span>Initial Team Purse:</span>
                  <span className="text-amber-400 text-sm font-black">₹{(initialPurse / 100).toFixed(0)} Crores</span>
                </div>
                <input
                  type="range"
                  min={3000}
                  max={15000}
                  step={500}
                  value={initialPurse}
                  onChange={(e) => setInitialPurse(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Max Squad</label>
                  <input
                    type="number"
                    value={maxSquadSize}
                    onChange={(e) => setMaxSquadSize(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Min Squad</label>
                  <input
                    type="number"
                    value={minSquadSize}
                    onChange={(e) => setMinSquadSize(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Max Overseas</label>
                  <input
                    type="number"
                    value={maxOverseas}
                    onChange={(e) => setMaxOverseas(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer mt-2"
              >
                <span>{isCreating ? 'Creating Room...' : 'Create Auction Room & Open Lobby'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: 1-CLICK SOLO TEST MODE */}
        {activeTab === 'SOLO' && (
          <div className="max-w-xl mx-auto w-full bg-slate-900/90 border border-amber-500/40 rounded-2xl p-6 shadow-2xl backdrop-blur-md animate-in fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Instant 1-Click Solo Test Mode</h3>
                <p className="text-xs text-slate-400">Experience full auction controls without waiting for other players.</p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 mb-5 leading-relaxed">
              <div className="flex items-start gap-2">
                <Dice5 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><strong>Random Pool Autoselection:</strong> Automatically draws players randomly without sequential order from Marquee or any chosen set.</span>
              </div>
              <div className="flex items-start gap-2">
                <SkipForward className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span><strong>Skip Mechanics:</strong> Skip any player on the stage or in the queue to defer them to later rounds.</span>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Simulated Franchise Bidding:</strong> Use the &quot;Test Bid As...&quot; pod inside the arena to place bids on behalf of any of the 10 franchises.</span>
              </div>
            </div>

            <button
              onClick={handleLaunchSoloTest}
              disabled={isSoloLaunching}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isSoloLaunching ? 'Launching Solo Arena...' : '🚀 Launch Instant Solo Auction'}</span>
            </button>
          </div>
        )}

        {/* TAB: SQUADS & ROSTERS SHOWCASE */}
        {activeTab === 'SQUADS' && (
          <div className="w-full">
            <AllSquadsInspector activeRoomCode={activeRoomCode} />
          </div>
        )}

        {/* TAB: CONDUCTED AUCTIONS & MASTER REPORTS */}
        {activeTab === 'REPORTS' && (
          <div className="w-full">
            <ConductedAuctionsReport />
          </div>
        )}

        {/* TAB 5: CSVs & PLAYER POOLS (STRICTLY 2 OPTIONS: CURRENT SQUAD & AUCTION POOL) */}
        {activeTab === 'POOLS' && (
          <div className="max-w-3xl mx-auto w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md animate-in fade-in">
            <div className="flex items-center justify-between gap-3 mb-5 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">CSV Data Upload & Ingestion</h3>
                  <p className="text-xs text-slate-400">Upload or download spreadsheets for Current Squads and the Auction Pool.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setUploadInitialTarget('RETAINED_SQUADS');
                    setIsUploadModalOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Squad</span>
                </button>
                <button
                  onClick={() => {
                    setUploadInitialTarget('AUCTION_POOL');
                    setIsUploadModalOpen(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Pool</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Current Squad CSV */}
              <div className="bg-slate-950 border border-blue-900/50 hover:border-blue-700/70 rounded-xl p-5 flex flex-col justify-between transition">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] bg-blue-950 text-blue-300 font-bold px-2 py-0.5 rounded border border-blue-800">
                      Option 1
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      10 Franchises • 184 Stars
                    </span>
                  </div>
                  <h4 className="font-black text-base text-white mb-1.5 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span>Current Squad CSV</span>
                  </h4>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    Pre-populates each franchise with their retained stars (Gaikwad, Samson, Kohli, Bumrah, Narine) and calculates exact remaining purses from ₹130 Cr.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      setUploadInitialTarget('RETAINED_SQUADS');
                      setIsUploadModalOpen(true);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20 transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Current Squad</span>
                  </button>

                  <a
                    href="/ipl_2027_retained_players.csv"
                    download="ipl_2027_retained_players.csv"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs py-2 px-3 rounded-xl border border-slate-800 flex items-center justify-center gap-1.5 transition text-center"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Current Squad CSV</span>
                  </a>
                </div>
              </div>

              {/* Option 2: Auction Pool CSV */}
              <div className="bg-slate-950 border border-amber-900/50 hover:border-amber-700/70 rounded-xl p-5 flex flex-col justify-between transition">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] bg-amber-950 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-800">
                      Option 2
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      87 Upcoming Players
                    </span>
                  </div>
                  <h4 className="font-black text-base text-white mb-1.5 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>Auction Pool CSV</span>
                  </h4>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    The bidding queue of upcoming players (Head, Starc, Boult, Pathirana, Hetmyer) spanning Marquee, Batters, Bowlers, and All-Rounders with base prices.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      setUploadInitialTarget('AUCTION_POOL');
                      setIsUploadModalOpen(true);
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Auction Pool</span>
                  </button>

                  <a
                    href="/ipl_2027_auction_pool.csv"
                    download="ipl_2027_auction_pool.csv"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs py-2 px-3 rounded-xl border border-slate-800 flex items-center justify-center gap-1.5 transition text-center"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Pool CSV</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-4xl mx-auto w-full">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Dice5 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-xs text-white uppercase tracking-wider mb-0.5">
                Random Pool Autoselect
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Nominate players randomly from Marquee, Bowlers, or any specific pool without strict sequential constraints.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-xs text-white uppercase tracking-wider mb-0.5">
                Floating Minimized Stage
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Browse squads, lobby, or the home page without missing live stage bids thanks to the floating PiP widget.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-xs text-white uppercase tracking-wider mb-0.5">
                Simulated Bids & Gavel
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Test multi-team bidding, dynamic IPL increments (+5L, +10L, +20L, +25L), and manual auctioneer gavel controls.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Broadcast Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between text-xs text-slate-500 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Real-time Socket.io & LiveKit Engine Active</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('SQUADS')} className="hover:text-slate-300 cursor-pointer">All Squads</button>
          <button onClick={() => setActiveTab('JOIN')} className="hover:text-slate-300 cursor-pointer">Join Room</button>
          <button onClick={() => setActiveTab('SCHEDULES')} className="hover:text-slate-300 cursor-pointer">Schedules</button>
          <button onClick={() => setActiveTab('CREATE')} className="hover:text-slate-300 cursor-pointer">Create Room</button>
          <button onClick={() => setActiveTab('SOLO')} className="hover:text-slate-300 cursor-pointer">Solo Test</button>
          <button onClick={() => setActiveTab('REPORTS')} className="hover:text-slate-300 cursor-pointer">Conducted Auctions</button>
        </div>
      </footer>

      {/* Upload Modal (Current Squad or Auction Pool) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <PlayerPoolUploader
            initialTarget={uploadInitialTarget}
            onClose={() => setIsUploadModalOpen(false)}
            roomCode={activeRoomCode || undefined}
          />
        </div>
      )}

      {/* Mandatory Initial Login Gate */}
      <LoginModal
        isOpen={isLoginOpen}
        allowClose={!!userName && !!userEmail}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={(sess) => {
          setUserName(sess.userName);
          setUserEmail(sess.userEmail);
          setIsSuperAdmin(sess.isAdmin);
          setIsLoginOpen(false);
        }}
      />
    </div>
  );
}
