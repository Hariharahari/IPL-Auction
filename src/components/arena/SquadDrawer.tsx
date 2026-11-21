'use client';

import React, { useState } from 'react';
import { X, Shield, Globe, Award, DollarSign } from 'lucide-react';
import { FRANCHISES } from '@/data/franchises';
import { BoughtPlayer, FranchiseCode, PlayerRole } from '@/types/auction';
import { formatIndianCurrency } from '@/lib/utils';
import { PlayingXIBuilderModal } from './PlayingXIBuilderModal';

interface SquadDrawerProps {
  franchiseCode: FranchiseCode | null;
  squad: BoughtPlayer[];
  remainingPurse: number;
  initialPurse: number;
  onClose: () => void;
}

const ROLE_LABELS: Record<PlayerRole, string> = {
  BAT: 'Batters',
  WK: 'Wicketkeepers',
  AR: 'All-Rounders',
  BOWL: 'Bowlers',
};

export const SquadDrawer: React.FC<SquadDrawerProps> = ({
  franchiseCode,
  squad,
  remainingPurse,
  initialPurse,
  onClose,
}) => {
  const [showPlayingXI, setShowPlayingXI] = useState(false);
  if (!franchiseCode) return null;

  const franchise = FRANCHISES[franchiseCode];
  const spentAmount = initialPurse - remainingPurse;
  const overseasCount = squad.filter((p) => p.isOverseas).length;

  // Group squad players by role
  const roles: PlayerRole[] = ['BAT', 'WK', 'AR', 'BOWL'];
  const playersByRole = roles.reduce((acc, role) => {
    acc[role] = squad.filter((p) => p.role === role);
    return acc;
  }, {} as Record<PlayerRole, BoughtPlayer[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{ borderColor: franchise.primaryColor }}
      >
        {/* Header Banner */}
        <div
          className="p-5 flex items-center justify-between text-white relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${franchise.primaryColor}CC, ${franchise.secondaryColor}EE)`,
          }}
        >
          <div className="flex items-center gap-3 z-10">
            <div className="w-12 h-12 rounded-xl bg-slate-950/40 border border-white/20 flex items-center justify-center font-black text-xl tracking-wider">
              {franchise.code}
            </div>
            <div>
              <h2 className="text-xl font-black drop-shadow-md">{franchise.name}</h2>
              <p className="text-xs text-white/80 font-medium">Official Squad & Roster Sheet</p>
            </div>
          </div>
          <div className="flex items-center gap-2 z-10">
            <button
              onClick={() => setShowPlayingXI(true)}
              className="bg-slate-950/70 hover:bg-slate-950 text-amber-300 border border-white/20 text-xs font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <span>Form Playing XI</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Squad Summary Stats Bar */}
        <div className="grid grid-cols-4 gap-2 p-4 bg-slate-950 border-b border-slate-800 text-center">
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Squad</p>
            <p className="text-base font-black text-white">{squad.length} / 25</p>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Overseas</p>
            <p className="text-base font-black text-amber-400">{overseasCount} / 8</p>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Spent</p>
            <p className="text-base font-black text-rose-400">{formatIndianCurrency(spentAmount)}</p>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-400">Purse Left</p>
            <p className="text-base font-black text-emerald-400">{formatIndianCurrency(remainingPurse)}</p>
          </div>
        </div>

        {/* Squad Breakdown By Role */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {squad.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Shield className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-slate-400">No players acquired yet</p>
              <p className="text-xs text-slate-500 mt-1">This franchise has not won any bids so far.</p>
            </div>
          ) : (
            roles.map((role) => {
              const players = playersByRole[role];
              if (players.length === 0) return null;

              return (
                <div key={role} className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" />
                      {ROLE_LABELS[role]} ({players.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {players.map((p, idx) => (
                      <div
                        key={`${p.id}-${idx}`}
                        className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">
                            {p.role}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-white">{p.name}</span>
                              {p.isOverseas && (
                                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] px-1 py-0.2 rounded font-semibold flex items-center gap-0.5">
                                  <Globe className="w-2.5 h-2.5" />
                                  Overseas
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">{p.country}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800">
                            {formatIndianCurrency(p.soldAmount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showPlayingXI && franchiseCode && (
        <PlayingXIBuilderModal
          franchiseCode={franchiseCode}
          squad={squad}
          onClose={() => setShowPlayingXI(false)}
        />
      )}
    </div>
  );
};
