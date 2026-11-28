'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Search,
  CheckCircle,
  Gavel,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  Plane,
} from 'lucide-react';
import Link from 'next/link';
import { FRANCHISES, FRANCHISE_LIST } from '@/data/franchises';
import { FranchiseCode, PlayerRole } from '@/types/auction';
import { formatIndianCurrency } from '@/lib/utils';
import { PlayingXIBuilderModal } from './PlayingXIBuilderModal';
import { useAuctionStore } from '@/store/auctionStore';
import { FranchiseLogo } from '@/components/common/FranchiseLogo';
import { getFranchiseTheme, BroadcastCricketSilhouette } from '@/lib/franchiseThemes';

interface MasterPlayer {
  id: string;
  name: string;
  teamCode: FranchiseCode;
  role: PlayerRole;
  country: string;
  isOverseas: boolean;
  soldAmount: number; // in Lakhs
  priceCr?: number;
  isRetained: boolean;
  imageUrl?: string;
  statsSummary?: string;
}

interface TeamPurseSummary {
  remainingPurse: number;
  spentLakhs: number;
  retainedCount: number;
  overseasCount: number;
  vacantSlots: number;
  maxOverseasSlots: number;
}

interface AllSquadsInspectorProps {
  activeRoomCode?: string | null;
}

export const AllSquadsInspector: React.FC<AllSquadsInspectorProps> = ({ activeRoomCode }) => {
  const { franchiseCode: userFranchise } = useAuctionStore();
  const [allSquadPlayers, setAllSquadPlayers] = useState<MasterPlayer[]>([]);
  const [teamPurses, setTeamPurses] = useState<Record<string, TeamPurseSummary>>({});
  const [selectedFranchise, setSelectedFranchise] = useState<FranchiseCode | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<PlayerRole | 'ALL'>('ALL');
  const [acquisitionFilter, setAcquisitionFilter] = useState<'ALL' | 'RETAINED' | 'BOUGHT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [playingXIFranchise, setPlayingXIFranchise] = useState<FranchiseCode | null>(null);

  const fetchSquads = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/global/upload');
      const data = await res.json();
      if (data.success && Array.isArray(data.retainedSquads)) {
        const formatted: MasterPlayer[] = data.retainedSquads.map((p: any, idx: number) => ({
          id: `master_p_${idx}`,
          name: p.name,
          teamCode: p.team,
          role: p.role,
          country: p.country,
          isOverseas: !!p.isOverseas,
          soldAmount: p.price || 0,
          priceCr: p.priceCr || (p.price || 0) / 100,
          isRetained: true,
          imageUrl: p.imageUrl,
          statsSummary: `Retained by ${p.team} for ₹${((p.price || 0) / 100).toFixed(2)} Cr`,
        }));
        setAllSquadPlayers(formatted);
        if (data.teamPurses) {
          setTeamPurses(data.teamPurses);
        }
      }
    } catch (err) {
      console.warn('Error fetching master squads', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSquads();
  }, []);

  // Filter players
  const filteredPlayers = useMemo(() => {
    return allSquadPlayers.filter((p) => {
      const matchesTeam = selectedFranchise === 'ALL' || p.teamCode === selectedFranchise;
      const matchesRole = roleFilter === 'ALL' || p.role === roleFilter;
      const matchesAcquisition =
        acquisitionFilter === 'ALL' ||
        (acquisitionFilter === 'RETAINED' && p.isRetained) ||
        (acquisitionFilter === 'BOUGHT' && !p.isRetained);
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        p.teamCode.toLowerCase().includes(q);

      return matchesTeam && matchesRole && matchesAcquisition && matchesSearch;
    });
  }, [allSquadPlayers, selectedFranchise, roleFilter, acquisitionFilter, searchQuery]);

  const singleTeamPurses = selectedFranchise !== 'ALL' ? teamPurses[selectedFranchise] : null;
  const singleFranchise = selectedFranchise !== 'ALL' ? FRANCHISES[selectedFranchise] : null;

  const countByRole = (role: PlayerRole) => {
    if (selectedFranchise === 'ALL') {
      return allSquadPlayers.filter((p) => p.role === role).length;
    }
    return allSquadPlayers.filter((p) => p.teamCode === selectedFranchise && p.role === role).length;
  };

  const totalRetainedCount = allSquadPlayers.filter((p) => p.isRetained).length;
  const totalBoughtCount = allSquadPlayers.filter((p) => !p.isRetained).length;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header Card matching Live Room Squads */}
      <div className="border border-amber-500/30 bg-[#0A1138]/90 backdrop-blur-xl px-6 py-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-4 flex-wrap">
          {activeRoomCode && (
            <Link
              href={`/room/${activeRoomCode}/arena`}
              className="ipl-slant flex items-center gap-1.5 text-xs text-slate-950 font-display font-black transition ipl-gold-gradient px-3.5 py-1.5 shadow-md uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Live Arena</span>
            </Link>
          )}

          <div className="flex items-center gap-2.5">
            <div className="ipl-slant w-9 h-9 bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-display font-black shadow-md">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-display font-extrabold text-white leading-tight uppercase tracking-wider flex items-center gap-2">
                All Franchises Squad Roster
                <span className="font-mono text-xs text-amber-300 bg-[#050922] px-2 py-0.5 rounded border border-amber-500/30">
                  {activeRoomCode || 'IPL 2027'}
                </span>
              </h1>
              <p className="text-[11px] text-amber-300/80 font-sans">
                Official Match Center Roster Sheet • Retained &amp; Auction-Bought Squads
              </p>
            </div>
          </div>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center gap-2 bg-[#050922] border border-amber-500/30 px-3.5 py-1.5 rounded-xl text-xs shrink-0 font-display">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-200 font-bold uppercase tracking-wider">
            Total Players: <strong className="text-white">{allSquadPlayers.length}</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-blue-400 font-semibold">{totalRetainedCount} Retained</span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 font-semibold">{totalBoughtCount} Bought</span>
        </div>
      </div>

      {/* Franchise Tabs (All 10 Teams + All Filter) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedFranchise('ALL')}
          className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider whitespace-nowrap transition border cursor-pointer ${
            selectedFranchise === 'ALL'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          All 10 Franchises ({allSquadPlayers.length})
        </button>

        {FRANCHISE_LIST.map((f) => {
          const isSelected = selectedFranchise === f.code;
          const squadCount = allSquadPlayers.filter((p) => p.teamCode === f.code).length;

          return (
            <button
              key={f.code}
              onClick={() => setSelectedFranchise(f.code)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border cursor-pointer ${
                isSelected
                  ? 'ring-2 shadow-lg text-white'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
              style={{
                backgroundColor: isSelected ? `${f.primaryColor}30` : undefined,
                borderColor: isSelected ? f.primaryColor : undefined,
                color: isSelected ? '#FFFFFF' : undefined,
              }}
            >
              <FranchiseLogo code={f.code} size="xs" />
              <span>{f.shortName}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/80 font-mono text-slate-300">
                {squadCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Team Overview Header Card (when single team chosen) */}
      {singleFranchise && (
        <div
          className="p-5 rounded-2xl border relative overflow-hidden shadow-2xl transition"
          style={{
            background: `linear-gradient(135deg, ${singleFranchise.primaryColor}22, ${singleFranchise.secondaryColor}15, #020617)`,
            borderColor: singleFranchise.primaryColor,
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3.5">
              <FranchiseLogo code={singleFranchise.code} size="lg" className="shadow-xl" />
              <div>
                <h2 className="text-2xl font-black text-white">{singleFranchise.name}</h2>
                <p className="text-xs text-slate-400 font-medium">
                  {singleFranchise.city} • Official IPL Franchise
                </p>
              </div>
            </div>

            {/* Metrics Grid & Playing XI Button */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Purse</span>
                  <span className="text-base font-black text-emerald-400">
                    {singleTeamPurses
                      ? formatIndianCurrency(singleTeamPurses.remainingPurse)
                      : '₹18.00 Cr'}
                  </span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Squad Capacity</span>
                  <span className="text-base font-black text-white">
                    {allSquadPlayers.filter((p) => p.teamCode === singleFranchise.code).length} / 25
                  </span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Overseas</span>
                  <span className="text-base font-black text-amber-400">
                    {allSquadPlayers.filter((p) => p.teamCode === singleFranchise.code && p.isOverseas).length} / 8
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPlayingXIFranchise(singleFranchise.code)}
                className={`px-4 py-3 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition cursor-pointer whitespace-nowrap ${
                  userFranchise === singleFranchise.code
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{userFranchise === singleFranchise.code ? 'Form Playing XI' : 'View Playing XI'}</span>
              </button>
            </div>
          </div>

          {/* Role Balance Breakdown Pill Bar */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-400 text-[11px] uppercase tracking-wider">Role Balance:</span>
            <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 font-medium">
              Batters: <strong className="text-white">{countByRole('BAT')}</strong>
            </span>
            <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 font-medium">
              Keepers: <strong className="text-white">{countByRole('WK')}</strong>
            </span>
            <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 font-medium">
              All-Rounders: <strong className="text-white">{countByRole('AR')}</strong>
            </span>
            <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 font-medium">
              Bowlers: <strong className="text-white">{countByRole('BOWL')}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Role Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">Role:</span>
          {(['ALL', 'BAT', 'WK', 'AR', 'BOWL'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                roleFilter === r
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {r === 'ALL'
                ? 'All Roles'
                : r === 'BAT'
                ? 'Batters (BAT)'
                : r === 'WK'
                ? 'Wicketkeepers (WK)'
                : r === 'AR'
                ? 'All-Rounders (AR)'
                : 'Bowlers (BOWL)'}
            </button>
          ))}
        </div>

        {/* Acquisition Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">Type:</span>
          <button
            onClick={() => setAcquisitionFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              acquisitionFilter === 'ALL'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setAcquisitionFilter('RETAINED')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              acquisitionFilter === 'RETAINED' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Retained
          </button>
          <button
            onClick={() => setAcquisitionFilter('BOUGHT')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
              acquisitionFilter === 'BOUGHT' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Auction Bought
          </button>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search player, country, team..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Players Grid with Broadcast Silhouette Avatar Placeholders */}
      {isLoading ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <span>Loading official franchise squads...</span>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="font-bold text-slate-400 text-sm">No players found matching current filters</p>
          <p className="text-xs text-slate-500 mt-1">
            Either no players have been acquired yet for this franchise, or your search query yielded no results.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredPlayers.map((player, idx) => {
            const franchise = FRANCHISES[player.teamCode];
            const theme = getFranchiseTheme(player.teamCode);

            return (
              <div
                key={`${player.id}-${player.teamCode}-${idx}`}
                className="bg-[#0A1138]/95 border border-amber-500/30 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl hover:border-amber-400/70 hover:shadow-2xl transition-all duration-300 group relative backdrop-blur-md"
              >
                {/* Top Broadcast Franchise Header Banner with Watermark */}
                <div
                  className="relative px-3 py-1.5 flex items-center justify-between overflow-hidden shadow"
                  style={{ background: theme.primaryGradient }}
                >
                  <div className="flex items-center gap-1.5 relative z-10">
                    <FranchiseLogo code={theme.code} size="xs" />
                    <span
                      className="font-display font-black text-xs uppercase tracking-wider"
                      style={{ color: theme.textColor }}
                    >
                      {theme.shortName}
                    </span>
                  </div>

                  <span
                    className="font-display font-extrabold text-sm opacity-60 tracking-wider uppercase relative z-10"
                    style={{ color: theme.textColor }}
                  >
                    {theme.code}
                  </span>
                </div>

                {/* Middle: Image or Authentic Broadcast Cricket Silhouette */}
                <div className="relative aspect-[4/3] bg-gradient-to-b from-[#101A4F] via-[#070D26] to-[#04081E] overflow-hidden flex items-center justify-center border-b border-white/10">
                  {/* Stadium Diagonal Watermark Stripes */}
                  <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.06) 8px, rgba(255,255,255,0.06) 16px)',
                    }}
                  />

                  {player.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={player.imageUrl}
                      alt={player.name}
                      className="w-full h-full object-contain object-bottom group-hover:scale-105 transition-transform duration-300 relative z-10"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    /* Authentic Cricket Jersey Avatar */
                    <BroadcastCricketSilhouette
                      code={theme.code}
                      size="md"
                      className="relative z-10"
                    />
                  )}

                  {/* Top-Left Ribbon: Gold RETAINED or Green AUCTION BUY */}
                  <div className="absolute top-2 left-2 z-20">
                    {player.isRetained ? (
                      <span className="ipl-slant ipl-gold-gradient text-slate-950 font-display font-black text-[10px] px-2.5 py-0.5 tracking-wider uppercase shadow-md flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5" />
                        <span>RETAINED</span>
                      </span>
                    ) : (
                      <span className="ipl-slant bg-emerald-500 text-slate-950 font-display font-black text-[10px] px-2.5 py-0.5 tracking-wider uppercase shadow-md flex items-center gap-1">
                        <Gavel className="w-2.5 h-2.5" />
                        <span>AUCTION BUY</span>
                      </span>
                    )}
                  </div>

                  {/* Top-Right: Role Badge */}
                  <div className="absolute top-2 right-2 z-20">
                    <span className="bg-[#070D26]/90 border border-white/20 text-amber-400 font-display font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider shadow">
                      {player.role}
                    </span>
                  </div>
                </div>

                {/* Bottom Crisp Nameplate */}
                <div className="p-3.5 flex flex-col justify-between flex-1 gap-2 bg-[#050922]">
                  <div>
                    {/* Player Name in bold Barlow Condensed */}
                    <h3 className="font-display font-extrabold text-base md:text-lg text-white group-hover:text-amber-400 transition truncate uppercase tracking-tight leading-tight">
                      {player.name}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 font-sans">
                      <span>{player.country}</span>
                      {player.isOverseas && (
                        <span className="ipl-slant bg-amber-400 text-slate-950 font-display font-black text-[9px] px-2 py-0.2 tracking-wider flex items-center gap-0.5 uppercase shadow-sm">
                          <Plane className="w-2.5 h-2.5" />
                          OVERSEAS
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bold Franchise-Colored Price Bar */}
                  <div
                    className="ipl-slant mt-1 px-3 py-1.5 flex items-center justify-between shadow-md"
                    style={{
                      background: theme.bannerGradient,
                      color: theme.textColor,
                    }}
                  >
                    <span className="font-display font-bold text-[10px] uppercase tracking-wider opacity-85">
                      {player.isRetained ? 'RETAINED SLAB' : 'HAMMER PRICE'}
                    </span>
                    <span className="font-display font-black text-sm md:text-base tabular-nums tracking-tight">
                      {player.soldAmount ? formatIndianCurrency(player.soldAmount) : '₹18.00 CR'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Playing XI Builder Modal */}
      {playingXIFranchise && (
        <PlayingXIBuilderModal
          franchiseCode={playingXIFranchise}
          squad={allSquadPlayers
            .filter((p) => p.teamCode === playingXIFranchise)
            .map((p) => ({
              id: p.id,
              name: p.name,
              role: p.role,
              country: p.country,
              isOverseas: p.isOverseas,
              basePrice: p.soldAmount || 20,
              statsSummary: p.statsSummary || `Official squad member of ${p.teamCode}`,
              set: 'Accelerated' as const,
              previousTeam: null,
              status: 'SOLD' as const,
              soldTo: p.teamCode,
              soldAmount: p.soldAmount,
              isRetained: p.isRetained,
              imageUrl: p.imageUrl,
            }))}
          onClose={() => setPlayingXIFranchise(null)}
          roomCode={activeRoomCode || 'GLOBAL'}
          isReadOnly={userFranchise !== playingXIFranchise}
          userAssignedFranchise={userFranchise}
        />
      )}
    </div>
  );
};
