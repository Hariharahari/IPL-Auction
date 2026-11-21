import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { FranchiseCode, Player, PlayerRole } from '@/types/auction';
import { FRANCHISE_LIST } from '@/data/franchises';
import { IPL_2027_MINI_AUCTION_PURSE_DEFAULTS } from './rules';

export interface GlobalRetainedPlayer {
  name: string;
  team: FranchiseCode;
  role: PlayerRole;
  country: string;
  isOverseas: boolean;
  price: number; // in Lakhs
  priceCr?: number;
  imageUrl?: string;
}

export interface GlobalAuctionPoolPlayer {
  name: string;
  role: PlayerRole;
  country: string;
  isOverseas: boolean;
  basePrice: number; // in Lakhs
  set: string;
  previousTeam?: FranchiseCode | null;
  imageUrl?: string;
}

export interface GlobalMasterData {
  retainedSquads: GlobalRetainedPlayer[];
  auctionPool: GlobalAuctionPoolPlayer[];
  teamPurses: Record<
    FranchiseCode,
    { remainingPurse: number; spentLakhs: number; retainedCount: number; overseasCount: number; vacantSlots: number; maxOverseasSlots: number }
  >;
  lastUpdated: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const MASTER_FILE = path.join(DATA_DIR, 'global_master.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Calculate team purses based on ₹130 Cr (13000L) total cap
export function calculatePursesFromRetained(retained: GlobalRetainedPlayer[]) {
  const TOTAL_CAP = 13000;
  const purses: Record<string, any> = {};

  FRANCHISE_LIST.forEach((f) => {
    purses[f.code] = {
      remainingPurse: IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[f.code]?.remainingPurse ?? 13000,
      spentLakhs: 0,
      retainedCount: 0,
      overseasCount: 0,
      vacantSlots: 25,
      maxOverseasSlots: 8,
    };
  });

  retained.forEach((p) => {
    if (purses[p.team]) {
      purses[p.team].retainedCount += 1;
      if (p.isOverseas) purses[p.team].overseasCount += 1;
      purses[p.team].spentLakhs += p.price || 0;
    }
  });

  FRANCHISE_LIST.forEach((f) => {
    const p = purses[f.code];
    if (p.spentLakhs > 0) {
      p.remainingPurse = Math.max(0, TOTAL_CAP - p.spentLakhs);
    }
    p.vacantSlots = Math.max(0, 25 - p.retainedCount);
    p.maxOverseasSlots = Math.max(0, 8 - p.overseasCount);
  });

  return purses;
}

// Initialize or load master data
export function getGlobalMasterData(): GlobalMasterData {
  if (fs.existsSync(MASTER_FILE)) {
    try {
      const raw = fs.readFileSync(MASTER_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading global_master.json, regenerating from CSVs', e);
    }
  }

  // Load from existing CSVs
  const retained: GlobalRetainedPlayer[] = [];
  const retainedCsvPath = path.join(process.cwd(), 'public/ipl_2027_retained_players.csv');
  if (fs.existsSync(retainedCsvPath)) {
    const csvContent = fs.readFileSync(retainedCsvPath, 'utf8');
    const wb = XLSX.read(csvContent, { type: 'string' });
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
    rows.forEach((r) => {
      const team = (r.Team || r.Franchise || '').toUpperCase() as FranchiseCode;
      if (team && FRANCHISE_LIST.some((f) => f.code === team)) {
        retained.push({
          name: String(r.Name || '').trim(),
          team,
          role: (r.Role || 'BAT') as PlayerRole,
          country: String(r.Country || 'India').trim(),
          isOverseas: String(r.IsOverseas).toLowerCase() === 'yes' || String(r.IsOverseas) === 'true',
          price: Number(r.Price) || 0,
          priceCr: r.Price_Cr ? Number(r.Price_Cr) : (Number(r.Price) || 0) / 100,
          imageUrl: r.ImageUrl || undefined,
        });
      }
    });
  }

  const pool: GlobalAuctionPoolPlayer[] = [];
  const poolCsvPath = path.join(process.cwd(), 'public/ipl_2027_auction_pool.csv');
  if (fs.existsSync(poolCsvPath)) {
    const csvContent = fs.readFileSync(poolCsvPath, 'utf8');
    const wb = XLSX.read(csvContent, { type: 'string' });
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
    rows.forEach((r) => {
      pool.push({
        name: String(r.Name || '').trim(),
        role: (r.Role || 'BAT') as PlayerRole,
        country: String(r.Country || 'India').trim(),
        isOverseas: String(r.IsOverseas).toLowerCase() === 'yes' || String(r.IsOverseas) === 'true',
        basePrice: Number(r.BasePrice) || 20,
        set: String(r.Set || 'Accelerated').trim(),
        previousTeam: r.PreviousTeam || null,
        imageUrl: r.ImageUrl || undefined,
      });
    });
  }

  const teamPurses = calculatePursesFromRetained(retained);
  const data: GlobalMasterData = {
    retainedSquads: retained,
    auctionPool: pool,
    teamPurses,
    lastUpdated: new Date().toISOString(),
  };

  fs.writeFileSync(MASTER_FILE, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

// Update Global Retained Squads
export function updateGlobalRetainedSquads(
  players: GlobalRetainedPlayer[],
  mode: 'APPEND' | 'REPLACE' = 'REPLACE'
): GlobalMasterData {
  const current = getGlobalMasterData();

  let updatedRetained: GlobalRetainedPlayer[] = [];
  if (mode === 'APPEND') {
    const existingNames = new Set(current.retainedSquads.map((p) => p.name.trim().toLowerCase()));
    const newItems = players.filter((p) => !existingNames.has(p.name.trim().toLowerCase()));
    updatedRetained = [...current.retainedSquads, ...newItems];
  } else {
    // Replace: replace players for the uploaded teams, keeping unaffected teams
    const uploadedTeams = new Set(players.map((p) => p.team));
    const preserved = current.retainedSquads.filter((p) => !uploadedTeams.has(p.team));
    updatedRetained = [...preserved, ...players];
  }

  const teamPurses = calculatePursesFromRetained(updatedRetained);
  const data: GlobalMasterData = {
    ...current,
    retainedSquads: updatedRetained,
    teamPurses,
    lastUpdated: new Date().toISOString(),
  };

  fs.writeFileSync(MASTER_FILE, JSON.stringify(data, null, 2), 'utf8');

  // Also update public CSVs
  writeRetainedCsv(updatedRetained);
  return data;
}

// Update Global Auction Pool
export function updateGlobalAuctionPool(
  players: GlobalAuctionPoolPlayer[],
  mode: 'APPEND' | 'REPLACE' = 'REPLACE'
): GlobalMasterData {
  const current = getGlobalMasterData();

  let updatedPool: GlobalAuctionPoolPlayer[] = [];
  if (mode === 'APPEND') {
    const existingNames = new Set(current.auctionPool.map((p) => p.name.trim().toLowerCase()));
    const newItems = players.filter((p) => !existingNames.has(p.name.trim().toLowerCase()));
    updatedPool = [...current.auctionPool, ...newItems];
  } else {
    updatedPool = players;
  }

  const data: GlobalMasterData = {
    ...current,
    auctionPool: updatedPool,
    lastUpdated: new Date().toISOString(),
  };

  fs.writeFileSync(MASTER_FILE, JSON.stringify(data, null, 2), 'utf8');

  // Also update public pool CSV
  writePoolCsv(updatedPool);
  return data;
}

function writeRetainedCsv(players: GlobalRetainedPlayer[]) {
  const header = 'Name,Team,Role,Country,IsOverseas,Price,Price_Cr';
  const rows = players.map(
    (p) => `${p.name},${p.team},${p.role},${p.country},${p.isOverseas ? 'Yes' : 'No'},${p.price},${p.priceCr ?? (p.price / 100).toFixed(2)}`
  );
  const csv = [header, ...rows].join('\n');
  fs.writeFileSync(path.join(process.cwd(), 'public/ipl_2027_retained_players.csv'), csv, 'utf8');
  fs.writeFileSync(path.join(process.cwd(), 'public/sample_retained_squads_template.csv'), csv, 'utf8');
}

function writePoolCsv(players: GlobalAuctionPoolPlayer[]) {
  const header = 'Name,Role,Country,IsOverseas,BasePrice,Set,PreviousTeam';
  const rows = players.map(
    (p) => `${p.name},${p.role},${p.country},${p.isOverseas ? 'Yes' : 'No'},${p.basePrice},${p.set},${p.previousTeam || ''}`
  );
  const csv = [header, ...rows].join('\n');
  fs.writeFileSync(path.join(process.cwd(), 'public/ipl_2027_auction_pool.csv'), csv, 'utf8');
}
