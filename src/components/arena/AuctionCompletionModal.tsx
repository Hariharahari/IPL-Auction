'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Trophy,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Shield,
  Plane,
  Sparkles,
  Users,
  Coins,
} from 'lucide-react';
import { AuctionRoomState, BoughtPlayer, FranchiseCode } from '@/types/auction';
import { FRANCHISES, FRANCHISE_LIST } from '@/data/franchises';
import { FranchiseLogo } from '@/components/common/FranchiseLogo';
import { formatIndianCurrency } from '@/lib/utils';

interface AuctionCompletionModalProps {
  isOpen: boolean;
  room: AuctionRoomState | null;
  franchiseCode: FranchiseCode | null;
  userName: string;
  isAuctioneer: boolean;
  onViewReport: () => void;
  onExitDashboard: () => void;
}

export const AuctionCompletionModal: React.FC<AuctionCompletionModalProps> = ({
  isOpen,
  room,
  franchiseCode,
  userName,
  isAuctioneer,
  onViewReport,
  onExitDashboard,
}) => {
  const [hasDownloaded, setHasDownloaded] = useState(false);

  if (!isOpen || !room) return null;

  const team = franchiseCode ? FRANCHISES[franchiseCode] : null;
  const teamState = franchiseCode ? room.teams?.[franchiseCode] : null;

  // Derive squad players for this franchise
  const rawSquad = teamState?.squad || [];
  const isRetainedStar = (p: { isRetained?: boolean; set?: string; id?: string }) =>
    p.isRetained === true || p.set === 'Retained' || p.id?.startsWith('ret_');

  const retainedPlayers = rawSquad.filter(isRetainedStar);

  // Combine live bought players from team squad and room soldHistory
  const squadBought = rawSquad.filter((p) => !isRetainedStar(p));
  const historyBought = (room.soldHistory || []).filter((p) => {
    if (isRetainedStar(p)) return false;
    const s = (p.soldTo || '').toString().trim().toUpperCase();
    return s === franchiseCode || (team && s === team.name.toUpperCase());
  });

  const boughtMap = new Map<string, BoughtPlayer>();
  squadBought.forEach((p) => boughtMap.set(p.name.trim().toLowerCase(), p));
  historyBought.forEach((p) => {
    if (!boughtMap.has(p.name.trim().toLowerCase())) {
      boughtMap.set(p.name.trim().toLowerCase(), p);
    }
  });

  const boughtPlayers = Array.from(boughtMap.values());
  const fullSquad = [...retainedPlayers, ...boughtPlayers];
  const overseasCount = fullSquad.filter((p) => p.isOverseas).length;
  const remainingPurse = teamState?.remainingPurse ?? 0;

  // Excel Export Handler
  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();

    if (franchiseCode && team) {
      // 1. Specific Franchise Official Squad Sheet
      const squadRows = fullSquad.map((p, idx) => ({
        '#': idx + 1,
        'Player Name': p.name,
        Role: p.role,
        Country: p.country,
        Overseas: p.isOverseas ? 'Yes' : 'No',
        'Acquisition Type': isRetainedStar(p) ? 'Pre-Retained' : 'Live Auction Buy',
        'Price (₹ Cr)': ((p.soldAmount || p.basePrice || 0) / 100).toFixed(2),
        'Price (Lakhs)': p.soldAmount || p.basePrice || 0,
      }));

      const summaryRows = [
        { Metric: 'Franchise Name', Value: team.name },
        { Metric: 'Franchise Code', Value: team.code },
        { Metric: 'Total Squad Size', Value: `${fullSquad.length} / 25` },
        { Metric: 'Overseas Players', Value: `${overseasCount} / 8` },
        { Metric: 'Remaining Purse', Value: formatIndianCurrency(remainingPurse) },
        { Metric: 'Newly Bought in Auction', Value: boughtPlayers.length },
        { Metric: 'Pre-Retained Stars', Value: retainedPlayers.length },
      ];

      const wsSquad = XLSX.utils.json_to_sheet(squadRows);
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

      XLSX.utils.book_append_sheet(wb, wsSquad, `${team.code}_Final_Squad`);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Team_Summary');
    }

    // 2. All 10 Franchises Overview Sheet
    const allSquadRows: Array<Record<string, unknown>> = [];
    FRANCHISE_LIST.forEach((f) => {
      const tState = room.teams?.[f.code];
      const tSquad = tState?.squad || [];
      const tRetained = tSquad.filter(isRetainedStar);
      const tBought = tSquad.filter((p) => !isRetainedStar(p));
      const tHistoryBought = (room.soldHistory || []).filter((p) => {
        if (isRetainedStar(p)) return false;
        const s = (p.soldTo || '').toString().trim().toUpperCase();
        return s === f.code || s === f.name.toUpperCase();
      });

      const tBoughtMap = new Map<string, BoughtPlayer>();
      tBought.forEach((p) => tBoughtMap.set(p.name.trim().toLowerCase(), p));
      tHistoryBought.forEach((p) => {
        if (!tBoughtMap.has(p.name.trim().toLowerCase())) {
          tBoughtMap.set(p.name.trim().toLowerCase(), p);
        }
      });

      const tAll = [...tRetained, ...Array.from(tBoughtMap.values())];
      tAll.forEach((p, idx) => {
        allSquadRows.push({
          Franchise: f.name,
          Code: f.code,
          '#': idx + 1,
          'Player Name': p.name,
          Role: p.role,
          Country: p.country,
          Overseas: p.isOverseas ? 'Yes' : 'No',
          Acquisition: isRetainedStar(p) ? 'Pre-Retained' : 'Auction Bought',
          'Price (₹ Cr)': ((p.soldAmount || p.basePrice || 0) / 100).toFixed(2),
        });
      });
    });

    const wsAll = XLSX.utils.json_to_sheet(allSquadRows);
    XLSX.utils.book_append_sheet(wb, wsAll, 'All_10_Franchise_Squads');

    const fileName = franchiseCode
      ? `IPL_2027_${franchiseCode}_Final_Squad_${room.roomCode || 'AUCTION'}.xlsx`
      : `IPL_2027_All_Squads_${room.roomCode || 'AUCTION'}.xlsx`;

    XLSX.writeFile(wb, fileName);
    setHasDownloaded(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        {/* Top Gold Gradient Bar */}
        <div className="h-2.5 w-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600" />

        {/* Modal Body */}
        <div className="p-6 sm:p-8 flex flex-col items-center text-center">
          {/* Trophy Avatar with Pulsing Halo */}
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-amber-400/10 to-amber-500/30 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/20">
              <Trophy className="w-10 h-10 animate-bounce" />
            </div>
            <div className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 p-1 rounded-full shadow-lg">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Thank You & Congratulatory Headline */}
          <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full mb-2">
            Official Auction Concluded
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Thanks for Your Participation!
          </h2>
          <p className="text-sm text-slate-300 max-w-md leading-relaxed mb-6">
            Thank you, <strong className="text-amber-400">{userName}</strong>! The IPL 2027 live auction has officially concluded. All squad rosters and purse transactions are now locked.
          </p>

          {/* Team Squad Snapshot Card (If Franchise Member) */}
          {franchiseCode && team && (
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6 text-left relative overflow-hidden">
              <div
                className="absolute left-0 top-0 bottom-0 w-2"
                style={{ backgroundColor: team.primaryColor }}
              />

              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3 pl-2">
                <div className="flex items-center gap-3">
                  <FranchiseLogo code={franchiseCode} size="md" className="shadow" />
                  <div>
                    <h3 className="font-black text-white text-base leading-tight">{team.name}</h3>
                    <p className="text-[11px] text-slate-400">Official 2027 Squad Summary</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Remaining Purse</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    {formatIndianCurrency(remainingPurse)}
                  </span>
                </div>
              </div>

              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-center pl-2">
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Total Squad</span>
                  <strong className="text-sm font-black text-white">{fullSquad.length} / 25</strong>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Overseas</span>
                  <strong className="text-sm font-black text-blue-400">{overseasCount} / 8</strong>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Newly Bought</span>
                  <strong className="text-sm font-black text-emerald-400">{boughtPlayers.length} Stars</strong>
                </div>
              </div>
            </div>
          )}

          {/* Non-Franchise / Auctioneer Snapshot */}
          {(!franchiseCode || isAuctioneer) && (
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6 grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Total Sold</span>
                <strong className="text-sm font-black text-emerald-400">
                  {(room.soldHistory || []).filter((p) => !isRetainedStar(p)).length} Stars
                </strong>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Unsold</span>
                <strong className="text-sm font-black text-rose-400">
                  {(room.unsoldHistory || []).length} Stars
                </strong>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Room Code</span>
                <strong className="text-sm font-mono font-black text-amber-400">
                  {room.roomCode || 'LIVE'}
                </strong>
              </div>
            </div>
          )}

          {/* Primary Action Button: Download Latest Squad as Excel */}
          <div className="w-full space-y-3">
            <button
              onClick={handleDownloadExcel}
              className={`w-full py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2.5 transition shadow-lg cursor-pointer ${
                hasDownloaded
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 shadow-amber-500/30'
              }`}
            >
              {hasDownloaded ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-white" />
                  <span>Squad Spreadsheet Downloaded (.xlsx)</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>
                    {franchiseCode
                      ? `Download ${franchiseCode} Latest Squad (Excel)`
                      : 'Download All 10 Franchise Squads (Excel)'}
                  </span>
                  <Download className="w-4 h-4 ml-0.5" />
                </>
              )}
            </button>

            {/* Secondary Navigation Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={onViewReport}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Full Reports</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={onExitDashboard}
                className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white text-xs font-bold border border-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Exit to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
