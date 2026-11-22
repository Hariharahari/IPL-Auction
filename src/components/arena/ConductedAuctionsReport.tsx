'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Search,
  Shield,
  Plane,
  Gavel,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trophy,
  ExternalLink,
  Users,
  DollarSign,
  TrendingUp,
  Sparkles,
  ArrowLeft,
  Calendar,
  Layers,
  ListOrdered,
  Clock,
  Radio,
} from 'lucide-react';
import { FRANCHISES, FRANCHISE_LIST } from '@/data/franchises';
import { AuctionRoomState, BoughtPlayer, FranchiseCode, Player } from '@/types/auction';
import { formatIndianCurrency, getStoredUser, isSuperAdminEmail } from '@/lib/utils';
import Link from 'next/link';
import { FranchiseLogo } from '@/components/common/FranchiseLogo';

interface ConductedAuctionsReportProps {
  initialRoomCode?: string;
}

interface SessionSummaryItem {
  roomCode: string;
  mode: 'Solo Test' | 'Multiplayer';
  status: 'Completed' | 'In Progress';
  phase: string;
  soldCount: number;
  unsoldCount: number;
  totalAuctioned: number;
  totalSpentLakhs: number;
  totalPlayers: number;
  participatingTeams: string[];
  lastActionMessage: string;
  updatedAt: number;
  createdAt: number;
  formattedDate: string;
}

export const ConductedAuctionsReport: React.FC<ConductedAuctionsReportProps> = ({
  initialRoomCode,
}) => {
  // If an initialRoomCode is passed explicitly, load that room; otherwise default to Master List View
  const [selectedRoomCode, setSelectedRoomCode] = useState<string | null>(
    initialRoomCode ? initialRoomCode.trim().toUpperCase() : null
  );
  const [inputCode, setInputCode] = useState<string>('');
  const [roomState, setRoomState] = useState<AuctionRoomState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Drill-down detailed view tabs
  const [activeTab, setActiveTab] = useState<'CHRONO' | 'SOLD' | 'UNSOLD' | 'SQUADS'>('CHRONO');
  const [selectedFranchise, setSelectedFranchise] = useState<FranchiseCode | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessions, setSessions] = useState<SessionSummaryItem[]>([]);
  const [modeFilter, setModeFilter] = useState<'ALL' | 'Solo Test' | 'Multiplayer'>('ALL');

  const fetchSessionsList = async () => {
    setIsSessionsLoading(true);
    try {
      const user = getStoredUser();
      const params = new URLSearchParams();
      if (user.userEmail) {
        params.set('email', user.userEmail);
      }
      if (user.isAdmin || isSuperAdminEmail(user.userEmail)) {
        params.set('isAdmin', 'true');
      }
      const qs = params.toString() ? `?${params.toString()}` : '';

      let res = await fetch(`/api/auctions/conducted${qs}`, { cache: 'no-store' });
      if (!res.ok) {
        res = await fetch(`/api/rooms${qs}`, { cache: 'no-store' });
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      }
    } catch (e) {
      console.warn('Failed to fetch rooms list', e);
    } finally {
      setIsSessionsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionsList();
  }, []);

  const fetchRoomReport = async (code: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/room/${code.trim().toUpperCase()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.room) {
        setRoomState(data.room);
        setSelectedRoomCode(code.trim().toUpperCase());
      } else {
        throw new Error(data.error || `Could not find auction session for room ${code}`);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load auction report');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRoomCode) {
      fetchRoomReport(selectedRoomCode);
    }
  }, [selectedRoomCode]);

  // Handle manual Room Code submit
  const handleLoadManualCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    fetchRoomReport(inputCode.trim().toUpperCase());
  };

  // Derive Sold Players
  const soldPlayers = useMemo(() => {
    if (!roomState) return [];
    if (roomState.soldHistory && roomState.soldHistory.length > 0) {
      return roomState.soldHistory.filter((p) => !p.isRetained);
    }
    const bought: BoughtPlayer[] = [];
    Object.values(roomState.teams || {}).forEach((team) => {
      (team.squad || []).forEach((player) => {
        if (!player.isRetained) {
          bought.push(player);
        }
      });
    });
    return bought;
  }, [roomState]);

  // Derive Unsold Players
  const unsoldPlayers = useMemo(() => {
    if (!roomState) return [];
    if (roomState.unsoldHistory && roomState.unsoldHistory.length > 0) {
      return roomState.unsoldHistory;
    }
    return (roomState.allPlayers || []).filter((p) => p.status === 'UNSOLD');
  }, [roomState]);

  // Derive Chronological Auction Log (Sold + Unsold ordered)
  const chronologicalLog = useMemo(() => {
    if (!roomState) return [];
    const events: Array<{
      id: string;
      name: string;
      role: string;
      country: string;
      isOverseas: boolean;
      basePrice: number;
      status: 'SOLD' | 'UNSOLD';
      soldTo: FranchiseCode | null;
      soldAmount: number | null;
      order: number;
      timestamp?: number;
    }> = [];

    (roomState.soldHistory || [])
      .filter((p) => !p.isRetained)
      .forEach((p, index) => {
      events.push({
        id: p.id,
        name: p.name,
        role: p.role,
        country: p.country,
        isOverseas: p.isOverseas,
        basePrice: p.basePrice || 20,
        status: 'SOLD',
        soldTo: p.soldTo,
        soldAmount: p.soldAmount,
        order: index + 1,
      });
    });

    (roomState.unsoldHistory || []).forEach((p, index) => {
      events.push({
        id: p.id,
        name: p.name,
        role: p.role,
        country: p.country,
        isOverseas: p.isOverseas,
        basePrice: p.basePrice || 20,
        status: 'UNSOLD',
        soldTo: null,
        soldAmount: null,
        order: (roomState.soldHistory?.length || 0) + index + 1,
      });
    });

    return events;
  }, [roomState]);

  // Compute Total Auction Spent
  const totalSpentLakhs = useMemo(() => {
    return soldPlayers.reduce((sum, p) => sum + (p.soldAmount || 0), 0);
  }, [soldPlayers]);

  // Filtered Sessions for Master List
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (modeFilter !== 'ALL' && s.mode !== modeFilter) return false;
      if (inputCode.trim()) {
        const q = inputCode.trim().toUpperCase();
        return (
          s.roomCode.includes(q) ||
          s.participatingTeams.some((t) => t.includes(q))
        );
      }
      return true;
    });
  }, [sessions, modeFilter, inputCode]);

  // Multi-Sheet Excel Export
  const handleExportExcel = () => {
    if (!roomState || !selectedRoomCode) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Chronological Auction Log
    const chronoRows = chronologicalLog.map((log) => ({
      Order: log.order,
      PlayerName: log.name,
      Status: log.status,
      Role: log.role,
      Country: log.country,
      IsOverseas: log.isOverseas ? 'Yes' : 'No',
      BasePrice_Cr: ((log.basePrice || 0) / 100).toFixed(2),
      WinningFranchise: log.soldTo || 'UNSOLD',
      SoldPrice_Cr: log.soldAmount ? (log.soldAmount / 100).toFixed(2) : '0.00',
    }));
    const wsChrono = XLSX.utils.json_to_sheet(chronoRows);
    XLSX.utils.book_append_sheet(wb, wsChrono, 'AuctionedLog');

    // Sheet 2: Sold Register
    const soldRows = soldPlayers.map((p) => ({
      PlayerName: p.name,
      WinningFranchise: p.soldTo || 'UNKNOWN',
      Role: p.role,
      Country: p.country,
      IsOverseas: p.isOverseas ? 'Yes' : 'No',
      BasePrice_Cr: ((p.basePrice || 0) / 100).toFixed(2),
      SoldPrice_Cr: ((p.soldAmount || 0) / 100).toFixed(2),
      SoldPrice_Lakhs: p.soldAmount || 0,
    }));
    const wsSold = XLSX.utils.json_to_sheet(soldRows);
    XLSX.utils.book_append_sheet(wb, wsSold, 'SoldRegister');

    // Sheet 3: Unsold Register
    const unsoldRows = unsoldPlayers.map((p) => ({
      PlayerName: p.name,
      Role: p.role,
      Country: p.country,
      IsOverseas: p.isOverseas ? 'Yes' : 'No',
      BasePrice_Cr: ((p.basePrice || 0) / 100).toFixed(2),
      Set: p.set || 'Accelerated',
    }));
    const wsUnsold = XLSX.utils.json_to_sheet(unsoldRows);
    XLSX.utils.book_append_sheet(wb, wsUnsold, 'UnsoldRegister');

    // Sheet 4: Final Franchise Squads
    const allSquadRows: Array<Record<string, unknown>> = [];
    FRANCHISE_LIST.forEach((f) => {
      const team = roomState.teams?.[f.code];
      const retained = (team?.squad || []).filter((p) => p.isRetained);
      const squadBought = (team?.squad || []).filter((p) => !p.isRetained);
      const historyBought = soldPlayers.filter((p) => p.soldTo === f.code);
      const boughtMap = new Map<string, BoughtPlayer>();
      squadBought.forEach((p) => boughtMap.set(p.name.toLowerCase(), p));
      historyBought.forEach((p) => {
        if (!boughtMap.has(p.name.toLowerCase())) {
          boughtMap.set(p.name.toLowerCase(), p);
        }
      });
      const fullSquad = [...retained, ...Array.from(boughtMap.values())];

      fullSquad.forEach((p) => {
        allSquadRows.push({
          Franchise: f.code,
          FranchiseName: f.name,
          PlayerName: p.name,
          Role: p.role,
          Country: p.country,
          IsOverseas: p.isOverseas ? 'Yes' : 'No',
          AcquisitionType: p.isRetained ? 'Pre-Retained' : 'Auction Bought',
          Price_Cr: ((p.soldAmount || p.basePrice || 0) / 100).toFixed(2),
        });
      });
    });
    const wsSquads = XLSX.utils.json_to_sheet(allSquadRows);
    XLSX.utils.book_append_sheet(wb, wsSquads, 'UpdatedSquads');

    XLSX.writeFile(wb, `IPL_2027_Auction_Report_${selectedRoomCode}.xlsx`);
  };

  // CSV Export for Quick Viewing
  const handleExportCSV = () => {
    if (!roomState || !selectedRoomCode) return;

    let csv = 'Franchise,PlayerName,Role,Country,IsOverseas,Type,Price_Cr\n';
    FRANCHISE_LIST.forEach((f) => {
      const team = roomState.teams?.[f.code];
      const retained = (team?.squad || []).filter((p) => p.isRetained);
      const squadBought = (team?.squad || []).filter((p) => !p.isRetained);
      const historyBought = soldPlayers.filter((p) => p.soldTo === f.code);
      const boughtMap = new Map<string, BoughtPlayer>();
      squadBought.forEach((p) => boughtMap.set(p.name.toLowerCase(), p));
      historyBought.forEach((p) => {
        if (!boughtMap.has(p.name.toLowerCase())) {
          boughtMap.set(p.name.toLowerCase(), p);
        }
      });
      const fullSquad = [...retained, ...Array.from(boughtMap.values())];

      fullSquad.forEach((p) => {
        const priceCr = ((p.soldAmount || p.basePrice || 0) / 100).toFixed(2);
        csv += `"${f.code}","${p.name}","${p.role}","${p.country}","${p.isOverseas ? 'Yes' : 'No'}","${
          p.isRetained ? 'Retained' : 'Bought'
        }","${priceCr}"\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `IPL_2027_Squads_${selectedRoomCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -------------------------------------------------------------
  // 1. MASTER LIST VIEW (DEFAULT ENTRY STATE)
  // -------------------------------------------------------------
  if (!selectedRoomCode) {
    return (
      <div className="space-y-6 animate-in fade-in">
        {/* Top Header & Search Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  Historical Archive
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {sessions.length} Recorded Sessions
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Conducted Auctions Directory
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Inspect complete chronological hammer logs, sold & unsold player registers, and final franchise rosters for any solo test or multiplayer room.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={fetchSessionsList}
                disabled={isSessionsLoading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSessionsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Search Bar & Mode Filter Bar */}
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
            <form onSubmit={handleLoadManualCode} className="flex-1 w-full flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="Enter or search Room Code (e.g. GLZ8PJ, SOLO-923)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition font-mono uppercase"
                />
              </div>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 shadow-lg shadow-amber-500/20"
              >
                Load Session Report
              </button>
            </form>

            {/* Mode Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl shrink-0">
              {(['ALL', 'Multiplayer', 'Solo Test'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setModeFilter(mode)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    modeFilter === mode
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode === 'ALL' ? 'All Modes' : mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Master Sessions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isSessionsLoading ? (
            <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
              <p className="font-bold text-sm text-slate-300">Loading conducted auction sessions...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
              <Trophy className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-400" />
              <p className="font-bold text-sm text-slate-300">No matching auction sessions found</p>
              <p className="text-xs text-slate-500 mt-1">
                Conduct an auction in Solo Test or create a Multiplayer room to see it archived here.
              </p>
            </div>
          ) : (
            filteredSessions.map((s) => (
              <div
                key={s.roomCode}
                onClick={() => fetchRoomReport(s.roomCode)}
                className="bg-slate-900/90 border border-slate-800/90 hover:border-amber-500/60 hover:bg-slate-900 rounded-2xl p-5 shadow-xl transition-all duration-200 cursor-pointer group flex flex-col justify-between gap-4"
              >
                <div>
                  {/* Top Bar: Room Code, Mode, Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 group-hover:animate-ping" />
                      <span className="font-mono text-lg font-black text-amber-400 tracking-wider">
                        {s.roomCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase border ${
                        s.mode === 'Solo Test'
                          ? 'bg-purple-950 text-purple-300 border-purple-800'
                          : 'bg-blue-950 text-blue-300 border-blue-800'
                      }`}>
                        {s.mode}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase border ${
                        s.status === 'Completed'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{s.formattedDate}</span>
                  </div>

                  {/* KPI Metrics */}
                  <div className="grid grid-cols-3 gap-2 py-2 bg-slate-950/70 rounded-xl p-2.5 border border-slate-800/80 text-center">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Sold</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">{s.soldCount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Unsold</span>
                      <span className="text-sm font-black text-rose-400 font-mono">{s.unsoldCount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Spent</span>
                      <span className="text-sm font-black text-white font-mono">
                        ₹{(s.totalSpentLakhs / 100).toFixed(1)} Cr
                      </span>
                    </div>
                  </div>

                  {/* Participating Teams Badges */}
                  <div className="mt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Participating Franchises ({s.participatingTeams.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {s.participatingTeams.slice(0, 8).map((code) => (
                        <FranchiseLogo key={code} code={code} size="xs" />
                      ))}
                      {s.participatingTeams.length > 8 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          +{s.participatingTeams.length - 8}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer action */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                    {s.lastActionMessage}
                  </span>
                  <span className="text-amber-400 font-black flex items-center gap-1 group-hover:translate-x-0.5 transition shrink-0">
                    <span>Inspect Drill-Down</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. DETAILED AUCTION HISTORY VIEW (DRILL-DOWN ON CLICK)
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Navigation & Action Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => {
              setSelectedRoomCode(null);
              setRoomState(null);
            }}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 mb-2 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>← Back to Sessions Directory</span>
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              Conducted Auction Report
            </span>
            <span className="text-xs text-slate-300 font-mono font-bold">
              Room: {selectedRoomCode}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Official Auction Outcomes & Historical Register</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Full audit log of hammer events, winning prices, passed stars, and team-wise rosters.
          </p>
        </div>

        {/* Action Controls: Export & Live Stage */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={!roomState}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            title="Download multi-sheet Excel spreadsheet with squads, sold, and unsold players"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!roomState}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
            title="Download Final Squads CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <Link
            href={`/room/${selectedRoomCode}/arena`}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 shadow transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Live Stage</span>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs font-bold text-center">
          {errorMsg}
        </div>
      )}

      {/* Summary KPI Cards */}
      {roomState && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Auction Bought Stars</span>
            <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">
              {soldPlayers.length} Players
            </span>
            <span className="text-[10px] text-slate-500">Acquired across 10 tables</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Spent in Auction</span>
            <span className="text-xl font-black text-white font-mono mt-0.5 block">
              ₹{(totalSpentLakhs / 100).toFixed(2)} Cr
            </span>
            <span className="text-[10px] text-slate-500">Live auction expenditure</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Passed Unsold</span>
            <span className="text-xl font-black text-rose-400 font-mono mt-0.5 block">
              {unsoldPlayers.length} Stars
            </span>
            <span className="text-[10px] text-slate-500">Eligible for accelerated round</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Top Auction Pick</span>
            {soldPlayers.length > 0 ? (
              (() => {
                const top = [...soldPlayers].sort((a, b) => (b.soldAmount || 0) - (a.soldAmount || 0))[0];
                return (
                  <div>
                    <span className="text-sm font-black text-amber-400 truncate block mt-0.5">
                      {top.name} ({top.soldTo})
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold">
                      ₹{((top.soldAmount || 0) / 100).toFixed(2)} Cr
                    </span>
                  </div>
                );
              })()
            ) : (
              <span className="text-xs text-slate-500 mt-1 block">None yet</span>
            )}
          </div>
        </div>
      )}

      {/* Main Tab Controls (4 Drill-Down Views) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('CHRONO')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
              activeTab === 'CHRONO'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Complete Auctioned Log ({chronologicalLog.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('SOLD')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
              activeTab === 'SOLD'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Gavel className="w-3.5 h-3.5" />
            <span>Sold Players Register ({soldPlayers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('UNSOLD')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
              activeTab === 'UNSOLD'
                ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Unsold Register ({unsoldPlayers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('SQUADS')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
              activeTab === 'SQUADS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Team-Wise Updated Squads</span>
          </button>
        </div>

        {/* Global Search Input within Report */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search star, role, team..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>
      </div>

      {/* ---------------- TAB 1: COMPLETE CHRONOLOGICAL AUCTION LOG ---------------- */}
      {activeTab === 'CHRONO' && (
        <div className="space-y-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing sequential order of all <strong>{chronologicalLog.length}</strong> players brought to the hammer.
            </span>
          </div>

          {chronologicalLog.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
              No auction events logged in this session yet.
            </div>
          ) : (
            <div className="space-y-2">
              {chronologicalLog
                .filter((log) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    log.name.toLowerCase().includes(q) ||
                    log.role.toLowerCase().includes(q) ||
                    (log.soldTo && log.soldTo.toLowerCase().includes(q))
                  );
                })
                .map((log) => {
                  const franchise = log.soldTo ? FRANCHISES[log.soldTo] : null;
                  return (
                    <div
                      key={log.id}
                      className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-950 font-mono font-bold text-[11px] text-slate-400 flex items-center justify-center border border-slate-800 shrink-0">
                          #{log.order}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-sm">{log.name}</span>
                            {log.isOverseas && <Plane className="w-3 h-3 text-blue-400" />}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {log.role} • Base: ₹{((log.basePrice || 20) / 100).toFixed(2)} Cr
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {log.status === 'SOLD' && franchise ? (
                          <div className="flex items-center gap-2">
                            <FranchiseLogo code={franchise.code} size="xs" />
                            <span className="font-mono font-black text-sm text-emerald-400">
                              ₹{((log.soldAmount || 0) / 100).toFixed(2)} Cr
                            </span>
                            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                              SOLD
                            </span>
                          </div>
                        ) : (
                          <span className="bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            UNSOLD
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 2: SOLD PLAYERS REGISTER ---------------- */}
      {activeTab === 'SOLD' && (
        <div className="space-y-3">
          {soldPlayers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
              No players sold in this session yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {soldPlayers
                .filter((p) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(q) ||
                    p.role.toLowerCase().includes(q) ||
                    (p.soldTo && p.soldTo.toLowerCase().includes(q))
                  );
                })
                .map((p) => {
                  const franchise = p.soldTo ? FRANCHISES[p.soldTo] : null;
                  return (
                    <div
                      key={p.id}
                      className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 relative overflow-hidden"
                    >
                      {franchise && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1.5"
                          style={{ backgroundColor: franchise.primaryColor }}
                        />
                      )}
                      <div className="pl-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">{p.name}</span>
                          {franchise && (
                            <FranchiseLogo code={franchise.code} size="xs" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{p.role}</span>
                          <span>•</span>
                          <span>{p.country}</span>
                          {p.isOverseas && <Plane className="w-3 h-3 text-blue-400" />}
                        </div>
                      </div>

                      <div className="pl-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-slate-500">
                          Base: ₹{((p.basePrice || 20) / 100).toFixed(2)} Cr
                        </span>
                        <span className="font-mono font-black text-emerald-400 text-sm">
                          ₹{((p.soldAmount || 0) / 100).toFixed(2)} Cr
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 3: UNSOLD PLAYERS REGISTER ---------------- */}
      {activeTab === 'UNSOLD' && (
        <div className="space-y-3">
          {unsoldPlayers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
              No unsold players recorded in this session.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unsoldPlayers
                .filter((p) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(q) ||
                    p.role.toLowerCase().includes(q) ||
                    (p.country && p.country.toLowerCase().includes(q))
                  );
                })
                .map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm">{p.name}</span>
                        {p.isOverseas && <Plane className="w-3 h-3 text-blue-400" />}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {p.role} • {p.country} • Set: {p.set || 'Accelerated'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-rose-400 font-bold block text-xs">UNSOLD</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Base: ₹{((p.basePrice || 20) / 100).toFixed(2)} Cr
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 4: TEAM-WISE UPDATED SQUADS ---------------- */}
      {activeTab === 'SQUADS' && (
        <div className="space-y-4">
          {/* Franchise Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedFranchise('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                selectedFranchise === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              All 10 Franchises
            </button>
            {FRANCHISE_LIST.map((f) => (
              <button
                key={f.code}
                onClick={() => setSelectedFranchise(f.code)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap border ${
                  selectedFranchise === f.code
                    ? 'ring-2 text-white'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}
                style={{
                  backgroundColor: selectedFranchise === f.code ? `${f.primaryColor}30` : undefined,
                  borderColor: selectedFranchise === f.code ? f.primaryColor : undefined,
                }}
              >
                {f.code}
              </button>
            ))}
          </div>

          {/* Squad Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {FRANCHISE_LIST.filter(
              (f) => selectedFranchise === 'ALL' || selectedFranchise === f.code
            ).map((f) => {
              const teamState = roomState?.teams?.[f.code];
              const squad = teamState?.squad || [];
              const retained = squad.filter((p) => p.isRetained);

              // Merge newly bought players from team squad and room soldPlayers
              const squadBought = squad.filter((p) => !p.isRetained);
              const historyBought = soldPlayers.filter((p) => p.soldTo === f.code);
              const boughtMap = new Map<string, BoughtPlayer>();
              squadBought.forEach((p) => boughtMap.set(p.name.toLowerCase(), p));
              historyBought.forEach((p) => {
                if (!boughtMap.has(p.name.toLowerCase())) {
                  boughtMap.set(p.name.toLowerCase(), p);
                }
              });
              const bought = Array.from(boughtMap.values());
              const totalSquadCount = retained.length + bought.length;
              const totalOverseasCount = [
                ...retained.filter((p) => p.isOverseas),
                ...bought.filter((p) => p.isOverseas),
              ].length;

              return (
                <div
                  key={f.code}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between gap-3 relative overflow-hidden"
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2"
                    style={{ backgroundColor: f.primaryColor }}
                  />

                  {/* Team Header */}
                  <div className="pl-2 flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <FranchiseLogo code={f.code} size="md" className="shadow" />
                      <div>
                        <h3 className="font-black text-sm text-white">{f.name}</h3>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>Squad: <strong className="text-white">{totalSquadCount}/25</strong></span>
                          <span>•</span>
                          <span>Overseas: <strong className="text-amber-400">{totalOverseasCount}/8</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Purse Left</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">
                        {formatIndianCurrency(teamState?.remainingPurse ?? 0)}
                      </span>
                    </div>
                  </div>

                  {/* Newly Bought in Live Auction */}
                  <div className="pl-2 space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                      Newly Bought in Auction ({bought.length})
                    </span>
                    {bought.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-1">No players bought in live auction yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {bought.map((p) => (
                          <div
                            key={p.id}
                            className="bg-slate-950/70 border border-slate-800/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-200">{p.name}</span>
                              <span className="text-[9px] text-slate-500 uppercase">({p.role})</span>
                              {p.isOverseas && <Plane className="w-3 h-3 text-blue-400" />}
                            </div>
                            <span className="font-mono font-black text-emerald-400 text-xs">
                              ₹{((p.soldAmount || 0) / 100).toFixed(2)} Cr
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pre-Retained Stars */}
                  <div className="pl-2 space-y-1.5 pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block">
                      Pre-Retained Stars ({retained.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {retained.map((p) => (
                        <span
                          key={p.id}
                          className="bg-slate-950 px-2 py-0.5 rounded text-[10px] text-slate-300 border border-slate-800 font-medium"
                        >
                          {p.name} <span className="text-slate-500">({p.role})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
