import * as XLSX from 'xlsx';
import { FranchiseCode, PlayerRole, PlayerSet } from '@/types/auction';
import { IPL_2027_MINI_AUCTION_PURSE_DEFAULTS } from './rules';
import { FRANCHISE_LIST } from '@/data/franchises';

export interface ParsedTeamPurse {
  team: FranchiseCode;
  remainingPurse: number; // in Lakhs
  maxSquadSize?: number;
  maxOverseas?: number;
}

export interface ParsedRetainedPlayer {
  name: string;
  team: FranchiseCode;
  role: PlayerRole;
  country: string;
  isOverseas: boolean;
  retentionPrice: number; // in Lakhs
  imageUrl?: string;
}

export interface ParsedAuctionPoolPlayer {
  name: string;
  role: PlayerRole;
  country: string;
  isOverseas: boolean;
  basePrice: number; // in Lakhs
  set: PlayerSet;
  previousTeam?: FranchiseCode | null;
  imageUrl?: string;
}

export interface ParsedMasterWorkbook {
  teamPurses?: ParsedTeamPurse[];
  retainedSquads?: ParsedRetainedPlayer[];
  auctionPool?: ParsedAuctionPoolPlayer[];
}

function normalizeFranchise(val: unknown): FranchiseCode | null {
  if (!val) return null;
  const str = String(val).trim().toUpperCase();
  const match = FRANCHISE_LIST.find(
    (f) =>
      f.code === str ||
      f.name.toUpperCase().includes(str) ||
      f.shortName.toUpperCase() === str
  );
  return match ? match.code : null;
}

function normalizeRole(val: unknown): PlayerRole {
  if (!val) return 'BAT';
  const str = String(val).trim().toUpperCase();
  if (str.includes('BOWL')) return 'BOWL';
  if (str.includes('ALL') || str === 'AR') return 'AR';
  if (str.includes('KEEP') || str === 'WK') return 'WK';
  return 'BAT';
}

function normalizeBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (!val) return false;
  const str = String(val).trim().toLowerCase();
  return str === 'yes' || str === 'true' || str === '1' || str === 'y';
}

function normalizePrice(val: unknown, defaultVal = 0): number {
  if (typeof val === 'number') return val;
  if (!val) return defaultVal;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Parses a single sheet or generic raw rows into AuctionPoolPlayer items.
 */
export function parseAuctionPoolRows(rows: Record<string, unknown>[]): ParsedAuctionPoolPlayer[] {
  const result: ParsedAuctionPoolPlayer[] = [];

  rows.forEach((row) => {
    const keys = Object.keys(row);
    const findKey = (sub: string) =>
      keys.find((k) => k.toLowerCase().replace(/[^a-z]/g, '').includes(sub));

    const nameKey = findKey('name') || findKey('player');
    const roleKey = findKey('role');
    const countryKey = findKey('country') || findKey('nation');
    const overseasKey = findKey('overseas') || findKey('isoverseas');
    const priceKey = findKey('baseprice') || findKey('price') || findKey('base');
    const setKey = findKey('set') || findKey('category');
    const prevKey = findKey('prev') || findKey('team');
    const imgKey = findKey('image') || findKey('photo') || findKey('url');

    const name = nameKey ? String(row[nameKey] || '').trim() : '';
    if (!name) return;

    const role = normalizeRole(roleKey ? row[roleKey] : 'BAT');
    const country = countryKey ? String(row[countryKey] || '').trim() : 'India';
    const isOverseas = overseasKey
      ? normalizeBoolean(row[overseasKey])
      : country.toLowerCase() !== 'india';

    const basePrice = priceKey ? normalizePrice(row[priceKey], 20) : 20;
    const set = setKey ? String(row[setKey] || '').trim() || 'Accelerated' : 'Accelerated';
    const previousTeam = prevKey ? normalizeFranchise(row[prevKey]) : null;
    const imageUrl = imgKey ? String(row[imgKey] || '').trim() : undefined;

    result.push({
      name,
      role,
      country,
      isOverseas,
      basePrice,
      set: set as PlayerSet,
      previousTeam,
      imageUrl: imageUrl || undefined,
    });
  });

  return result;
}

/**
 * Parses raw rows into RetainedSquads items.
 */
export function parseRetainedSquadRows(rows: Record<string, unknown>[]): ParsedRetainedPlayer[] {
  const result: ParsedRetainedPlayer[] = [];

  rows.forEach((row) => {
    const keys = Object.keys(row);
    const findKey = (sub: string) =>
      keys.find((k) => k.toLowerCase().replace(/[^a-z]/g, '').includes(sub));

    const nameKey = findKey('name') || findKey('player');
    const teamKey = findKey('team') || findKey('franchise');
    const roleKey = findKey('role');
    const countryKey = findKey('country');
    const overseasKey = findKey('overseas') || findKey('isoverseas');
    const exactPriceKey = keys.find(
      (k) => k.toLowerCase().replace(/[^a-z]/g, '') === 'price' || k.toLowerCase().replace(/[^a-z]/g, '') === 'retentionprice'
    );
    const crPriceKey = keys.find((k) => k.toLowerCase().includes('cr'));
    const priceKey = exactPriceKey || findKey('retentionprice') || findKey('price') || findKey('fee') || crPriceKey;
    const imgKey = findKey('image') || findKey('photo') || findKey('url');

    const name = nameKey ? String(row[nameKey] || '').trim() : '';
    const team = teamKey ? normalizeFranchise(row[teamKey]) : null;
    if (!name || !team) return;

    const role = normalizeRole(roleKey ? row[roleKey] : 'BAT');
    const country = countryKey ? String(row[countryKey] || '').trim() : 'India';
    const isOverseas = overseasKey
      ? normalizeBoolean(row[overseasKey])
      : country.toLowerCase() !== 'india';

    let retentionPrice = priceKey ? normalizePrice(row[priceKey], 0) : 0;
    if (priceKey && (priceKey.toLowerCase().includes('cr') || priceKey.toLowerCase().includes('crore'))) {
      if (retentionPrice > 0 && retentionPrice < 100) {
        retentionPrice = Math.round(retentionPrice * 100);
      }
    }
    const imageUrl = imgKey ? String(row[imgKey] || '').trim() : undefined;

    result.push({
      name,
      team,
      role,
      country,
      isOverseas,
      retentionPrice,
      imageUrl: imageUrl || undefined,
    });
  });

  return result;
}

/**
 * Parses raw rows into TeamPurses items.
 */
export function parseTeamPurseRows(rows: Record<string, unknown>[]): ParsedTeamPurse[] {
  const result: ParsedTeamPurse[] = [];

  rows.forEach((row) => {
    const keys = Object.keys(row);
    const findKey = (sub: string) =>
      keys.find((k) => k.toLowerCase().replace(/[^a-z]/g, '').includes(sub));

    const teamKey = findKey('team') || findKey('franchise') || findKey('code');
    const purseKey = findKey('purse') || findKey('remainingpurse') || findKey('budget');
    const maxSquadKey = findKey('maxsquad') || findKey('squadsize');
    const maxOverseasKey = findKey('maxoverseas') || findKey('overseas');

    const team = teamKey ? normalizeFranchise(row[teamKey]) : null;
    if (!team) return;

    const remainingPurse = purseKey
      ? normalizePrice(row[purseKey], IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[team].remainingPurse)
      : IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[team].remainingPurse;

    const maxSquadSize = maxSquadKey ? parseInt(String(row[maxSquadKey]), 10) : 25;
    const maxOverseas = maxOverseasKey ? parseInt(String(row[maxOverseasKey]), 10) : 8;

    result.push({
      team,
      remainingPurse,
      maxSquadSize: isNaN(maxSquadSize) ? 25 : maxSquadSize,
      maxOverseas: isNaN(maxOverseas) ? 8 : maxOverseas,
    });
  });

  return result;
}

/**
 * Parses a master Excel workbook containing up to 3 sheets:
 * 1. TeamPurses
 * 2. RetainedSquads
 * 3. AuctionPool
 */
export function parseMasterWorkbook(buffer: ArrayBuffer | Buffer): ParsedMasterWorkbook {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = wb.SheetNames;

  const result: ParsedMasterWorkbook = {};

  sheetNames.forEach((sheetName) => {
    const norm = sheetName.toLowerCase().replace(/[^a-z]/g, '');
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

    if (norm.includes('teampurse') || norm.includes('purse') || norm.includes('budget')) {
      result.teamPurses = parseTeamPurseRows(data);
    } else if (norm.includes('retained') || norm.includes('squad')) {
      result.retainedSquads = parseRetainedSquadRows(data);
    } else if (norm.includes('pool') || norm.includes('auction') || norm.includes('player')) {
      result.auctionPool = parseAuctionPoolRows(data);
    }
  });

  // If no multi-sheet matched (e.g. single-sheet CSV or unlabelled sheet), detect from column headers
  if (!result.teamPurses && !result.retainedSquads && !result.auctionPool && sheetNames.length > 0) {
    const ws = wb.Sheets[sheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (data.length > 0) {
      const keys = Object.keys(data[0]).map((k) => k.toLowerCase().replace(/[^a-z]/g, ''));
      const hasTeam = keys.some((k) => k === 'team' || k === 'franchise');
      const hasBasePrice = keys.some((k) => k.includes('baseprice') || k.includes('base'));
      const hasRetentionPrice = keys.some((k) => k.includes('retention') || k === 'price' || k === 'pricecr');
      const hasRemainingPurse = keys.some((k) => k.includes('remainingpurse') || k.includes('purse'));

      if (hasRemainingPurse && hasTeam) {
        result.teamPurses = parseTeamPurseRows(data);
      } else if (hasTeam && (hasRetentionPrice || !hasBasePrice)) {
        result.retainedSquads = parseRetainedSquadRows(data);
      } else {
        result.auctionPool = parseAuctionPoolRows(data);
      }
    } else {
      result.auctionPool = parseAuctionPoolRows(data);
    }
  }

  return result;
}

/**
 * Generates the Official IPL 2027 Mini-Auction Multi-Sheet Excel Template (.xlsx)
 * with pre-filled default purses and sample retained stars.
 */
export function generate2027MasterTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Sheet 1: TeamPurses (Pre-filled with official IPL 2027 Mini-Auction Defaults)
  const teamPursesData = FRANCHISE_LIST.map((f) => ({
    Team: f.code,
    TeamName: f.name,
    RemainingPurse: IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[f.code].remainingPurse,
    VacantSlots: IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[f.code].vacantSlots,
    MaxOverseasSlots: IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[f.code].maxOverseasSlots,
  }));
  const wsPurses = XLSX.utils.json_to_sheet(teamPursesData);
  XLSX.utils.book_append_sheet(wb, wsPurses, 'TeamPurses');

  // Sheet 2: RetainedSquads (Sample rows for guidance)
  const retainedData = [
    {
      Name: 'Ruturaj Gaikwad',
      Team: 'CSK',
      Role: 'BAT',
      Country: 'India',
      IsOverseas: 'No',
      RetentionPrice: 1800,
      ImageUrl: '',
    },
    {
      Name: 'Jasprit Bumrah',
      Team: 'MI',
      Role: 'BOWL',
      Country: 'India',
      IsOverseas: 'No',
      RetentionPrice: 1800,
      ImageUrl: '',
    },
    {
      Name: 'Virat Kohli',
      Team: 'RCB',
      Role: 'BAT',
      Country: 'India',
      IsOverseas: 'No',
      RetentionPrice: 2100,
      ImageUrl: '',
    },
    {
      Name: 'Sunil Narine',
      Team: 'KKR',
      Role: 'AR',
      Country: 'West Indies',
      IsOverseas: 'Yes',
      RetentionPrice: 1200,
      ImageUrl: '',
    },
    {
      Name: 'Heinrich Klaasen',
      Team: 'SRH',
      Role: 'WK',
      Country: 'South Africa',
      IsOverseas: 'Yes',
      RetentionPrice: 2300,
      ImageUrl: '',
    },
  ];
  const wsRetained = XLSX.utils.json_to_sheet(retainedData);
  XLSX.utils.book_append_sheet(wb, wsRetained, 'RetainedSquads');

  // Sheet 3: AuctionPool (Sample rows for guidance)
  const auctionPoolData = [
    {
      Name: 'Travis Head',
      Role: 'BAT',
      Country: 'Australia',
      IsOverseas: 'Yes',
      BasePrice: 200,
      Set: 'Marquee',
      PreviousTeam: 'SRH',
      ImageUrl: '',
    },
    {
      Name: 'Mitchell Starc',
      Role: 'BOWL',
      Country: 'Australia',
      IsOverseas: 'Yes',
      BasePrice: 200,
      Set: 'Marquee',
      PreviousTeam: 'DC',
      ImageUrl: '',
    },
    {
      Name: 'Wanindu Hasaranga',
      Role: 'AR',
      Country: 'Sri Lanka',
      IsOverseas: 'Yes',
      BasePrice: 150,
      Set: 'All-Rounders',
      PreviousTeam: 'LSG',
      ImageUrl: '',
    },
    {
      Name: 'Deepak Chahar',
      Role: 'BOWL',
      Country: 'India',
      IsOverseas: 'No',
      BasePrice: 150,
      Set: 'Fast Bowlers',
      PreviousTeam: 'MI',
      ImageUrl: '',
    },
    {
      Name: 'Abishek Porel',
      Role: 'WK',
      Country: 'India',
      IsOverseas: 'No',
      BasePrice: 75,
      Set: 'Wicketkeepers',
      PreviousTeam: 'DC',
      ImageUrl: '',
    },
  ];
  const wsPool = XLSX.utils.json_to_sheet(auctionPoolData);
  XLSX.utils.book_append_sheet(wb, wsPool, 'AuctionPool');

  const u8 = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return u8;
}
