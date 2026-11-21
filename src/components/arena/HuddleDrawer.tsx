'use client';

import React, { useState } from 'react';
import {
  Users,
  Mic,
  MicOff,
  Radio,
  Volume2,
  Crown,
  Shield,
  X,
  Sparkles,
  ArrowRight,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FRANCHISES, FRANCHISE_LIST } from '@/data/franchises';
import { FranchiseCode } from '@/types/auction';

interface HuddleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTeamChat?: () => void;
  onSwitchTeam?: () => void;
}

export const HuddleDrawer: React.FC<HuddleDrawerProps> = ({
  isOpen,
  onClose,
  onOpenTeamChat,
  onSwitchTeam,
}) => {
  const {
    room,
    userId,
    userName,
    role,
    franchiseCode,
    micRoute,
    setMicRoute,
    isTeammateSpeaking,
    setIsTeammateSpeaking,
    claimRole,
  } = useAuctionStore();

  const [simulatedDuck, setSimulatedDuck] = useState(false);

  if (!isOpen) return null;

  const franchise = franchiseCode ? FRANCHISES[franchiseCode] : null;

  // Online teammates in the same franchise
  const teammates = room && franchiseCode
    ? Object.values(room.users).filter(
        (u) => u.franchiseCode === franchiseCode && u.id !== userId && u.isOnline
      )
    : [];

  const toggleSimulation = () => {
    const next = !simulatedDuck;
    setSimulatedDuck(next);
    setIsTeammateSpeaking(next);
  };

  const handleSelectTeam = async (code: FranchiseCode) => {
    await claimRole('TEAM_MEMBER', code);
    setMicRoute('TEAM');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Panel */}
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-14 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 bg-slate-950/80">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shadow"
              style={{
                backgroundColor: franchise ? franchise.primaryColor : '#3B82F6',
                color: franchise ? franchise.textColor : '#FFFFFF',
              }}
            >
              {franchise ? franchise.code : <Users className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="font-black text-sm text-white flex items-center gap-1.5">
                <span>{franchise ? `${franchise.name} Huddle` : 'Private Team Huddle'}</span>
              </h2>
              <p className="text-[10px] text-slate-400">
                {franchise
                  ? `Private table voice • ${teammates.length + 1} online`
                  : 'Join a franchise table to huddle'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {franchise ? (
            <>
              {/* Franchise Banner & Voice Ducking Status */}
              <div
                className="rounded-2xl p-4 border flex flex-col gap-2 relative overflow-hidden shadow-inner"
                style={{
                  backgroundColor: `${franchise.primaryColor}15`,
                  borderColor: `${franchise.primaryColor}40`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                    Private Table Channel
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      micRoute === 'TEAM'
                        ? 'bg-blue-600 text-white border-blue-400 animate-pulse'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {micRoute === 'TEAM' ? '● Huddle Mic Active' : 'Huddle Mic Muted'}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full animate-ping"
                    style={{ backgroundColor: franchise.primaryColor }}
                  />
                  <span className="text-lg font-black text-white">
                    {franchise.name} ({franchise.code})
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Only your franchise teammates can hear this voice channel. Main stage audio is{' '}
                  <strong className="text-amber-400">automatically ducked to 25%</strong> when teammates speak so you can strategize privately without the Auctioneer hearing.
                </p>

                {/* Audio Ducking Indicator */}
                {(isTeammateSpeaking || simulatedDuck) && (
                  <div className="mt-1 bg-amber-500/20 border border-amber-500/40 rounded-xl p-2.5 flex items-center gap-2 text-xs font-bold text-amber-300 animate-pulse">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>Teammate speaking — Main Stage volume ducked to 25%</span>
                  </div>
                )}
              </div>

              {/* Quick Mic Control Bar */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Your Voice Routing
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setMicRoute('MUTED')}
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      micRoute === 'MUTED'
                        ? 'bg-rose-600 text-white shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <MicOff className="w-3.5 h-3.5" />
                    <span>Muted</span>
                  </button>

                  <button
                    onClick={() => setMicRoute('TEAM')}
                    className={`p-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      micRoute === 'TEAM'
                        ? 'bg-blue-600 text-white shadow ring-1 ring-blue-400 animate-pulse'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Huddle</span>
                  </button>

                  <button
                    onClick={() => setMicRoute('MAIN')}
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      micRoute === 'MAIN'
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Main Stage</span>
                  </button>
                </div>
              </div>

              {/* Teammates Roster */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Table Teammates ({teammates.length + 1})</span>
                  </span>
                  <button
                    onClick={toggleSimulation}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                      simulatedDuck
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {simulatedDuck ? 'Stop Duck Test' : 'Test Audio Duck'}
                  </button>
                </div>

                <div className="space-y-1.5 pt-1">
                  {/* You */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="font-black text-white">{userName} (You)</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      Mic: {micRoute}
                    </span>
                  </div>

                  {/* Teammates */}
                  {teammates.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500 italic bg-slate-900/50 rounded-xl">
                      No other teammates currently connected to this table. Share room code to invite!
                    </div>
                  ) : (
                    teammates.map((tm) => (
                      <div
                        key={tm.id}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs transition ${
                          simulatedDuck
                            ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200 animate-pulse'
                            : 'bg-slate-900/70 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              simulatedDuck ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                            }`}
                          />
                          <span className="font-bold">{tm.name}</span>
                          {tm.teamRole === 'CAPTAIN' && (
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {simulatedDuck ? 'Speaking...' : 'Listening'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Buttons: Private Chat & Switch Table */}
              <div className="flex flex-col gap-2 pt-1">
                {onOpenTeamChat && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenTeamChat();
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Open {franchise.code} Private Team Chat</span>
                  </button>
                )}

                {onSwitchTeam && (
                  <button
                    onClick={() => {
                      onClose();
                      onSwitchTeam();
                    }}
                    className="w-full bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Switch to Another Franchise Table</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* User Has Not Picked a Franchise Yet */
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl">
                <Users className="w-8 h-8 animate-pulse" />
              </div>

              <div>
                <h3 className="text-base font-black text-white">Join a Franchise Table</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Select an IPL franchise to enter their private voice huddle, coordinate bids, and talk privately with teammates.
                </p>
              </div>

              {/* Franchise Quick Select Grid */}
              <div className="w-full grid grid-cols-2 gap-2 text-left pt-2">
                {FRANCHISE_LIST.map((f) => (
                  <button
                    key={f.code}
                    onClick={() => handleSelectTeam(f.code)}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:border-blue-500 hover:bg-blue-950/20 transition flex items-center gap-2.5 cursor-pointer group"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow"
                      style={{ backgroundColor: f.primaryColor }}
                    >
                      {f.code}
                    </div>
                    <div className="overflow-hidden">
                      <span className="font-bold text-xs text-white block group-hover:text-blue-300 truncate">
                        {f.shortName}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        Join Huddle
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
