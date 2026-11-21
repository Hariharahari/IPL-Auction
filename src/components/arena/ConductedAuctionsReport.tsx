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
} from 'lucide-react';
import { FRANCHISES, FRANCHISE_LIST } from '@/data/franchises';
import { AuctionRoomState, BoughtPlayer, FranchiseCode, Player } from '@/types/auction';
import { formatIndianCurrency } from '@/lib/utils';
import Link from 'next/link';

interface ConductedAuctionsReportProps {
  initialRoomCode?: string;
}

export const ConductedAuctionsReport: React.FC<ConductedAuctionsReportProps> = ({
  initialRoomCode,
}) => {
  const [roomCode, setRoomCode] = useState<string>(
    initialRoomCode?.toUpperCase() ||
      (typeof window !== 'undefined' ? localStorage.getItem('ipl_active_room_code') || 'GLZ8PJ' : 'GLZ8PJ')
  );
  const [inputCode, setInputCode] = useState<string>(roomCode);
  const [roomState, setRoomState] = useState<AuctionRoomState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'SQUADS' | 'SOLD' | 'UNSOLD'>('SQUADS');
  const [selectedFranchise, setSelectedFranchise] = useState<FranchiseCode | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessions, setSessions] = useState<Array<{
    roomCode: string;
    status: string;
    phase: string;
    soldCount: number;
    unsoldCount: number;
    totalSpentLakhs: number;
    totalPlayers: number;
    lastActionMessage: string;
    updatedAt: number;
    createdAt: number;
  }>>([]);
  const [showSessionsDirectory, setShowSessionsDirectory] = useState(false);

  const fetchSessionsList = async () => {
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      }
    } catch (e) {
      console.warn('Failed to fetch rooms list', e);
    }
  };

  useEffect(() => {
    fetchSessionsList();
  }, []);

  const fetchRoomReport = async (code: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/room/${code.trim().toUpperCase()}`);
      const data = await res.json();
      if (data.success && data.room) {
        setRoomState(data.room);
        setRoomCode(code.trim().toUpperCase());
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
    if (roomCode) {
      fetchRoomReport(roomCode);
    }
  }, [roomCode]);

  const handleSearchRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      fetchRoomReport(inputCode.trim().toUpperCase());
    }
  };

  // Compute sold and unsold players
  const soldPlayers = useMemo(() => {
    if (!roomState) return [];
    // Combine soldHistory and any bought players in squads
    const map = new Map<string, BoughtPlayer>();
    (roomState.soldHistory || []).forEach((p) => map.set(p.name.toLowerCase().trim(), p));
    Object.values(roomState.teams || {}).forEach((t) => {
      t.squad.forEach((p) => {
        if (!p.isRetained) {
          map.set(p.name.toLowerCase().trim(), p);
        }
      });
    });
    return Array.from(map.values());
  }, [roomState]);

  const unsoldPlayers = useMemo(() => {
    if (!roomState) return [];
    return roomState.unsoldHistory || [];
  }, [roomState]);

  const totalSpentLakhs = useMemo(() => {
    return soldPlayers.reduce((acc, p) => acc + (p.soldAmount || 0), 0);
  }, [soldPlayers]);

  const topBuy = useMemo(() => {
    if (soldPlayers.length === 0) return null;
    return [...soldPlayers].sort((a, b) => (b.soldAmount || 0) - (a.soldAmount || 0))[0];
  }, [soldPlayers]);

  // Excel (.xlsx) Multi-Sheet Export
  const handleExportExcel = () => {
    if (!roomState) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Final Franchise Squads
    const allSquadRows: Array<Record<string, unknown>> = [];
    FRANCHISE_LIST.forEach((f) => {
      const team = roomState.teams[f.code];
      if (team) {
        team.squad.forEach((p) => {
          allSquadRows.push({
            Franchise: f.code,
            FranchiseName: f.name,
            PlayerName: p.name,
            Role: p.role,
            Country: p.country,
            IsOverseas: p.isOverseas ? 'Yes' : 'No',
            AcquisitionType: p.isRetained ? 'Retained' : 'Auction Bought',
            Price_Lakhs: p.soldAmount || p.basePrice || 0,
            Price_Cr: ((p.soldAmount || p.basePrice || 0) / 100).toFixed(2),
          });
        });
      }
    });
    const wsSquads = XLSX.utils.json_to_sheet(allSquadRows);
    XLSX.utils.book_append_sheet(wb, wsSquads, 'FinalSquads');

    // Sheet 2: Sold Players Log
    const soldRows = soldPlayers.map((p) => ({
      PlayerName: p.name,
      BoughtBy: p.soldTo || 'UNKNOWN',
      Role: p.role,
      Country: p.country,
      IsOverseas: p.isOverseas ? 'Yes' : 'No',
      BasePrice_Cr: ((p.basePrice || 0) / 100).toFixed(2),
      SoldPrice_Cr: ((p.soldAmount || 0) / 100).toFixed(2),
      SoldPrice_Lakhs: p.soldAmount || 0,
    }));
    const wsSold = XLSX.utils.json_to_sheet(soldRows);
    XLSX.utils.book_append_sheet(wb, wsSold, 'SoldPlayers');

    // Sheet 3: Unsold Players
    const unsoldRows = unsoldPlayers.map((p) => ({
      PlayerName: p.name,
      Role: p.role,
      Country: p.country,
      IsOverseas: p.isOverseas ? 'Yes' : 'No',
      BasePrice_Cr: ((p.basePrice || 0) / 100).toFixed(2),
      Set: p.set || 'General',
    }));
    const wsUnsold = XLSX.utils.json_to_sheet(unsoldRows);
    XLSX.utils.book_append_sheet(wb, wsUnsold, 'UnsoldPlayers');

    // Sheet 4: Franchise Finances & Summary
    const financeRows = FRANCHISE_LIST.map((f) => {
      const team = roomState.teams[f.code];
      const spent = team ? team.squad.reduce((sum, p) => sum + (p.soldAmount || 0), 0) : 0;
      return {
        Franchise: f.code,
        FranchiseName: f.name,
        TotalSquadSize: team ? team.squad.length : 0,
        OverseasCount: team ? team.overseasCount : 0,
        TotalSpent_Cr: (spent / 100).toFixed(2),
        RemainingPurse_Cr: team ? (team.remainingPurse / 100).toFixed(2) : '0.00',
        VacantSlots: team ? Math.max(0, 25 - team.squad.length) : 25,
      };
    });
    const wsFinances = XLSX.utils.json_to_sheet(financeRows);
    XLSX.utils.book_append_sheet(wb, wsFinances, 'FranchiseFinancials');

    // Trigger Browser Download
    XLSX.writeFile(wb, `IPL_2027_Auction_Report_${roomCode}.xlsx`);
  };

  // CSV Export for Quick Viewing
  const handleExportCSV = () => {
    if (!roomState) return;

    let csv = 'Franchise,PlayerName,Role,Country,IsOverseas,Type,Price_Cr\n';
    FRANCHISE_LIST.forEach((f) => {
      const team = roomState.teams[f.code];
      if (team) {
        team.squad.forEach((p) => {
          const priceCr = ((p.soldAmount || p.basePrice || 0) / 100).toFixed(2);
          csv += `"${f.code}","${p.name}","${p.role}","${p.country}","${p.isOverseas ? 'Yes' : 'No'}","${
            p.isRetained ? 'Retained' : 'Bought'
          }","${priceCr}"\n`;
        });
      }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `IPL_2027_Final_Squads_${roomCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner & Room Switcher */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              Conducted Auctions &amp; Reports
            </span>
            <span className="text-xs text-slate-400 font-mono">Room: {roomCode}</span>
          </div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Official Auction Outcomes &amp; Final Squads</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Download full reports of sold, unsold, and newly acquired stars for all 10 franchises.
          </p>
        </div>

        {/* Room Search & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowSessionsDirectory(!showSessionsDirectory)}
            className={`text-xs font-black px-3.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition cursor-pointer ${
              showSessionsDirectory
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 hover:bg-slate-800 text-amber-400 border-amber-500/40'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Sessions ({sessions.length})</span>
          </button>

          <form onSubmit={handleSearchRoom} className="flex items-center gap-1.5">
            <input
              type="text"
              maxLength={6}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Room Code (e.g. GLZ8PJ)"
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-400 uppercase w-28 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 transition cursor-pointer"
            >
              Load
            </button>
          </form>

          <button
            onClick={() => fetchRoomReport(roomCode)}
            disabled={isLoading}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1 transition cursor-pointer"
            title="Refresh Report"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Download Buttons */}
          <button
            onClick={handleExportExcel}
            disabled={!roomState}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            title="Download multi-sheet Excel spreadsheet with squads, sold, and unsold players"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!roomState}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
            title="Download Final Squads CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <Link
            href={`/room/${roomCode}/arena`}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shadow transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Live Stage</span>
          </Link>
        </div>
      </div>

      {/* SESSIONS DIRECTORY BROWSER */}
      {showSessionsDirectory && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-2xl animate-in fade-in space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>All Auction Sessions Directory</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any session below to view its complete auction summary, sold stars, unsold pool, and franchise squads.
              </p>
            </div>
            <button
              onClick={() => setShowSessionsDirectory(false)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              Close Directory
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessions.length === 0 ? (
              <div className="col-span-full p-6 text-center text-slate-500 italic bg-slate-950/60 rounded-xl">
                No past sessions recorded yet. Create or conduct an auction to see it listed here!
              </div>
            ) : (
              sessions.map((s) => {
                const isCurrent = s.roomCode === roomCode;
                return (
                  <div
                    key={s.roomCode}
                    onClick={() => {
                      fetchRoomReport(s.roomCode);
                      setShowSessionsDirectory(false);
                    }}
                    className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 cursor-pointer group ${
                      isCurrent
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="font-mono text-base font-black text-amber-400 tracking-wider">
                          {s.roomCode}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                        s.status === 'COMPLETED'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-blue-950 text-blue-400 border border-blue-800'
                      }`}>
                        {s.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 text-center bg-slate-900/60 rounded-lg p-2 border border-slate-800/80">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Sold</span>
                        <span className="text-xs font-black text-emerald-400">{s.soldCount}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Unsold</span>
                        <span className="text-xs font-black text-rose-400">{s.unsoldCount}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Spent</span>
                        <span className="text-xs font-black text-white font-mono">
                          ₹{(s.totalSpentLakhs / 100).toFixed(1)} Cr
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span className="truncate max-w-[180px]">{s.lastActionMessage}</span>
                      <span className="text-amber-400 group-hover:underline font-bold shrink-0">
                        Inspect →
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

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
            <span className="text-sm font-black text-amber-400 truncate block mt-1">
              {topBuy ? `${topBuy.name} (${topBuy.soldTo})` : 'None yet'}
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">
              {topBuy ? `₹${((topBuy.soldAmount || 0) / 100).toFixed(2)} Cr` : '--'}
            </span>
          </div>
        </div>
      )}

      {/* Navigation Tabs (Squads vs Sold vs Unsold) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('SQUADS')}
            className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SQUADS'
                ? 'bg-amber-500 text-slate-950 shadow font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Final Franchise Squads</span>
          </button>

          <button
            onClick={() => setActiveTab('SOLD')}
            className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SOLD'
                ? 'bg-amber-500 text-slate-950 shadow font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gavel className="w-3.5 h-3.5" />
            <span>Sold Players Log ({soldPlayers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('UNSOLD')}
            className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'UNSOLD'
                ? 'bg-amber-500 text-slate-950 shadow font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Unsold Register ({unsoldPlayers.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search star, role, team..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* TAB 1: FINAL FRANCHISE SQUADS */}
      {activeTab === 'SQUADS' && roomState && (
        <div className="space-y-4">
          {/* Franchise Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedFranchise('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedFranchise === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              All 10 Franchises
            </button>
            {FRANCHISE_LIST.map((f) => (
              <button
                key={f.code}
                onClick={() => setSelectedFranchise(f.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition border cursor-pointer ${
                  selectedFranchise === f.code
                    ? 'ring-2 text-white'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
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

          {/* Franchise Squad Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FRANCHISE_LIST.filter(
              (f) => selectedFranchise === 'ALL' || selectedFranchise === f.code
            ).map((f) => {
              const team = roomState.teams[f.code];
              if (!team) return null;

              const newlyBought = team.squad.filter((p) => !p.isRetained);
              const retained = team.squad.filter((p) => p.isRetained);

              const q = searchQuery.toLowerCase().trim();
              const visibleBought = newlyBought.filter(
                (p) => !q || p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)
              );
              const visibleRetained = retained.filter(
                (p) => !q || p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)
              );

              return (
                <div
                  key={f.code}
                  className="bg-slate-900/90 border rounded-2xl p-4 shadow-xl flex flex-col justify-between"
                  style={{ borderColor: `${f.primaryColor}55` }}
                >
                  <div>
                    {/* Team Header */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow"
                          style={{ backgroundColor: f.primaryColor, color: f.textColor }}
                        >
                          {f.code}
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-white">{f.name}</h4>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Squad: <strong className="text-white">{team.squad.length}/25</strong> • Overseas:{' '}
                            <strong className="text-amber-400">{team.overseasCount}/8</strong>
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Purse Left</span>
                        <span className="font-mono font-black text-emerald-400 text-sm">
                          {formatIndianCurrency(team.remainingPurse)}
                        </span>
                      </div>
                    </div>

                    {/* Newly Bought Stars in Auction */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[11px] font-black uppercase text-emerald-400 mb-1.5">
                        <span className="flex items-center gap-1">
                          <Gavel className="w-3 h-3" />
                          <span>Newly Bought in Auction ({newlyBought.length})</span>
                        </span>
                      </div>

                      {visibleBought.length === 0 ? (
                        <div className="p-3 bg-slate-950/60 rounded-xl text-center text-slate-500 text-xs italic">
                          No players bought in live auction yet.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {visibleBought.map((p) => (
                            <div
                              key={p.id}
                              className="bg-slate-950 border border-emerald-950/60 rounded-lg p-2 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                                  {p.role}
                                </span>
                                <span className="font-bold text-white truncate">{p.name}</span>
                                {p.isOverseas && (
                                  <span className="text-[9px] text-blue-400 flex items-center gap-0.5">
                                    <Plane className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-black text-emerald-400 text-xs shrink-0">
                                {formatIndianCurrency(p.soldAmount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pre-Retained Stars */}
                    <div>
                      <div className="text-[11px] font-black uppercase text-blue-400 mb-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Pre-Retained Stars ({retained.length})</span>
                      </div>

                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {visibleRetained.map((p) => (
                          <div
                            key={p.id}
                            className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-1.5 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-slate-400 text-[9px] font-bold uppercase">{p.role}</span>
                              <span className="text-slate-300 truncate font-medium">{p.name}</span>
                              {p.isOverseas && <Plane className="w-2.5 h-2.5 text-blue-400" />}
                            </div>
                            <span className="font-mono text-slate-400 text-[11px] shrink-0">
                              {formatIndianCurrency(p.soldAmount || p.basePrice)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: SOLD PLAYERS REGISTER */}
      {activeTab === 'SOLD' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-sm text-white">All Sold Players in Live Auction</h3>
            <span className="text-xs text-slate-400">Total: {soldPlayers.length} Stars</span>
          </div>

          {soldPlayers.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs italic">
              No players have been sold under the hammer yet in this session.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Player Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Country</th>
                    <th className="p-3">Winning Franchise</th>
                    <th className="p-3 text-right">Base Price</th>
                    <th className="p-3 text-right">Sold Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {soldPlayers
                    .filter(
                      (p) =>
                        !searchQuery ||
                        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (p.soldTo && p.soldTo.toLowerCase().includes(searchQuery.toLowerCase()))
                    )
                    .map((p, idx) => {
                      const team = p.soldTo ? FRANCHISES[p.soldTo] : null;

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-bold text-white flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {p.isOverseas && <Plane className="w-3 h-3 text-blue-400" />}
                          </td>
                          <td className="p-3">
                            <span className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {p.role}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400">{p.country}</td>
                          <td className="p-3">
                            {team ? (
                              <span
                                className="font-bold text-xs px-2 py-0.5 rounded shadow inline-flex items-center gap-1"
                                style={{ backgroundColor: `${team.primaryColor}25`, color: team.primaryColor }}
                              >
                                {team.code} - {team.shortName}
                              </span>
                            ) : (
                              '--'
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-400">
                            {formatIndianCurrency(p.basePrice)}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-emerald-400 text-sm">
                            {formatIndianCurrency(p.soldAmount)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: UNSOLD PLAYERS REGISTER */}
      {activeTab === 'UNSOLD' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-sm text-white">Unsold Players Register</h3>
            <span className="text-xs text-slate-400">Total: {unsoldPlayers.length} Stars</span>
          </div>

          {unsoldPlayers.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs italic">
              No players are currently recorded as unsold for this auction session.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Player Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Country</th>
                    <th className="p-3">Set</th>
                    <th className="p-3 text-right">Base Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {unsoldPlayers
                    .filter(
                      (p) =>
                        !searchQuery ||
                        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.role.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-3 font-bold text-white flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {p.isOverseas && <Plane className="w-3 h-3 text-blue-400" />}
                        </td>
                        <td className="p-3">
                          <span className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {p.role}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{p.country}</td>
                        <td className="p-3 text-slate-400">{p.set || 'General'}</td>
                        <td className="p-3 text-right font-mono font-bold text-rose-400">
                          {formatIndianCurrency(p.basePrice)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
