'use client';

import React, { useState } from 'react';
import { Shield, Users, Globe, Award, Sparkles } from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FRANCHISES, FRANCHISE_LIST } from '@/data/franchises';
import { FranchiseCode, TeamState } from '@/types/auction';
import { formatIndianCurrency } from '@/lib/utils';
import { SquadDrawer } from './SquadDrawer';
import { PlayingXIBuilderModal } from './PlayingXIBuilderModal';

export const PurseLeaderboard: React.FC = () => {
  const { room } = useAuctionStore();
  const highestBidderTeam = room?.highestBidderTeam;
  const [selectedFranchise, setSelectedFranchise] = useState<FranchiseCode | null>(null);
  const [playingXIFranchise, setPlayingXIFranchise] = useState<FranchiseCode | null>(null);

  if (!room) return null;

  // Sort teams descending by remaining purse
  const sortedTeams = Object.values(room.teams).sort(
    (a, b) => b.remainingPurse - a.remainingPurse
  );

  const selectedTeamState = selectedFranchise ? room.teams[selectedFranchise] : null;

  return (
    <>
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-xl backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <h3 className="font-black text-sm tracking-wide uppercase text-white">
              Franchise Purse & Squads
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">Click team to view squad</span>
        </div>

        {/* Teams List */}
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
          {sortedTeams.map((team, index) => {
            const franchise = FRANCHISES[team.code];
            const isHighest = highestBidderTeam === team.code;
            const onlineMembers = Object.values(room.users).filter(
              (u) => u.franchiseCode === team.code && u.isOnline
            );

            return (
              <div
                key={team.code}
                onClick={() => setSelectedFranchise(team.code)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden group ${
                  isHighest
                    ? 'bg-slate-950 border-amber-400 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                {/* Accent Color Left Edge Bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: franchise.primaryColor }}
                />

                <div className="pl-2 flex items-center justify-between">
                  {/* Left: Code, Name, Online presence */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow"
                      style={{
                        backgroundColor: franchise.primaryColor,
                        color: franchise.textColor,
                      }}
                    >
                      {franchise.code}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white group-hover:text-amber-400 transition">
                          {franchise.shortName}
                        </span>
                        {isHighest && (
                          <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter flex items-center gap-0.5 animate-pulse">
                            <Sparkles className="w-2.5 h-2.5" />
                            Top Bid
                          </span>
                        )}
                      </div>

                      {/* Squad metrics row */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>
                          Squad: <strong className="text-slate-200">{team.squad.length}/25</strong>
                        </span>
                        <span>•</span>
                        <span>
                          OS: <strong className="text-amber-400">{team.overseasCount}/8</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Remaining Purse, Online Count & Playing XI button */}
                  <div className="text-right flex flex-col items-end">
                    <p className="text-xs font-black text-emerald-400 tabular-nums">
                      {formatIndianCurrency(team.remainingPurse)}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayingXIFranchise(team.code);
                      }}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black px-2 py-0.5 rounded mt-1 transition cursor-pointer flex items-center gap-1 shadow-sm"
                      title="Form Playing XI for this franchise"
                    >
                      <span>Form XI</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Playing XI Builder Modal */}
      {playingXIFranchise && room.teams[playingXIFranchise] && (
        <PlayingXIBuilderModal
          franchiseCode={playingXIFranchise}
          squad={room.teams[playingXIFranchise].squad}
          onClose={() => setPlayingXIFranchise(null)}
          roomCode={room.roomCode}
        />
      )}

      {/* Squad Drawer Modal */}
      {selectedFranchise && selectedTeamState && (
        <SquadDrawer
          franchiseCode={selectedFranchise}
          squad={selectedTeamState.squad}
          remainingPurse={selectedTeamState.remainingPurse}
          initialPurse={room.settings.initialPurse}
          onClose={() => setSelectedFranchise(null)}
        />
      )}
    </>
  );
};
