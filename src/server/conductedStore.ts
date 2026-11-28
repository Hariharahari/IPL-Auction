import fs from 'fs';
import path from 'path';

export interface ConductedSessionRecord {
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
  soldPlayers?: any[];
  unsoldPlayers?: any[];
  squads?: Record<string, any>;
  bidHistory?: any[];
  hostEmail?: string | null;
  hostName?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'conducted_sessions.json');

const g = globalThis as unknown as {
  __ipl_conducted_sessions?: Map<string, ConductedSessionRecord>;
};

if (!g.__ipl_conducted_sessions) {
  g.__ipl_conducted_sessions = new Map();
}

function loadFromDisk(): Map<string, ConductedSessionRecord> {
  const map = new Map<string, ConductedSessionRecord>();
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((s) => {
          if (s && s.roomCode) {
            map.set(s.roomCode.toUpperCase(), s);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[conductedStore] Failed to load sessions from disk:', err);
  }
  return map;
}

function saveToDisk(sessions: ConductedSessionRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
  } catch (err) {
    console.warn('[conductedStore] Failed to save sessions to disk:', err);
  }
}

// Initial populate from disk on boot
const diskMap = loadFromDisk();
diskMap.forEach((v, k) => {
  if (!g.__ipl_conducted_sessions!.has(k)) {
    g.__ipl_conducted_sessions!.set(k, v);
  }
});

export function saveConductedSession(record: ConductedSessionRecord): void {
  const code = record.roomCode.trim().toUpperCase();
  const disk = loadFromDisk();
  const existing = g.__ipl_conducted_sessions!.get(code) || disk.get(code);

  const isCompleted =
    record.status === 'Completed' ||
    record.phase === 'COMPLETED' ||
    existing?.status === 'Completed';

  // Safeguard: never overwrite non-zero sold history with an empty array
  const soldPlayers =
    record.soldPlayers && record.soldPlayers.length > 0
      ? record.soldPlayers
      : existing?.soldPlayers || [];

  const unsoldPlayers =
    record.unsoldPlayers && record.unsoldPlayers.length > 0
      ? record.unsoldPlayers
      : existing?.unsoldPlayers || [];

  const squads =
    record.squads && Object.keys(record.squads).length > 0
      ? record.squads
      : existing?.squads || {};

  const soldCount = Math.max(record.soldCount || 0, soldPlayers.length, existing?.soldCount || 0);
  const unsoldCount = Math.max(record.unsoldCount || 0, unsoldPlayers.length, existing?.unsoldCount || 0);
  const totalSpentLakhs = Math.max(
    record.totalSpentLakhs || 0,
    soldPlayers.reduce((sum, p) => sum + (p.soldAmount || p.price || 0), 0),
    existing?.totalSpentLakhs || 0
  );

  const participatingTeams = Array.from(
    new Set([
      ...(record.participatingTeams || []),
      ...(existing?.participatingTeams || []),
      ...Object.keys(squads),
      ...soldPlayers.map((p) => p.soldTo).filter(Boolean),
    ])
  );

  const normalized: ConductedSessionRecord = {
    ...existing,
    ...record,
    roomCode: code,
    status: isCompleted ? 'Completed' : 'In Progress',
    phase: isCompleted ? 'COMPLETED' : record.phase,
    soldCount,
    unsoldCount,
    totalAuctioned: soldCount + unsoldCount,
    totalSpentLakhs,
    totalPlayers: Math.max(record.totalPlayers || 0, soldCount + unsoldCount, existing?.totalPlayers || 0),
    participatingTeams: participatingTeams.length > 0 ? participatingTeams : ['CSK', 'MI', 'RCB', 'KKR', 'SRH'],
    soldPlayers,
    unsoldPlayers,
    squads,
    bidHistory: record.bidHistory && record.bidHistory.length > 0 ? record.bidHistory : existing?.bidHistory || [],
    updatedAt: record.updatedAt || Date.now(),
    createdAt: existing?.createdAt || record.createdAt || Date.now(),
    formattedDate: record.formattedDate || existing?.formattedDate || new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(new Date()),
  };

  g.__ipl_conducted_sessions!.set(code, normalized);

  // Sync to disk
  const all = Array.from(g.__ipl_conducted_sessions!.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
  saveToDisk(all);
}

export function getAllConductedSessions(): ConductedSessionRecord[] {
  // Merge in-memory with any freshly written disk entries
  const currentDisk = loadFromDisk();
  currentDisk.forEach((v, k) => {
    if (!g.__ipl_conducted_sessions!.has(k)) {
      g.__ipl_conducted_sessions!.set(k, v);
    }
  });

  return Array.from(g.__ipl_conducted_sessions!.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
}

export function getConductedSession(roomCode: string): ConductedSessionRecord | null {
  const code = roomCode.trim().toUpperCase();
  const mem = g.__ipl_conducted_sessions!.get(code);
  if (mem) return mem;

  const disk = loadFromDisk();
  return disk.get(code) || null;
}
