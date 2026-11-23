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
  const normalized: ConductedSessionRecord = {
    ...record,
    roomCode: code,
    updatedAt: record.updatedAt || Date.now(),
    createdAt: record.createdAt || Date.now(),
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
