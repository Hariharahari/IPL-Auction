import fs from 'fs';
import path from 'path';
import { FranchiseCode } from '@/types/auction';

export const SUPER_ADMIN_EMAIL = 'hariharan12403@gmail.com';

export interface ScheduledAuction {
  id: string;
  title: string;
  roomCode: string;
  scheduledAt: string; // ISO string
  appointedAuctioneerEmail: string;
  appointedAuctioneerName?: string;
  teamAssignments: Partial<Record<FranchiseCode, string[]>>; // Franchise -> Array of user emails
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED';
  createdAt: string;
  notes?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const SCHEDULE_FILE = path.join(DATA_DIR, 'scheduled_auctions.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

export function getScheduledAuctions(): ScheduledAuction[] {
  if (!fs.existsSync(SCHEDULE_FILE)) {
    // Seed with a default official scheduled auction
    const defaultAuction: ScheduledAuction = {
      id: 'sched_default_2027',
      title: 'IPL 2027 Official Mini-Auction Live Stage',
      roomCode: 'GLZ8PJ',
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      appointedAuctioneerEmail: SUPER_ADMIN_EMAIL,
      appointedAuctioneerName: 'Hariharan (Chief Auctioneer)',
      teamAssignments: {
        CSK: ['hariharan12403@gmail.com'],
      },
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
      notes: 'Official live simulation with authentic IPL 2027 rules and ₹130 Cr caps.',
    };
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify([defaultAuction], null, 2), 'utf8');
    return [defaultAuction];
  }

  try {
    const raw = fs.readFileSync(SCHEDULE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((a: any) => ({
      id: a.id || `sched_${a.roomCode || Date.now()}`,
      title: a.title || 'Scheduled Auction',
      roomCode: (a.roomCode || '').toUpperCase(),
      scheduledAt: a.scheduledAt || new Date().toISOString(),
      appointedAuctioneerEmail: a.appointedAuctioneerEmail || a.auctioneerEmail || '',
      appointedAuctioneerName: a.appointedAuctioneerName || undefined,
      teamAssignments: a.teamAssignments || a.assignedTeams || {},
      status: a.status || 'SCHEDULED',
      createdAt: a.createdAt || new Date().toISOString(),
      notes: a.notes,
    }));
  } catch (err) {
    console.warn('Error reading scheduled_auctions.json', err);
    return [];
  }
}

export function saveScheduledAuction(auction: Omit<ScheduledAuction, 'id' | 'createdAt'> & { id?: string }): ScheduledAuction {
  const current = getScheduledAuctions();
  const id = auction.id || `sched_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const existingIdx = current.findIndex((a) => a.id === id || a.roomCode.toUpperCase() === auction.roomCode.toUpperCase());

  const fullAuction: ScheduledAuction = {
    id,
    title: auction.title,
    roomCode: auction.roomCode.toUpperCase(),
    scheduledAt: auction.scheduledAt,
    appointedAuctioneerEmail: (auction.appointedAuctioneerEmail || '').trim().toLowerCase(),
    appointedAuctioneerName: auction.appointedAuctioneerName,
    teamAssignments: auction.teamAssignments || {},
    status: auction.status || 'SCHEDULED',
    createdAt: existingIdx >= 0 ? current[existingIdx].createdAt : new Date().toISOString(),
    notes: auction.notes,
  };

  if (existingIdx >= 0) {
    current[existingIdx] = fullAuction;
  } else {
    current.push(fullAuction);
  }

  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(current, null, 2), 'utf8');
  return fullAuction;
}

export function deleteScheduledAuction(id: string): boolean {
  const current = getScheduledAuctions();
  const filtered = current.filter((a) => a.id !== id && a.roomCode !== id);
  if (filtered.length !== current.length) {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(filtered, null, 2), 'utf8');
    return true;
  }
  return false;
}

export function getAuctionByCode(code: string): ScheduledAuction | null {
  const all = getScheduledAuctions();
  return all.find((a) => a.roomCode.toUpperCase() === code.trim().toUpperCase()) || null;
}

export function resolveUserRoleForRoom(
  email: string | null | undefined,
  roomCode: string
): { role: 'HOST' | 'AUCTIONEER' | 'TEAM_MEMBER' | 'SPECTATOR'; franchiseCode?: FranchiseCode | null } {
  if (!email) return { role: 'SPECTATOR', franchiseCode: null };
  const cleanEmail = email.trim().toLowerCase();

  // Super Admin is always Host / Auctioneer with supreme permissions
  if (isAdmin(cleanEmail)) {
    return { role: 'AUCTIONEER', franchiseCode: null };
  }

  const auction = getAuctionByCode(roomCode);
  if (!auction) {
    return { role: 'SPECTATOR', franchiseCode: null };
  }

  // Appointed Auctioneer
  const appointed = auction.appointedAuctioneerEmail || (auction as any).auctioneerEmail || '';
  if (appointed && appointed.toLowerCase() === cleanEmail) {
    return { role: 'AUCTIONEER', franchiseCode: null };
  }

  // Check Team Assignments
  const teamMap = auction.teamAssignments || (auction as any).assignedTeams || {};
  for (const [teamCode, members] of Object.entries(teamMap)) {
    if (Array.isArray(members) && members.some((m) => typeof m === 'string' && m.trim().toLowerCase() === cleanEmail)) {
      return { role: 'TEAM_MEMBER', franchiseCode: teamCode as FranchiseCode };
    }
  }

  return { role: 'SPECTATOR', franchiseCode: null };
}
