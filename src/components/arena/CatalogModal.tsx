'use client';

import React, { useState } from 'react';
import { Layers, Search, Dice5, X } from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { Player, PlayerRole, PlayerSet, PlayerStatus } from '@/types/auction';
import { formatIndianCurrency } from '@/lib/utils';

interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CatalogModal: React.FC<CatalogModalProps> = ({ isOpen, onClose }) => {
  const { room, nominatePlayer, nominateNext } = useAuctionStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSet, setSelectedSet] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('UPCOMING');

  if (!isOpen) return null;

  const allPlayers = room?.allPlayers || [];
  const activePlayer = room?.activePlayer;

  const sets: PlayerSet[] = [
    'Marquee',
    'Batters',
    'All-Rounders',
    'Wicketkeepers',
    'Fast Bowlers',
    'Spinners',
    'Accelerated',
  ];

  const filteredPlayers = allPlayers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSet = selectedSet === 'ALL' || p.set === selectedSet;
    const matchesRole = selectedRole === 'ALL' || p.role === selectedRole;
    const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    return matchesSearch && matchesSet && matchesRole && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              Player Nomination Catalog
            </h2>
            <p className="text-xs text-slate-400">Select any player to bring them to the live auction block.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
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

        {/* Players List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-xs text-slate-400">
              Showing <strong className="text-white">{filteredPlayers.length}</strong> players
            </span>
            <button
              onClick={async () => {
                await nominateNext({ mode: 'RANDOM', set: selectedSet === 'ALL' ? undefined : selectedSet });
                onClose();
              }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <Dice5 className="w-3.5 h-3.5" />
              <span>🎲 Draw Random from {selectedSet === 'ALL' ? 'Current Pool' : selectedSet}</span>
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
                        {player.isOverseas && (
                          <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-800 px-1.5 py-0.2 rounded font-semibold">
                            Overseas
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">({player.country})</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="text-amber-400 font-semibold font-mono">
                          {formatIndianCurrency(player.basePrice)}
                        </span>
                        <span>•</span>
                        <span>Set: {player.set}</span>
                        {player.status !== 'UPCOMING' && (
                          <>
                            <span>•</span>
                            <span className="uppercase text-[10px] font-bold text-slate-500">
                              {player.status}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isNominated ? (
                      <span className="bg-amber-500 text-slate-950 text-xs font-black px-3 py-1.5 rounded-lg shadow animate-pulse">
                        On Stage
                      </span>
                    ) : player.status === 'SOLD' ? (
                      <span className="text-emerald-400 text-xs font-bold">
                        Sold ({player.soldTo})
                      </span>
                    ) : (
                      <button
                        onClick={async () => {
                          await nominatePlayer(player.id);
                          onClose();
                        }}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition"
                      >
                        Nominate
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
