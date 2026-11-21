'use client';

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FranchiseCode, Player, PlayerRole } from '@/types/auction';
import { FRANCHISE_LIST } from '@/data/franchises';
import { formatIndianCurrency, getStoredUser } from '@/lib/utils';

export type UploadTarget = 'RETAINED_SQUADS' | 'AUCTION_POOL';

interface PlayerPoolUploaderProps {
  initialTarget?: UploadTarget;
  onClose?: () => void;
  roomCode?: string;
}

export const PlayerPoolUploader: React.FC<PlayerPoolUploaderProps> = ({
  initialTarget = 'RETAINED_SQUADS',
  onClose,
  roomCode: propRoomCode,
}) => {
  const {
    roomCode: storeRoomCode,
    uploadPlayerPool,
    uploadRetainedSquads,
    createRoom,
    initSocket,
  } = useAuctionStore();

  const [activeTarget, setActiveTarget] = useState<UploadTarget>(initialTarget);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [parsedPoolPlayers, setParsedPoolPlayers] = useState<Array<Omit<Player, 'id' | 'status'>>>([]);
  const [parsedRetainedPlayers, setParsedRetainedPlayers] = useState<
    Array<{
      name: string;
      team: FranchiseCode;
      role: PlayerRole;
      country: string;
      isOverseas: boolean;
      price?: number;
      imageUrl?: string;
      statsSummary?: string;
      remainingPurse?: number;
    }>
  >([]);

  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'APPEND' | 'REPLACE'>('APPEND');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Normalize Role to 'BAT' | 'BOWL' | 'AR' | 'WK'
  const normalizeRole = (val: unknown): PlayerRole => {
    const str = String(val || '').trim().toUpperCase();
    if (str.includes('WK') || str.includes('KEEP') || str.includes('WICKET')) return 'WK';
    if (str.includes('ALL') || str === 'AR') return 'AR';
    if (str.includes('BOWL')) return 'BOWL';
    return 'BAT';
  };

  // Normalize Price to Lakhs
  const normalizePrice = (val: unknown, defaultVal = 0): number => {
    if (typeof val === 'number') {
      if (val > 0 && val <= 30) return Math.round(val * 100); // e.g. 18.0 -> 1800L
      return Math.round(val);
    }
    const cleanStr = String(val || '')
      .replace(/[₹,cr,lakh,lakhs,l]/gi, '')
      .trim();
    const num = parseFloat(cleanStr);
    if (isNaN(num)) return defaultVal;
    if (String(val).toLowerCase().includes('cr') || (num > 0 && num <= 30)) {
      return Math.round(num * 100);
    }
    return Math.round(num);
  };

  // Normalize Overseas boolean
  const normalizeOverseas = (val: unknown, country: string): boolean => {
    if (typeof val === 'boolean') return val;
    const str = String(val || '').trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(str)) return true;
    if (['false', 'no', 'n', '0'].includes(str)) return false;
    return country.trim().toLowerCase() !== 'india';
  };

  // Normalize Franchise Code
  const normalizeFranchise = (val: unknown): FranchiseCode | null => {
    const str = String(val || '').trim().toUpperCase();
    const found = FRANCHISE_LIST.find(
      (f) =>
        f.code === str ||
        f.name.toUpperCase().includes(str) ||
        f.shortName.toUpperCase() === str
    );
    return found ? found.code : null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        if (!buffer) throw new Error('File could not be read');

        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetNames = workbook.SheetNames;

        // Auto-select matching sheet or default to first sheet
        let selectedSheetName = sheetNames[0];
        if (activeTarget === 'RETAINED_SQUADS') {
          const match = sheetNames.find(
            (s) => s.toLowerCase().includes('retained') || s.toLowerCase().includes('squad')
          );
          if (match) selectedSheetName = match;
        } else {
          const match = sheetNames.find(
            (s) => s.toLowerCase().includes('pool') || s.toLowerCase().includes('auction') || s.toLowerCase().includes('player')
          );
          if (match) selectedSheetName = match;
        }

        const sheet = workbook.Sheets[selectedSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        if (!rows || rows.length === 0) {
          throw new Error('The uploaded spreadsheet contains no data rows.');
        }

        const keysOfRow = (row: Record<string, unknown>) => Object.keys(row);
        const findVal = (row: Record<string, unknown>, variants: string[]) => {
          const keys = keysOfRow(row);
          const foundKey = keys.find((k) =>
            variants.some((v) => k.trim().toLowerCase() === v.toLowerCase())
          );
          return foundKey ? row[foundKey] : undefined;
        };

        if (activeTarget === 'RETAINED_SQUADS') {
          const validRetained: typeof parsedRetainedPlayers = [];

          for (const row of rows) {
            const name = String(findVal(row, ['Name', 'Player', 'Player Name', 'PlayerName']) || '').trim();
            if (!name) continue;

            const teamRaw = findVal(row, ['Team', 'Franchise', 'PreviousTeam', 'Club']);
            const team = normalizeFranchise(teamRaw);
            if (!team) continue;

            const country = String(findVal(row, ['Country', 'Nationality']) || 'India').trim();
            const role = normalizeRole(findVal(row, ['Role', 'Specialization', 'Player Role']));
            const isOverseas = normalizeOverseas(findVal(row, ['IsOverseas', 'Overseas', 'Foreign']), country);

            // Handle Price (Lakhs) vs Price_Cr (Crores)
            const priceLakhsRaw = findVal(row, ['Price', 'RetentionPrice', 'Fee', 'BasePrice']);
            const priceCrRaw = findVal(row, ['Price_Cr', 'PriceCr', 'Price (Cr)', 'Fee_Cr']);

            let price = 0;
            if (priceLakhsRaw !== undefined && priceLakhsRaw !== '') {
              price = normalizePrice(priceLakhsRaw, 0);
            } else if (priceCrRaw !== undefined && priceCrRaw !== '') {
              const crVal = parseFloat(String(priceCrRaw).replace(/[^0-9.]/g, ''));
              price = isNaN(crVal) ? 0 : Math.round(crVal * 100);
            }

            const imageUrl = String(findVal(row, ['ImageUrl', 'Image', 'Photo', 'Avatar']) || '').trim() || undefined;
            const remainingPurseRaw = findVal(row, ['RemainingPurse', 'PurseLeft', 'Purse']);
            const remainingPurse = remainingPurseRaw !== undefined ? normalizePrice(remainingPurseRaw) : undefined;
            const statsSummary = String(
              findVal(row, ['StatsSummary', 'Stats', 'Summary']) || `Retained by ${team} • ${role}`
            ).trim();

            validRetained.push({
              name,
              team,
              role,
              country,
              isOverseas,
              price,
              imageUrl,
              statsSummary,
              remainingPurse,
            });
          }

          if (validRetained.length === 0) {
            throw new Error('No valid retained players found. Please ensure the "Team" column specifies a valid franchise (CSK, MI, RCB, etc.).');
          }

          setParsedRetainedPlayers(validRetained);
          setParsedPoolPlayers([]);
        } else {
          const validPool: Array<Omit<Player, 'id' | 'status'>> = [];

          for (const row of rows) {
            const name = String(findVal(row, ['Name', 'Player', 'Player Name', 'PlayerName']) || '').trim();
            if (!name) continue;

            const country = String(findVal(row, ['Country', 'Nationality']) || 'India').trim();
            const role = normalizeRole(findVal(row, ['Role', 'Specialization', 'Player Role']));
            const isOverseas = normalizeOverseas(findVal(row, ['IsOverseas', 'Overseas', 'Foreign']), country);
            const basePrice = normalizePrice(findVal(row, ['BasePrice', 'Base Price', 'Base_Price', 'Price']), 100);
            const set = String(findVal(row, ['Set', 'Pool', 'Category', 'Player Set']) || 'Accelerated').trim();
            const prevTeamRaw = findVal(row, ['PreviousTeam', 'Previous Team', 'Prev Team', 'RTM Team']);
            const prevTeam = prevTeamRaw ? normalizeFranchise(prevTeamRaw) : null;
            const imageUrl = String(findVal(row, ['ImageUrl', 'Image', 'Photo', 'Avatar']) || '').trim() || undefined;
            const statsSummary = String(
              findVal(row, ['StatsSummary', 'Stats', 'Summary', 'Record']) || `${role} • ${country}`
            ).trim();

            validPool.push({
              name,
              role,
              country,
              isOverseas,
              basePrice,
              set,
              previousTeam: prevTeam || null,
              statsSummary,
              isCustom: true,
              imageUrl,
            });
          }

          if (validPool.length === 0) {
            throw new Error('Could not parse any valid players. Please verify the column headers (Name, Role, Country, BasePrice).');
          }

          setParsedPoolPlayers(validPool);
          setParsedRetainedPlayers([]);
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to parse file');
        setParsedPoolPlayers([]);
        setParsedRetainedPlayers([]);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const ensureActiveRoom = async (): Promise<boolean> => {
    let targetCode: string | null = propRoomCode || storeRoomCode;
    if (!targetCode && typeof window !== 'undefined') {
      targetCode = localStorage.getItem('ipl_active_room_code') || null;
    }

    if (targetCode) {
      initSocket(targetCode);
      return true;
    }

    // Auto-create room if uploaded from Home without an existing room
    const user = getStoredUser();
    const hostName = user.userName || 'Auctioneer';
    const res = await createRoom(hostName);
    if (res.success && res.roomCode) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ipl_active_room_code', res.roomCode);
      }
      initSocket(res.roomCode);
      return true;
    }
    return false;
  };

  const handleCommitUpload = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    const user = getStoredUser();
    const payload = {
      target: activeTarget,
      mode: uploadMode,
      players: activeTarget === 'RETAINED_SQUADS' ? parsedRetainedPlayers : parsedPoolPlayers,
      adminEmail: user.userEmail || undefined,
    };

    try {
      // 1. Independent Server Global Upload (saves to server main catalog)
      const res = await fetch('/api/global/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Server upload failed');
      }

      // 2. If room is active, also propagate to current room socket silently
      const targetRoom = propRoomCode || storeRoomCode;
      if (targetRoom) {
        try {
          if (activeTarget === 'RETAINED_SQUADS') {
            await uploadRetainedSquads(parsedRetainedPlayers, uploadMode);
          } else {
            await uploadPlayerPool(parsedPoolPlayers, uploadMode);
          }
        } catch (socketSyncErr) {
          console.warn('Socket room sync skipped:', socketSyncErr);
        }
      }

      setIsProcessing(false);
      setSuccessMsg(
        `✅ Server main catalog updated! ${parsedCount} ${
          activeTarget === 'RETAINED_SQUADS' ? 'Current Squad stars' : 'Auction Pool players'
        } saved to server (${uploadMode === 'REPLACE' ? 'Replaced' : 'Appended'}).`
      );
      setParsedRetainedPlayers([]);
      setParsedPoolPlayers([]);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (err: unknown) {
      setIsProcessing(false);
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleDownloadTemplate = (target: UploadTarget) => {
    const link = document.createElement('a');
    if (target === 'RETAINED_SQUADS') {
      link.href = '/ipl_2027_retained_players.csv';
      link.setAttribute('download', 'ipl_2027_retained_players.csv');
    } else {
      link.href = '/ipl_2027_auction_pool.csv';
      link.setAttribute('download', 'ipl_2027_auction_pool.csv');
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parsedCount =
    activeTarget === 'RETAINED_SQUADS'
      ? parsedRetainedPlayers.length
      : parsedPoolPlayers.length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 max-w-xl w-full text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              IPL CSV / Excel Data Ingestion
            </h3>
            <p className="text-[11px] text-slate-400">Choose Current Squad or Auction Pool to upload</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Target Selector Tabs: STRICTLY 2 OPTIONS (Current Squad vs Auction Pool) */}
      <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => {
            setActiveTarget('RETAINED_SQUADS');
            setParsedPoolPlayers([]);
            setParsedRetainedPlayers([]);
            setFileName(null);
            setErrorMsg(null);
            setSuccessMsg(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-black text-xs transition cursor-pointer ${
            activeTarget === 'RETAINED_SQUADS'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Shield className="w-4 h-4 text-blue-300" />
          <span>1. Current Squad</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTarget('AUCTION_POOL');
            setParsedPoolPlayers([]);
            setParsedRetainedPlayers([]);
            setFileName(null);
            setErrorMsg(null);
            setSuccessMsg(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-black text-xs transition cursor-pointer ${
            activeTarget === 'AUCTION_POOL'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>2. Auction Pool</span>
        </button>
      </div>

      {/* Target Description Banner & Template Download */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="font-bold text-slate-200 block text-xs">
            {activeTarget === 'RETAINED_SQUADS'
              ? 'Current Squad (Retained Players & Purses)'
              : 'Auction Pool (Upcoming Players Queue)'}
          </span>
          <span className="text-[11px] text-slate-400">
            {activeTarget === 'RETAINED_SQUADS'
              ? 'Assigns existing players to CSK, MI, RCB, etc. and calculates remaining purse.'
              : 'Loads upcoming players into the live nomination queue for the Auctioneer block.'}
          </span>
        </div>

        <button
          onClick={() => handleDownloadTemplate(activeTarget)}
          className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-3 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 shrink-0 transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download {activeTarget === 'RETAINED_SQUADS' ? 'Current Squad' : 'Pool'} CSV</span>
        </button>
      </div>

      {/* File Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 hover:border-amber-500/80 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-950/40 hover:bg-slate-950/70 transition text-center"
      >
        <Upload className="w-8 h-8 text-amber-400 mb-1" />
        <p className="font-bold text-slate-200 text-sm">
          {fileName
            ? fileName
            : `Click to upload ${
                activeTarget === 'RETAINED_SQUADS' ? 'Current Squad' : 'Auction Pool'
              } CSV / Excel`}
        </p>
        <p className="text-[11px] text-slate-500">
          Accepts .csv, .xlsx, .xls, and .txt files
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Action Mode (Append vs Replace) */}
      <div className="flex flex-col gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-300">Upload Action Mode:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUploadMode('APPEND')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                uploadMode === 'APPEND'
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Append (Safe Merge)
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('REPLACE')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                uploadMode === 'REPLACE'
                  ? 'bg-rose-600 text-white font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Replace Existing
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400">
          {uploadMode === 'APPEND'
            ? '✅ Safe Merge: Adds new players without overwriting or duplicating existing squad rosters.'
            : '⚠️ Replace: Replaces retained stars for the uploaded teams and resets unbid players. Live auction buys are never lost.'}
        </p>
      </div>

      {/* Error & Success Messages */}
      {errorMsg && (
        <div className="bg-rose-950/60 border border-rose-800 rounded-xl p-3 flex items-center gap-2 text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/60 border border-emerald-800 rounded-xl p-3 flex items-center gap-2 text-emerald-300 font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Preview Loaded Players */}
      {parsedCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-slate-300 font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Parsed {parsedCount} {activeTarget === 'RETAINED_SQUADS' ? 'Current Squad Players' : 'Auction Pool Players'}:
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold">Ready to upload</span>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
            {activeTarget === 'RETAINED_SQUADS'
              ? parsedRetainedPlayers.slice(0, 10).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[11px] bg-slate-900 px-2 py-1 rounded border border-slate-800/80"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="bg-blue-600 text-white font-black px-1.5 py-0.2 rounded text-[9px]">
                        {p.team}
                      </span>
                      <span className="text-white font-medium truncate">{p.name}</span>
                      <span className="text-slate-400">({p.role})</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-emerald-400 font-bold">
                        {p.price ? formatIndianCurrency(p.price) : 'Retained'}
                      </span>
                    </div>
                  </div>
                ))
              : parsedPoolPlayers.slice(0, 10).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[11px] bg-slate-900 px-2 py-1 rounded border border-slate-800/80"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-amber-400 font-bold">{p.role}</span>
                      <span className="text-white font-medium truncate">{p.name}</span>
                      <span className="text-slate-400">({p.country})</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400">{p.set}</span>
                      <span className="text-emerald-400 font-bold">₹{p.basePrice}L</span>
                    </div>
                  </div>
                ))}
            {parsedCount > 10 && (
              <p className="text-center text-[10px] text-slate-500 py-1">
                ...and {parsedCount - 10} more players
              </p>
            )}
          </div>
        </div>
      )}

      {/* Commit Action Button */}
      {parsedCount > 0 && (
        <button
          onClick={handleCommitUpload}
          disabled={isProcessing}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wider shadow-lg transition cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>
            {isProcessing
              ? 'Importing...'
              : `Import ${parsedCount} ${
                  activeTarget === 'RETAINED_SQUADS' ? 'Players to Current Squads' : 'Players into Auction Pool'
                }`}
          </span>
        </button>
      )}
    </div>
  );
};
