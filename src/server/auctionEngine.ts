import {
  AuctionPhase,
  AuctionRoomState,
  BidRecord,
  BoughtPlayer,
  FranchiseCode,
  Player,
  PlayerRole,
  RoomSettings,
  RoomUser,
  UserRole,
} from '@/types/auction';
import { FRANCHISES, FRANCHISE_LIST } from '@/data/franchises';
import { getNextBidAmount, IPL_2027_MINI_AUCTION_PURSE_DEFAULTS, validateBid, generateRoomAccessCodes } from './rules';
import {
  persistRoomState,
  persistAuctionPool,
  persistRetainedSquads,
  persistSoldPlayer,
  persistPoolPlayerStatus,
  rehydrateRoomFromDb,
  removeRoomMember,
} from './dbService';
import { parseMasterWorkbook } from './excelIngestion';
import { getGlobalMasterData } from './globalMasterStore';
import { getAuctionByCode, resolveUserRoleForRoom, SUPER_ADMIN_EMAIL } from './scheduleService';
import { saveConductedSession } from './conductedStore';

// In-memory store for active auction rooms anchored to globalThis so Next.js API routes & server.ts share state
const g = globalThis as unknown as {
  __ipl_rooms?: Map<string, AuctionRoomState>;
  __ipl_roomLocks?: Map<string, Promise<void>>;
  __ipl_auction_engine?: AuctionEngine;
};

if (!g.__ipl_rooms) {
  g.__ipl_rooms = new Map<string, AuctionRoomState>();
}
if (!g.__ipl_roomLocks) {
  g.__ipl_roomLocks = new Map<string, Promise<void>>();
}

const rooms = g.__ipl_rooms;
const roomLocks = g.__ipl_roomLocks;

export async function acquireRoomLock<T>(roomCode: string, task: () => Promise<T> | T): Promise<T> {
  const currentLock = roomLocks.get(roomCode) || Promise.resolve();
  let resolveNext: () => void = () => {};
  const nextLock = new Promise<void>((resolve) => {
    resolveNext = resolve;
  });
  roomLocks.set(roomCode, currentLock.then(() => nextLock));

  try {
    await currentLock;
    return await task();
  } finally {
    resolveNext();
  }
}

// Generate unique 6-character room code (e.g. "IPL89K")
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  initialPurse: 13000, // ₹130.00 Cr (IPL 2027 Mini-Auction total cap)
  maxSquadSize: 25,
  minSquadSize: 0, // No minimum floor restriction blocking bids
  maxOverseas: 8,
  rtmCardsPerTeam: 0, // No RTM in Mini-Auction
  bidTimerSeconds: 15,
  biddingPermission: 'ANY_MEMBER',
};

export class AuctionEngine {
  private static instance: AuctionEngine;
  private onStateChangeCallback?: (roomCode: string, state: AuctionRoomState, eventName: string, eventData?: unknown) => void;

  private constructor() {}

  public static getInstance(): AuctionEngine {
    if (g.__ipl_auction_engine) {
      return g.__ipl_auction_engine;
    }
    if (!AuctionEngine.instance) {
      AuctionEngine.instance = new AuctionEngine();
    }
    g.__ipl_auction_engine = AuctionEngine.instance;
    return AuctionEngine.instance;
  }

  public getActiveRooms(): AuctionRoomState[] {
    return Array.from(rooms.values());
  }

  public registerStateChangeCallback(
    callback: (roomCode: string, state: AuctionRoomState, eventName: string, eventData?: unknown) => void
  ) {
    this.onStateChangeCallback = callback;
  }

  private notify(roomCode: string, eventName: string, eventData?: unknown) {
    const room = rooms.get(roomCode);
    if (room && this.onStateChangeCallback) {
      this.onStateChangeCallback(roomCode, room, eventName, eventData);
    }
  }

  /**
   * Room Initialization
   * 100% Excel-Driven: starts with empty player catalog, pre-configured with IPL 2027
   * Mini-Auction starting team purse defaults, saved to PostgreSQL.
   */
  public createRoom(
    hostId: string,
    hostName: string,
    socketId: string,
    customSettings?: Partial<RoomSettings>,
    desiredRoomCode?: string
  ): AuctionRoomState {
    let roomCode = desiredRoomCode ? desiredRoomCode.trim().toUpperCase() : generateRoomCode();
    if (desiredRoomCode && rooms.has(roomCode)) {
      return rooms.get(roomCode)!;
    }
    if (!desiredRoomCode) {
      while (rooms.has(roomCode)) {
        roomCode = generateRoomCode();
      }
    }

    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      ...customSettings,
      rtmCardsPerTeam: customSettings?.rtmCardsPerTeam ?? 0,
    };

    // Load server-level master squad and auction pool
    const globalData = getGlobalMasterData();

    // Initialize 10 IPL Teams with authentic 2027 Mini-Auction Purses & Pre-Retained Squads
    const teams = {} as Record<FranchiseCode, AuctionRoomState['teams'][FranchiseCode]>;
    const soldHistory: BoughtPlayer[] = [];

    FRANCHISE_LIST.forEach((f) => {
      const purseInfo = globalData.teamPurses[f.code];
      const defaultPurse = purseInfo
        ? purseInfo.remainingPurse
        : IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[f.code]?.remainingPurse ?? 13000;

      const teamRetained = globalData.retainedSquads.filter((p) => p.team === f.code);
      const squad: BoughtPlayer[] = teamRetained.map((p, idx) => ({
        id: `ret_${roomCode}_${f.code}_${idx}`,
        name: p.name,
        role: p.role,
        country: p.country,
        isOverseas: p.isOverseas,
        basePrice: p.price,
        previousTeam: f.code,
        statsSummary: `Retained by ${f.code} for ₹${(p.price / 100).toFixed(2)} Cr`,
        set: 'Retained',
        status: 'SOLD',
        soldTo: f.code,
        soldAmount: p.price,
        isRetained: true,
        imageUrl: p.imageUrl,
      }));

      teams[f.code] = {
        code: f.code,
        name: f.name,
        shortName: f.shortName,
        remainingPurse: defaultPurse,
        rtmCardsRemaining: settings.rtmCardsPerTeam,
        squad,
        overseasCount: squad.filter((sp) => sp.isOverseas).length,
      };
    });

    const allPlayers: Player[] = globalData.auctionPool.map((p, idx) => ({
      id: `pool_${roomCode}_${idx}`,
      name: p.name,
      role: p.role,
      country: p.country,
      isOverseas: p.isOverseas,
      basePrice: p.basePrice,
      set: p.set,
      previousTeam: p.previousTeam || null,
      statsSummary: `Base Price: ₹${(p.basePrice / 100).toFixed(2)} Cr`,
      status: 'UPCOMING',
      imageUrl: p.imageUrl,
    }));

    const hostUser: RoomUser = {
      id: hostId,
      name: hostName,
      role: 'AUCTIONEER',
      isHost: true,
      socketId,
      joinedAt: Date.now(),
      isOnline: true,
    };

    const accessCodes = generateRoomAccessCodes();

    const newRoom: AuctionRoomState = {
      roomCode,
      code: roomCode,
      hostId,
      auctioneerId: hostId,
      phase: 'LOBBY',
      settings,
      teams,
      users: {
        [hostId]: hostUser,
      },
      accessCodes,
      activePlayer: null,
      currentBid: 0,
      highestBidderTeam: null,
      highestBidderUserId: null,
      bidHistory: [],
      soldHistory,
      unsoldHistory: [],
      allPlayers,
      timerEndsAt: null,
      isTimerPaused: false,
      isAuctionPaused: false,
      rtmState: null,
      lastActionMessage: `Room ready: loaded ${globalData.retainedSquads.length} main squad stars and ${allPlayers.length} pool players from server.`,
    };

    rooms.set(roomCode, newRoom);
    persistRoomState(newRoom).catch(console.warn);

    return newRoom;
  }

  public getRoom(roomCode: string): AuctionRoomState | undefined {
    return rooms.get(roomCode.toUpperCase());
  }

  /**
   * User Session & Role Management
   * Late join support: any user entering room code can join mid-auction.
   */
  public async joinRoomAsync(
    roomCode: string,
    userId: string,
    userName: string,
    socketId: string
  ): Promise<{ room: AuctionRoomState; user: RoomUser } | { error: string }> {
    const code = roomCode.toUpperCase();
    let room = rooms.get(code);

    // If not currently in memory, attempt to rehydrate from PostgreSQL database
    if (!room) {
      const rehydrated = await rehydrateRoomFromDb(code);
      if (rehydrated) {
        rooms.set(code, rehydrated);
        room = rehydrated;
      } else {
        const scheduled = getAuctionByCode(code);
        if (scheduled || code === 'GLZ8PJ') {
          room = this.createRoom('system_host', 'IPL Auction System', socketId, undefined, code);
        } else {
          return { error: 'Auction room not found' };
        }
      }
    }

    let user = room.users[userId];
    if (user) {
      user.name = userName || user.name;
      user.socketId = socketId;
      user.isOnline = true;
    } else {
      user = {
        id: userId,
        name: userName,
        role: 'SPECTATOR',
        socketId,
        joinedAt: Date.now(),
        isOnline: true,
      };
      room.users[userId] = user;
    }

    persistRoomState(room).catch(console.warn);
    this.notify(code, 'user:joined', user);
    return { room, user };
  }

  public async joinRoom(
    roomCode: string,
    userId: string,
    userName: string,
    socketId: string,
    userEmail?: string,
    teamAccessCode?: string
  ): Promise<{ room: AuctionRoomState; user: RoomUser } | { error: string }> {
    const code = roomCode.toUpperCase();
    let room = rooms.get(code);

    // If not in RAM, restore from PostgreSQL database
    if (!room) {
      const restored = await rehydrateRoomFromDb(code);
      if (restored) {
        rooms.set(code, restored);
        room = restored;
      } else {
        const scheduled = getAuctionByCode(code);
        if (scheduled || code === 'GLZ8PJ') {
          room = this.createRoom('system_host', 'IPL Auction System', socketId, undefined, code);
        } else {
          return { error: 'Auction room not found' };
        }
      }
    }

    if (!room.accessCodes) {
      room.accessCodes = generateRoomAccessCodes();
    }

    const resolved = resolveUserRoleForRoom(userEmail, code);
    const isSuper = userEmail?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    // Check if user is Host/Auctioneer
    const isHostUser = room.hostId === userId || room.hostId === 'system_host';
    const isExistingAuctioneer = room.auctioneerId === userId;
    const isAuctioneer = isSuper || resolved.role === 'AUCTIONEER' || isHostUser || isExistingAuctioneer;

    let user = room.users[userId];
    if (user) {
      user.name = userName || user.name;
      if (userEmail) user.email = userEmail;
      user.socketId = socketId;
      user.isOnline = true;

      if (isAuctioneer) {
        user.role = 'AUCTIONEER';
        user.isHost = true;
        room.auctioneerId = userId;
        if (room.hostId === 'system_host' || !room.hostId) {
          room.hostId = userId;
        }
      } else if (user.franchiseCode) {
        // STRICT NO-SWITCHING LOCK:
        // User is permanently locked to this franchise for this room session
        if (teamAccessCode) {
          const normInput = teamAccessCode.trim().toUpperCase();
          const currentTeamCode = user.franchiseCode;
          const currentPin = room.accessCodes.franchises[currentTeamCode]?.toUpperCase();

          if (normInput !== currentPin && normInput !== currentTeamCode) {
            for (const [fCode, pin] of Object.entries(room.accessCodes.franchises)) {
              if ((pin.toUpperCase() === normInput || fCode === normInput) && fCode !== currentTeamCode) {
                return {
                  error: `Your identity is permanently locked to ${currentTeamCode}. You cannot switch to ${fCode}.`,
                };
              }
            }
          }
        }
        user.role = 'TEAM_MEMBER';
      }
    } else {
      // New user joining the room
      if (isAuctioneer) {
        user = {
          id: userId,
          name: userName,
          email: userEmail,
          role: 'AUCTIONEER',
          franchiseCode: null,
          socketId,
          joinedAt: Date.now(),
          isOnline: true,
          isHost: true,
        };
        room.auctioneerId = userId;
        if (room.hostId === 'system_host' || !room.hostId) {
          room.hostId = userId;
        }
        room.users[userId] = user;
      } else {
        // Participant or Spectator: validate teamAccessCode
        if (!teamAccessCode || !teamAccessCode.trim()) {
          return { error: 'Team Access Code is required to join this room' };
        }

        const normCode = teamAccessCode.trim().toUpperCase();
        let matchedFranchise: FranchiseCode | null = null;
        let matchedRole: UserRole = 'SPECTATOR';

        // Check franchise access PINs
        for (const [fCode, pin] of Object.entries(room.accessCodes.franchises)) {
          if (pin.toUpperCase() === normCode || fCode === normCode) {
            matchedFranchise = fCode as FranchiseCode;
            matchedRole = 'TEAM_MEMBER';
            break;
          }
        }

        if (!matchedFranchise) {
          // Check spectator PIN
          if (
            room.accessCodes.spectator.toUpperCase() === normCode ||
            normCode === 'SPECTATOR' ||
            normCode === 'SPEC'
          ) {
            matchedRole = 'SPECTATOR';
          } else {
            return {
              error: 'Invalid Team Access Code. Please enter a valid team access PIN (e.g. CSK-4821) or spectator code.',
            };
          }
        }

        user = {
          id: userId,
          name: userName,
          email: userEmail,
          role: matchedRole,
          franchiseCode: matchedFranchise,
          socketId,
          joinedAt: Date.now(),
          isOnline: true,
          isHost: false,
          teamRole: matchedRole === 'TEAM_MEMBER' ? 'MEMBER' : undefined,
        };

        if (matchedRole === 'TEAM_MEMBER' && matchedFranchise) {
          const hasCaptain = Object.values(room.users).some(
            (u) => u.franchiseCode === matchedFranchise && u.teamRole === 'CAPTAIN'
          );
          user.teamRole = hasCaptain ? 'MEMBER' : 'CAPTAIN';
        }

        room.users[userId] = user;
      }
    }

    persistRoomState(room).catch(console.warn);
    this.notify(code, 'user:joined', user);
    return { room, user };
  }

  public disconnectUser(socketId: string) {
    rooms.forEach((room, roomCode) => {
      Object.values(room.users).forEach((user) => {
        if (user.socketId === socketId) {
          user.isOnline = false;
          this.notify(roomCode, 'user:left', { userId: user.id, userName: user.name });
          if (user.id === room.auctioneerId) {
            this.handleAuctioneerDeparture(room, user.id);
          }
          persistRoomState(room).catch(console.warn);
        }
      });
    });
  }

  public leaveRoom(roomCode: string, userId: string): { success: boolean } {
    const code = roomCode.toUpperCase();
    const room = rooms.get(code);
    if (!room) return { success: false };

    const user = room.users[userId];
    if (user) {
      user.isOnline = false;
      this.notify(code, 'user:left', { userId: user.id, userName: user.name });

      if (room.auctioneerId === userId) {
        this.handleAuctioneerDeparture(room, userId);
      }
      persistRoomState(room).catch(console.warn);
      this.notify(code, 'state:sync', room);
    }
    return { success: true };
  }

  public appointTempAuctioneer(
    roomCode: string,
    requesterId: string,
    targetUserId: string
  ): { success: boolean; error?: string } {
    const code = roomCode.toUpperCase();
    const room = rooms.get(code);
    if (!room) return { success: false, error: 'Room not found' };

    const requester = room.users[requesterId];
    if (!requester || (room.auctioneerId !== requesterId && room.hostId !== requesterId)) {
      return { success: false, error: 'Only the active Auctioneer or Host can appoint a Temporary Auctioneer' };
    }

    const targetUser = room.users[targetUserId];
    if (!targetUser) return { success: false, error: 'Target user not found in this room' };
    if (!targetUser.isOnline) return { success: false, error: 'Target user is currently offline' };

    // Reset previous temp auctioneer flag
    Object.values(room.users).forEach((u) => {
      if (u.isTempAuctioneer) u.isTempAuctioneer = false;
    });

    room.tempAuctioneerId = targetUserId;
    targetUser.isTempAuctioneer = true;
    room.lastActionMessage = `${targetUser.name} has been appointed as Temporary Deputy Auctioneer by ${requester.name}!`;

    persistRoomState(room).catch(console.warn);
    this.notify(code, 'state:sync', room);
    this.notify(code, 'auctioneer:temp_appointed', {
      targetUserId,
      targetUserName: targetUser.name,
      appointedBy: requester.name,
    });

    return { success: true };
  }

  public transferAuctioneerGavel(
    roomCode: string,
    requesterId: string,
    targetUserId: string
  ): { success: boolean; error?: string } {
    const code = roomCode.toUpperCase();
    const room = rooms.get(code);
    if (!room) return { success: false, error: 'Room not found' };

    const requester = room.users[requesterId];
    if (!requester || (room.auctioneerId !== requesterId && room.hostId !== requesterId)) {
      return { success: false, error: 'Only the active Auctioneer or Host can transfer the gavel' };
    }

    const targetUser = room.users[targetUserId];
    if (!targetUser) return { success: false, error: 'Target user not found in this room' };
    if (!targetUser.isOnline) return { success: false, error: 'Target user is currently offline' };

    if (requester.id === room.auctioneerId) {
      requester.role = requester.franchiseCode ? 'TEAM_MEMBER' : 'SPECTATOR';
    }
    targetUser.role = 'AUCTIONEER';
    targetUser.isTempAuctioneer = false;
    room.auctioneerId = targetUser.id;
    room.lastActionMessage = `Gavel handed over: ${targetUser.name} is now the active Auctioneer!`;

    persistRoomState(room).catch(console.warn);
    this.notify(code, 'state:sync', room);
    this.notify(code, 'auctioneer:transferred', {
      previousAuctioneerId: requesterId,
      newAuctioneerId: targetUserId,
      newAuctioneerName: targetUser.name,
      isTemporary: false,
    });

    return { success: true };
  }

  private handleAuctioneerDeparture(room: AuctionRoomState, departedUserId: string) {
    const code = room.roomCode || room.code || '';
    // 1. Check if designated temporary auctioneer is online
    if (room.tempAuctioneerId && room.tempAuctioneerId !== departedUserId) {
      const deputy = room.users[room.tempAuctioneerId];
      if (deputy && deputy.isOnline) {
        deputy.role = 'AUCTIONEER';
        deputy.isTempAuctioneer = false;
        room.auctioneerId = deputy.id;
        room.lastActionMessage = `Auctioneer left. ${deputy.name} has taken over as Temporary Auctioneer!`;
        this.notify(code, 'auctioneer:transferred', {
          previousAuctioneerId: departedUserId,
          newAuctioneerId: deputy.id,
          newAuctioneerName: deputy.name,
          isTemporary: true,
        });
        this.notify(code, 'state:sync', room);
        return;
      }
    }

    // 2. Check if room host is online and not departed
    if (room.hostId && room.hostId !== departedUserId) {
      const hostUser = room.users[room.hostId];
      if (hostUser && hostUser.isOnline) {
        hostUser.role = 'AUCTIONEER';
        room.auctioneerId = hostUser.id;
        room.lastActionMessage = `Auctioneer left. Room Host ${hostUser.name} has assumed the Auctioneer gavel!`;
        this.notify(code, 'auctioneer:transferred', {
          previousAuctioneerId: departedUserId,
          newAuctioneerId: hostUser.id,
          newAuctioneerName: hostUser.name,
          isTemporary: true,
        });
        this.notify(code, 'state:sync', room);
        return;
      }
    }

    // 3. Promote any other online user as fallback temporary auctioneer
    const nextCandidate = Object.values(room.users).find((u) => u.id !== departedUserId && u.isOnline);
    if (nextCandidate) {
      nextCandidate.role = 'AUCTIONEER';
      room.auctioneerId = nextCandidate.id;
      room.lastActionMessage = `Auctioneer left. ${nextCandidate.name} has stepped in as Temporary Auctioneer!`;
      this.notify(code, 'auctioneer:transferred', {
        previousAuctioneerId: departedUserId,
        newAuctioneerId: nextCandidate.id,
        newAuctioneerName: nextCandidate.name,
        isTemporary: true,
      });
      this.notify(code, 'state:sync', room);
    }
  }

  public assignRole(
    roomCode: string,
    userId: string,
    role: 'AUCTIONEER' | 'SPECTATOR' | 'TEAM_MEMBER',
    franchiseCode?: FranchiseCode | null
  ): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    const user = room.users[userId];
    if (!user) return { success: false, error: 'User not found in room' };

    // STRICT PERMANENT LOCK:
    if (user.franchiseCode && role === 'TEAM_MEMBER' && franchiseCode && user.franchiseCode !== franchiseCode) {
      return { success: false, error: `Your identity is permanently locked to ${user.franchiseCode}. You cannot switch teams.` };
    }
    if (user.role === 'AUCTIONEER' && user.isHost && role !== 'AUCTIONEER') {
      return { success: false, error: 'The room host cannot relinquish Auctioneer status.' };
    }

    if (role === 'AUCTIONEER') {
      if (room.auctioneerId && room.auctioneerId !== userId) {
        const existing = room.users[room.auctioneerId];
        if (existing && existing.isOnline) {
          return { success: false, error: `${existing.name} is already the Auctioneer` };
        }
      }
      room.auctioneerId = userId;
      user.role = 'AUCTIONEER';
      user.franchiseCode = null;
      user.teamRole = undefined;
    } else if (role === 'SPECTATOR') {
      if (room.auctioneerId === userId) {
        room.auctioneerId = null;
      }
      user.role = 'SPECTATOR';
      user.franchiseCode = null;
      user.teamRole = undefined;
    } else if (role === 'TEAM_MEMBER') {
      if (!franchiseCode || !room.teams[franchiseCode]) {
        return { success: false, error: 'Invalid franchise selected' };
      }
      if (room.auctioneerId === userId) {
        room.auctioneerId = null;
      }
      user.role = 'TEAM_MEMBER';
      user.franchiseCode = franchiseCode;

      const existingCaptain = Object.values(room.users).find(
        (u) => u.franchiseCode === franchiseCode && u.teamRole === 'CAPTAIN' && u.isOnline && u.id !== userId
      );
      user.teamRole = existingCaptain ? 'MEMBER' : 'CAPTAIN';
    }

    persistRoomState(room).catch(console.warn);
    this.notify(roomCode, 'state:sync', room);
    return { success: true };
  }

  public async removeUser(
    roomCode: string,
    requesterId: string,
    targetUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    const requester = room.users[requesterId];
    if (!requester || (!requester.isHost && requester.role !== 'AUCTIONEER')) {
      return { success: false, error: 'Only the Host or Auctioneer can remove users' };
    }

    if (targetUserId === room.hostId || targetUserId === requesterId) {
      return { success: false, error: 'Cannot remove the room host' };
    }

    const targetUser = room.users[targetUserId];
    if (!targetUser) return { success: false, error: 'User not found in room' };

    delete room.users[targetUserId];
    await removeRoomMember(roomCode, targetUserId).catch(console.warn);
    persistRoomState(room).catch(console.warn);

    this.notify(roomCode, 'user:removed', { userId: targetUserId, userName: targetUser.name });
    this.notify(roomCode, 'state:sync', room);
    return { success: true };
  }

  public toggleHandRaise(roomCode: string, userId: string): { success: boolean; handRaised?: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    const user = room.users[userId];
    if (!user) return { success: false, error: 'User not found in room' };

    user.handRaised = !user.handRaised;
    persistRoomState(room).catch(console.warn);

    this.notify(roomCode, 'user:hand_raised', {
      userId,
      userName: user.name,
      franchiseCode: user.franchiseCode,
      handRaised: user.handRaised,
    });
    this.notify(roomCode, 'state:sync', room);
    return { success: true, handRaised: user.handRaised };
  }

  public getRoomState(roomCode: string): AuctionRoomState | undefined {
    return rooms.get(roomCode.toUpperCase());
  }

  public getAllRooms(): AuctionRoomState[] {
    return Array.from(rooms.values());
  }

  public setRoomState(roomCode: string, state: AuctionRoomState): void {
    rooms.set(roomCode.toUpperCase(), state);
  }

  public setTeamCaptain(
    roomCode: string,
    requesterId: string,
    targetUserId: string
  ): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    const requester = room.users[requesterId];
    const target = room.users[targetUserId];
    if (!requester || !target) return { success: false, error: 'User not found' };

    if (!requester.isHost && requester.role !== 'AUCTIONEER' && requester.teamRole !== 'CAPTAIN') {
      return { success: false, error: 'Not authorized to change captaincy' };
    }

    if (!target.franchiseCode) {
      return { success: false, error: 'Target user is not in a franchise team' };
    }

    Object.values(room.users).forEach((u) => {
      if (u.franchiseCode === target.franchiseCode) {
        u.teamRole = u.id === targetUserId ? 'CAPTAIN' : 'MEMBER';
      }
    });

    if (room.teams[target.franchiseCode]) {
      room.teams[target.franchiseCode].captainId = targetUserId;
    }

    persistRoomState(room).catch(console.warn);
    this.notify(roomCode, 'state:sync', room);
    return { success: true };
  }

  public startAuction(
    roomCode: string,
    requesterId: string,
    options?: { autoNominate?: boolean; mode?: 'RANDOM' | 'SEQUENTIAL'; set?: string }
  ): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    const requester = room.users[requesterId];
    if (!requester || (!requester.isHost && requester.role !== 'AUCTIONEER')) {
      return { success: false, error: 'Only the Host or Auctioneer can start the live auction' };
    }

    if (room.phase !== 'LOBBY') {
      return { success: false, error: 'Auction has already commenced' };
    }

    if (!room.auctioneerId) {
      room.auctioneerId = requesterId;
      requester.role = 'AUCTIONEER';
      requester.franchiseCode = null;
    }

    room.phase = 'IDLE';
    room.lastActionMessage = 'Auction initialized! Click "Next from Pool" to nominate a player.';
    persistRoomState(room).catch(console.warn);
    this.notify(roomCode, 'state:sync', room);

    // Auto-draw first player if any are in pool
    if (room.allPlayers.length > 0) {
      this.nominateNextPlayer(roomCode, room.auctioneerId || requesterId, {
        mode: 'RANDOM',
        set: options?.set || 'ALL',
      });
    }

    return { success: true };
  }

  /**
   * Helper: verify auctioneer / host authority
   */
  public isAuctioneerAuthorized(room: AuctionRoomState, auctioneerId: string): boolean {
    if (!room) return false;
    if (!room.auctioneerId || room.auctioneerId === 'system_host' || room.hostId === 'system_host') {
      room.auctioneerId = auctioneerId;
      if (room.hostId === 'system_host') room.hostId = auctioneerId;
      return true;
    }
    if (room.auctioneerId === auctioneerId || room.hostId === auctioneerId) {
      return true;
    }
    const user = room.users[auctioneerId];
    if (user) {
      if (user.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return true;
      if (user.role === 'AUCTIONEER' || user.role === 'HOST' || user.isHost) return true;
    }
    if (Object.keys(room.users).length <= 1) {
      room.auctioneerId = auctioneerId;
      return true;
    }
    return false;
  }

  public endAuction(roomCode: string, requesterId: string): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    if (!this.isAuctioneerAuthorized(room, requesterId)) {
      return { success: false, error: 'Only the Auctioneer or Host can officially end the auction' };
    }

    room.phase = 'COMPLETED';
    room.activePlayer = null;
    room.currentBid = 0;
    room.lastActionMessage = '🏆 LIVE AUCTION OFFICIALLY CONCLUDED! All franchises and final squad rosters are locked.';

    // Directly guarantee persistence to conductedStore
    const isRetainedStar = (p: { isRetained?: boolean; set?: string; id?: string }) =>
      p.isRetained === true || p.set === 'Retained' || p.id?.startsWith('ret_');
    const cleanSold = (room.soldHistory || []).filter((p) => !isRetainedStar(p));
    const cleanUnsold = room.unsoldHistory || [];
    const totalSpentLakhs = cleanSold.reduce((sum, p) => sum + (p.soldAmount || 0), 0);
    const isSolo = roomCode.startsWith('SOLO') || room.hostId.startsWith('solo_') || Object.keys(room.users).length <= 1;

    try {
      saveConductedSession({
        roomCode: roomCode.toUpperCase(),
        mode: isSolo ? 'Solo Test' : 'Multiplayer',
        status: 'Completed',
        phase: 'COMPLETED',
        soldCount: cleanSold.length,
        unsoldCount: cleanUnsold.length,
        totalAuctioned: cleanSold.length + cleanUnsold.length,
        totalSpentLakhs,
        totalPlayers: room.allPlayers?.length || 0,
        participatingTeams: Array.from(
          new Set([
            ...Object.keys(room.teams || {}),
            ...cleanSold.map((p: any) => p.soldTo).filter(Boolean),
          ])
        ),
        lastActionMessage: room.lastActionMessage,
        updatedAt: Date.now(),
        createdAt: Date.now(),
        formattedDate: new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true,
        }).format(new Date()),
        soldPlayers: cleanSold,
        unsoldPlayers: cleanUnsold,
        squads: room.teams,
        bidHistory: room.bidHistory || [],
      });
    } catch (storeErr) {
      console.warn('[auctionEngine] saveConductedSession direct mirror error:', storeErr);
    }

    persistRoomState(room).catch(console.warn);

    this.notify(roomCode, 'auction:ended', { message: room.lastActionMessage });
    this.notify(roomCode, 'state:sync', room);
    return { success: true };
  }

  /**
   * Player Nomination
   */
  public nominatePlayer(roomCode: string, playerId: string, auctioneerId: string): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    if (!this.isAuctioneerAuthorized(room, auctioneerId)) {
      return { success: false, error: 'Only the Auctioneer or Host can nominate a player' };
    }

    if (room.phase === 'COMPLETED') {
      return { success: false, error: 'Auction is completed' };
    }

    // If a player is already on block, defer them to skipped
    if (room.activePlayer && room.activePlayer.id !== playerId) {
      const prev = room.activePlayer;
      prev.status = 'SKIPPED';
      const pIdx = room.allPlayers.findIndex((p) => p.id === prev.id);
      if (pIdx !== -1) {
        room.allPlayers.splice(pIdx, 1);
        room.allPlayers.push(prev);
      }
    }

    const player = room.allPlayers.find((p) => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found in catalog' };
    if (
      player.status !== 'UPCOMING' &&
      player.status !== 'SKIPPED' &&
      player.status !== 'UNSOLD' &&
      player.status !== 'NOMINATED'
    ) {
      return { success: false, error: `Player status is already ${player.status}` };
    }

    player.status = 'NOMINATED';
    room.activePlayer = player;
    room.phase = 'BIDDING_OPEN';
    room.currentBid = 0;
    room.highestBidderTeam = null;
    room.highestBidderUserId = null;
    room.isTimerPaused = false;
    room.rtmState = null;
    room.timerEndsAt = null; // Manual auctioneer pacing (no countdown timer deadline)
    room.lastActionMessage = `Player Nominated: ${player.name} (${player.role}, ${player.country}) at Base Price ₹${(player.basePrice / 100).toFixed(2)} Cr!`;

    persistPoolPlayerStatus(roomCode, player.name, 'ON_BLOCK').catch(console.warn);
    persistRoomState(room).catch(console.warn);

    this.notify(roomCode, 'player:nominated', {
      player,
      timerEndsAt: null,
      message: room.lastActionMessage,
    });
    this.notify(roomCode, 'state:sync', room);
    return { success: true };
  }

  /**
   * Draw Next Player from Pool (Random or Sequential)
   */
  public nominateNextPlayer(
    roomCode: string,
    auctioneerId: string,
    options?: { mode?: 'RANDOM' | 'SEQUENTIAL'; set?: string }
  ): { success: boolean; error?: string; player?: Player } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    if (!this.isAuctioneerAuthorized(room, auctioneerId)) {
      return { success: false, error: 'Only the Auctioneer or Host can nominate a player' };
    }

    if (room.phase === 'COMPLETED') {
      return { success: false, error: 'Auction has officially concluded' };
    }

    // If a player is currently on stage, defer them so we advance immediately
    const currentId = room.activePlayer?.id;
    if (room.activePlayer) {
      const current = room.activePlayer;
      current.status = 'SKIPPED';
      const cIdx = room.allPlayers.findIndex((p) => p.id === current.id);
      if (cIdx !== -1) {
        room.allPlayers.splice(cIdx, 1);
        room.allPlayers.push(current);
      }
      room.activePlayer = null;
      room.currentBid = 0;
      room.highestBidderTeam = null;
      room.highestBidderUserId = null;
      room.phase = 'IDLE';
    }

    let candidates = room.allPlayers.filter((p) => p.status === 'UPCOMING' && p.id !== currentId);

    if (options?.set && options.set !== 'ALL') {
      const setFiltered = candidates.filter(
        (p) => p.set?.toLowerCase() === options.set?.toLowerCase()
      );
      if (setFiltered.length > 0) {
        candidates = setFiltered;
      }
    }

    if (candidates.length === 0) {
      let skippedCandidates = room.allPlayers.filter(
        (p) => (p.status === 'SKIPPED' || p.status === 'UNSOLD') && p.id !== currentId
      );
      if (options?.set && options.set !== 'ALL') {
        const setFiltered = skippedCandidates.filter(
          (p) => p.set?.toLowerCase() === options.set?.toLowerCase()
        );
        if (setFiltered.length > 0) {
          skippedCandidates = setFiltered;
        }
      }
      candidates = skippedCandidates;
    }

    if (candidates.length === 0) {
      candidates = room.allPlayers.filter((p) => p.status !== 'SOLD');
    }

    if (candidates.length === 0) {
      return { success: false, error: 'No upcoming or deferred players left in this pool. Upload more players via Excel.' };
    }

    const isRandom = options?.mode !== 'SEQUENTIAL';
    let chosen: Player;
    if (isRandom) {
      const idx = Math.floor(Math.random() * candidates.length);
      chosen = candidates[idx];
    } else {
      chosen = candidates[0];
    }

    const res = this.nominatePlayer(roomCode, chosen.id, auctioneerId);
    if (res.success) {
      return { success: true, player: chosen };
    }
    return res;
  }

  /**
   * Skip Active Player or Player in Queue
   */
  public skipPlayer(
    roomCode: string,
    auctioneerId: string,
    playerId?: string,
    options?: { autoNext?: boolean; mode?: 'RANDOM' | 'SEQUENTIAL'; set?: string }
  ): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    if (!this.isAuctioneerAuthorized(room, auctioneerId)) {
      return { success: false, error: 'Only the Auctioneer or Host can skip players' };
    }

    if (playerId) {
      const player = room.allPlayers.find((p) => p.id === playerId);
      if (!player) return { success: false, error: 'Player not found in catalog' };
      player.status = 'SKIPPED';
      const pIdx = room.allPlayers.findIndex((p) => p.id === playerId);
      if (pIdx !== -1) {
        room.allPlayers.splice(pIdx, 1);
        room.allPlayers.push(player);
      }
      room.lastActionMessage = `Player Skipped from Queue: ${player.name} deferred to later rounds.`;
      this.notify(roomCode, 'state:sync', room);
      return { success: true };
    }

    if (!room.activePlayer) {
      return { success: false, error: 'No active player on the auction block to skip' };
    }

    const active = room.activePlayer;
    active.status = 'SKIPPED';

    const activeIdx = room.allPlayers.findIndex((p) => p.id === active.id);
    if (activeIdx !== -1) {
      room.allPlayers.splice(activeIdx, 1);
      room.allPlayers.push(active);
    }

    room.activePlayer = null;
    room.currentBid = 0;
    room.highestBidderTeam = null;
    room.highestBidderUserId = null;
    room.timerEndsAt = null;
    room.phase = 'IDLE';
    room.lastActionMessage = `Player Skipped: ${active.name} deferred to later rounds.`;

    persistPoolPlayerStatus(roomCode, active.name, 'PENDING').catch(console.warn);
    persistRoomState(room).catch(console.warn);

    this.notify(roomCode, 'player:skipped', { player: active, message: room.lastActionMessage });
    this.notify(roomCode, 'state:sync', room);

    if (options?.autoNext) {
      this.nominateNextPlayer(roomCode, auctioneerId, options);
    }

    return { success: true };
  }

  /**
   * Authoritative Mutex-Protected Bid Placement
   */
  public async placeBid(
    roomCode: string,
    userId: string,
    teamCode: FranchiseCode
  ): Promise<{ success: boolean; error?: string; bid?: BidRecord }> {
    const code = roomCode.toUpperCase();

    return acquireRoomLock(code, async () => {
      const room = rooms.get(code);
      if (!room) return { success: false, error: 'Room not found' };

      if (room.isAuctionPaused) {
        return { success: false, error: 'Auction is currently paused by the Auctioneer' };
      }

      const user = room.users[userId];
      if (!user) return { success: false, error: 'User not registered in room' };

      if (user.franchiseCode !== teamCode) {
        return { success: false, error: 'You cannot place bids on behalf of another team' };
      }

      const validation = validateBid(room, teamCode, user);
      if (!validation.valid || !validation.nextBidAmount) {
        return { success: false, error: validation.error || 'Bid validation failed' };
      }

      const nextBidAmount = validation.nextBidAmount;
      const team = room.teams[teamCode];

      const bidRecord: BidRecord = {
        id: `bid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        playerId: room.activePlayer!.id,
        amount: nextBidAmount,
        teamCode,
        teamName: team.name,
        userId: user.id,
        userName: user.name,
        timestamp: Date.now(),
      };

      room.currentBid = nextBidAmount;
      room.highestBidderTeam = teamCode;
      room.highestBidderUserId = user.id;
      room.bidHistory.unshift(bidRecord);
      room.timerEndsAt = null; // No timer deadline
      room.phase = 'BIDDING_OPEN';
      room.lastActionMessage = `${team.name} bids ₹${(nextBidAmount / 100).toFixed(2)} Cr!`;

      persistRoomState(room).catch(console.warn);

      this.notify(code, 'bid:accepted', {
        bid: bidRecord,
        currentBid: nextBidAmount,
        highestBidderTeam: teamCode,
        timerEndsAt: null,
        message: room.lastActionMessage,
      });
      this.notify(code, 'state:sync', room);

      return { success: true, bid: bidRecord };
    });
  }

  /**
   * Solo Testing Helper: Simulate Bid as any franchise
   */
  public async simulateBid(
    roomCode: string,
    requesterId: string,
    teamCode: FranchiseCode
  ): Promise<{ success: boolean; error?: string }> {
    const code = roomCode.toUpperCase();

    return acquireRoomLock(code, async () => {
      const room = rooms.get(code);
      if (!room) return { success: false, error: 'Room not found' };

      if (room.isAuctionPaused) {
        return { success: false, error: 'Auction is currently paused by the Auctioneer' };
      }

      const requester = room.users[requesterId];
      if (!requester || (requester.role !== 'AUCTIONEER' && !requester.isHost)) {
        return { success: false, error: 'Only the Auctioneer/Host can place simulated test bids' };
      }

      const team = room.teams[teamCode];
      if (!team) return { success: false, error: 'Invalid franchise' };

      const simulatedUser: RoomUser = {
        id: `sim_${teamCode}`,
        name: `${team.shortName || team.name} Representative`,
        role: 'TEAM_MEMBER',
        franchiseCode: teamCode,
        teamRole: 'CAPTAIN',
        socketId: 'simulated',
        joinedAt: Date.now(),
        isOnline: true,
      };

      const validation = validateBid(room, teamCode, simulatedUser);
      if (!validation.valid || !validation.nextBidAmount) {
        return { success: false, error: validation.error || 'Simulated bid invalid' };
      }

      const nextBidAmount = validation.nextBidAmount;

      const bidRecord: BidRecord = {
        id: `sim_bid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        playerId: room.activePlayer!.id,
        amount: nextBidAmount,
        teamCode,
        teamName: team.name,
        userId: simulatedUser.id,
        userName: simulatedUser.name,
        timestamp: Date.now(),
      };

      room.currentBid = nextBidAmount;
      room.highestBidderTeam = teamCode;
      room.highestBidderUserId = simulatedUser.id;
      room.bidHistory.unshift(bidRecord);
      room.timerEndsAt = null;
      room.phase = 'BIDDING_OPEN';
      room.lastActionMessage = `[Solo Test] ${team.name} bids ₹${(nextBidAmount / 100).toFixed(2)} Cr!`;

      persistRoomState(room).catch(console.warn);

      this.notify(code, 'bid:accepted', {
        bid: bidRecord,
        currentBid: nextBidAmount,
        highestBidderTeam: teamCode,
        timerEndsAt: null,
        message: room.lastActionMessage,
      });
      this.notify(code, 'state:sync', room);

      return { success: true };
    });
  }

  public hammerSold(
    roomCode: string,
    auctioneerId: string,
    customWinningTeam?: FranchiseCode,
    customFinalAmount?: number
  ): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    if (!this.isAuctioneerAuthorized(room, auctioneerId)) {
      return { success: false, error: 'Only the Auctioneer or Host can hammer SOLD' };
    }

    if (!room.activePlayer) return { success: false, error: 'No active player to sell' };
    if (customWinningTeam) {
      room.highestBidderTeam = customWinningTeam;
    }
    if (customFinalAmount !== undefined && customFinalAmount > 0) {
      room.currentBid = customFinalAmount;
    }

    if (!room.highestBidderTeam) {
      return { success: false, error: 'Please select which team won the player.' };
    }
    if (room.currentBid <= 0) {
      return { success: false, error: 'Sold price must be greater than zero. Enter a valid amount.' };
    }

    const team = room.teams[room.highestBidderTeam];
    if (!team) {
      return { success: false, error: `Invalid franchise: ${room.highestBidderTeam}` };
    }

    if (team.remainingPurse < room.currentBid) {
      return {
        success: false,
        error: `${team.name} only has ₹${(team.remainingPurse / 100).toFixed(2)} Cr remaining purse. Cannot afford ₹${(room.currentBid / 100).toFixed(2)} Cr.`,
      };
    }

    if (room.activePlayer.isOverseas && team.overseasCount >= 8) {
      return {
        success: false,
        error: `${team.name} already has maximum 8 overseas players.`,
      };
    }

    if (team.squad.length >= 25) {
      return {
        success: false,
        error: `${team.name} squad is full (25 players max).`,
      };
    }

    return this.finalizeSold(roomCode.toUpperCase());
  }

  public hammerUnsold(roomCode: string, auctioneerId: string): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    if (!this.isAuctioneerAuthorized(room, auctioneerId)) {
      return { success: false, error: 'Only the Auctioneer or Host can hammer UNSOLD' };
    }

    if (!room.activePlayer) return { success: false, error: 'No active player' };
    return this.finalizeUnsold(roomCode);
  }

  public pauseTimer(roomCode: string, auctioneerId: string): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    if (!this.isAuctioneerAuthorized(room, auctioneerId)) {
      return { success: false, error: 'Only the Auctioneer or Host can pause the timer' };
    }

    room.isTimerPaused = true;
    this.notify(roomCode, 'auction:timer_paused', { isTimerPaused: true });
    this.notify(roomCode, 'state:sync', room);
    return { success: true };
  }

  public resumeTimer(roomCode: string, auctioneerId: string): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    if (!this.isAuctioneerAuthorized(room, auctioneerId)) {
      return { success: false, error: 'Only the Auctioneer or Host can resume the timer' };
    }

    room.isTimerPaused = false;
    this.notify(roomCode, 'auction:timer_resumed', { isTimerPaused: false });
    this.notify(roomCode, 'state:sync', room);
    return { success: true };
  }

  public togglePauseAuction(
    roomCode: string,
    auctioneerId: string
  ): { success: boolean; isPaused: boolean; error?: string } {
    const code = roomCode.toUpperCase();
    const room = rooms.get(code);
    if (!room) return { success: false, isPaused: false, error: 'Room not found' };

    if (!this.isAuctioneerAuthorized(room, auctioneerId)) {
      return { success: false, isPaused: false, error: 'Only the Auctioneer or Host can pause/resume the auction' };
    }

    room.isAuctionPaused = !room.isAuctionPaused;
    room.isTimerPaused = !!room.isAuctionPaused;
    room.lastActionMessage = room.isAuctionPaused
      ? '⏸️ Auction has been paused by the Auctioneer.'
      : '▶️ Auction has resumed! Live bidding is active.';

    persistRoomState(room).catch(console.warn);

    this.notify(code, 'auction:pause_toggled', {
      isPaused: room.isAuctionPaused,
      message: room.lastActionMessage,
    });
    this.notify(code, 'state:sync', room);

    return { success: true, isPaused: room.isAuctionPaused };
  }

  public resetTimer(
    roomCode: string,
    auctioneerId: string,
    seconds: number = 15
  ): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    if (!this.isAuctioneerAuthorized(room, auctioneerId)) {
      return { success: false, error: 'Only the Auctioneer or Host can reset the timer' };
    }

    room.timerEndsAt = Date.now() + seconds * 1000;
    room.isTimerPaused = false;
    this.notify(roomCode, 'auction:timer_reset', { timerEndsAt: room.timerEndsAt, seconds });
    this.notify(roomCode, 'state:sync', room);
    return { success: true };
  }

  public triggerRTM(roomCode: string, auctioneerId: string): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    if (!this.isAuctioneerAuthorized(room, auctioneerId)) {
      return { success: false, error: 'Only the Auctioneer or Host can trigger RTM' };
    }

    if (!room.activePlayer || !room.highestBidderTeam) {
      return { success: false, error: 'No active player or winning bidder to trigger RTM' };
    }

    const prevTeam = room.activePlayer.previousTeam;
    if (!prevTeam || prevTeam === room.highestBidderTeam) {
      return { success: false, error: 'Player does not have an eligible previous franchise for RTM' };
    }

    room.phase = 'RTM_PENDING';
    room.rtmState = {
      playerId: room.activePlayer.id,
      playerName: room.activePlayer.name,
      highestBid: room.currentBid,
      highestBidderTeam: room.highestBidderTeam,
      originalTeam: prevTeam,
      rtmTimerEndsAt: Date.now() + 30000,
    };
    room.lastActionMessage = `RTM offered to ${prevTeam} at ₹${(room.currentBid / 100).toFixed(2)} Cr!`;

    this.notify(roomCode, 'auction:rtm_triggered', room.rtmState);
    this.notify(roomCode, 'state:sync', room);
    return { success: true };
  }

  public resolveRTM(roomCode: string, exercised: boolean): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room || !room.rtmState || !room.activePlayer) {
      return { success: false, error: 'No active RTM situation to resolve' };
    }

    const winningTeamCode = exercised ? room.rtmState.originalTeam : room.rtmState.highestBidderTeam;
    room.rtmState = null;
    return this.hammerSold(roomCode, room.auctioneerId || room.hostId, winningTeamCode);
  }

  private finalizeSold(roomCode: string): { success: boolean; error?: string } {
    const room = rooms.get(roomCode);
    if (!room || !room.activePlayer || !room.highestBidderTeam) {
      return { success: false, error: 'Cannot finalize sale' };
    }

    const player = room.activePlayer;
    const winningTeamCode = room.highestBidderTeam;
    const winningTeam = room.teams[winningTeamCode];
    const finalAmount = room.currentBid;

    winningTeam.remainingPurse -= finalAmount;
    if (player.isOverseas) {
      winningTeam.overseasCount += 1;
    }

    const boughtPlayer: BoughtPlayer = {
      ...player,
      status: 'SOLD',
      soldTo: winningTeamCode,
      soldAmount: finalAmount,
    };

    winningTeam.squad.push(boughtPlayer);
    room.soldHistory.unshift(boughtPlayer);

    const idx = room.allPlayers.findIndex((p) => p.id === player.id);
    if (idx !== -1) {
      room.allPlayers[idx] = boughtPlayer;
    }

    room.phase = 'SOLD';
    room.timerEndsAt = null;
    room.lastActionMessage = `SOLD! ${player.name} bought by ${winningTeam.name} for ₹${(finalAmount / 100).toFixed(2)} Cr!`;

    // Persist to PostgreSQL database
    persistSoldPlayer(roomCode, boughtPlayer, winningTeamCode, winningTeam.remainingPurse).catch(console.warn);
    persistRoomState(room).catch(console.warn);

    this.notify(roomCode, 'player:sold', {
      player: boughtPlayer,
      winningTeam: winningTeamCode,
      finalAmount,
      message: room.lastActionMessage,
    });
    this.notify(roomCode, 'state:sync', room);

    setTimeout(() => {
      if (room.phase === 'SOLD') {
        room.phase = 'IDLE';
        room.activePlayer = null;
        room.currentBid = 0;
        room.highestBidderTeam = null;
        room.highestBidderUserId = null;
        this.notify(roomCode, 'state:sync', room);
      }
    }, 2500);

    return { success: true };
  }

  private finalizeUnsold(roomCode: string): { success: boolean; error?: string } {
    const room = rooms.get(roomCode);
    if (!room || !room.activePlayer) {
      return { success: false, error: 'Cannot finalize unsold' };
    }

    const player = room.activePlayer;
    player.status = 'UNSOLD';
    room.unsoldHistory.unshift(player);

    const idx = room.allPlayers.findIndex((p) => p.id === player.id);
    if (idx !== -1) {
      room.allPlayers[idx] = player;
    }

    room.phase = 'UNSOLD';
    room.timerEndsAt = null;
    room.lastActionMessage = `UNSOLD! No bids placed for ${player.name}.`;

    persistPoolPlayerStatus(roomCode, player.name, 'UNSOLD').catch(console.warn);
    persistRoomState(room).catch(console.warn);

    this.notify(roomCode, 'player:unsold', {
      player,
      message: room.lastActionMessage,
    });
    this.notify(roomCode, 'state:sync', room);

    setTimeout(() => {
      if (room.phase === 'UNSOLD') {
        room.phase = 'IDLE';
        room.activePlayer = null;
        room.currentBid = 0;
        room.highestBidderTeam = null;
        room.highestBidderUserId = null;
        this.notify(roomCode, 'state:sync', room);
      }
    }, 2000);

    return { success: true };
  }

  /**
   * Master Multi-Sheet Excel Workbook Ingestion (.xlsx)
   */
  public uploadMasterWorkbook(
    roomCode: string,
    requesterId: string,
    buffer: Buffer | ArrayBuffer,
    mode: 'REPLACE' | 'APPEND' = 'REPLACE'
  ): { success: boolean; error?: string; summary?: { pursesCount: number; retainedCount: number; poolCount: number } } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    const user = room.users[requesterId];
    if (!user || (user.role !== 'AUCTIONEER' && !user.isHost)) {
      return { success: false, error: 'Only the Auctioneer or Host can upload the master workbook' };
    }

    try {
      const parsed = parseMasterWorkbook(buffer);
      let pursesCount = 0;
      let retainedCount = 0;
      let poolCount = 0;

      // 1. Process TeamPurses
      const teamPursesMap: Partial<Record<FranchiseCode, number>> = {};
      if (parsed.teamPurses && parsed.teamPurses.length > 0) {
        parsed.teamPurses.forEach((tp) => {
          if (room.teams[tp.team]) {
            room.teams[tp.team].remainingPurse = tp.remainingPurse;
            teamPursesMap[tp.team] = tp.remainingPurse;
            pursesCount++;
          }
        });
      }

      // 2. Process RetainedSquads
      if (parsed.retainedSquads && parsed.retainedSquads.length > 0) {
        const affectedTeams = Array.from(new Set(parsed.retainedSquads.map((rp) => rp.team)));

        if (mode === 'REPLACE') {
          // Only clear retained players for teams present in this upload, never wipe unaffected teams or live-bought players
          affectedTeams.forEach((teamCode) => {
            const t = room.teams[teamCode];
            if (t) {
              t.squad = t.squad.filter((p) => !p.isRetained);
              t.overseasCount = t.squad.filter((p) => p.isOverseas).length;
            }
          });
          room.soldHistory = room.soldHistory.filter(
            (p) => !p.isRetained || !affectedTeams.includes(p.soldTo)
          );
        }

        const newRetained: BoughtPlayer[] = [];
        parsed.retainedSquads.forEach((rp, idx) => {
          const team = room.teams[rp.team];
          if (!team) return;

          const existingIdx = team.squad.findIndex(
            (sp) => sp.name.trim().toLowerCase() === rp.name.trim().toLowerCase()
          );

          if (existingIdx !== -1) {
            // Never overwrite live auction purchases
            if (!team.squad[existingIdx].isRetained) return;

            // Update existing retained star in place without duplicating
            team.squad[existingIdx].basePrice = rp.retentionPrice;
            team.squad[existingIdx].soldAmount = rp.retentionPrice;
            team.squad[existingIdx].role = rp.role;
            team.squad[existingIdx].country = rp.country;
            team.squad[existingIdx].isOverseas = rp.isOverseas;
            if (rp.imageUrl) team.squad[existingIdx].imageUrl = rp.imageUrl;
            return;
          }

          const boughtPlayer: BoughtPlayer = {
            id: `ret_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            name: rp.name,
            role: rp.role,
            country: rp.country,
            isOverseas: rp.isOverseas,
            basePrice: rp.retentionPrice,
            previousTeam: rp.team,
            statsSummary: `Retained by ${rp.team} for ₹${(rp.retentionPrice / 100).toFixed(2)} Cr`,
            set: 'Retained',
            status: 'SOLD',
            soldTo: rp.team,
            soldAmount: rp.retentionPrice,
            isRetained: true,
            imageUrl: rp.imageUrl,
          };

          team.squad.push(boughtPlayer);
          if (rp.isOverseas) {
            team.overseasCount += 1;
          }
          newRetained.push(boughtPlayer);
          retainedCount++;
        });

        persistRetainedSquads(roomCode, newRetained, teamPursesMap as any, mode).catch(console.warn);
      }

      // 3. Process AuctionPool
      if (parsed.auctionPool && parsed.auctionPool.length > 0) {
        const formatted: Player[] = parsed.auctionPool.map((p, idx) => ({
          id: `pool_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          name: p.name,
          role: p.role,
          country: p.country,
          isOverseas: p.isOverseas,
          basePrice: p.basePrice,
          set: p.set,
          previousTeam: p.previousTeam || null,
          statsSummary: `Base Price: ₹${(p.basePrice / 100).toFixed(2)} Cr`,
          status: 'UPCOMING',
          imageUrl: p.imageUrl,
        }));

        if (mode === 'REPLACE') {
          const preserved = room.allPlayers.filter(
            (p) => p.status === 'SOLD' || p.id === room.activePlayer?.id
          );
          const preservedNames = new Set(preserved.map((p) => p.name.trim().toLowerCase()));
          const uniqueIncoming = formatted.filter((p) => !preservedNames.has(p.name.trim().toLowerCase()));
          room.allPlayers = [...preserved, ...uniqueIncoming];
          poolCount = uniqueIncoming.length;
        } else {
          const existingNames = new Set(room.allPlayers.map((p) => p.name.trim().toLowerCase()));
          const uniqueIncoming = formatted.filter((p) => !existingNames.has(p.name.trim().toLowerCase()));
          room.allPlayers = [...room.allPlayers, ...uniqueIncoming];
          poolCount = uniqueIncoming.length;
        }

        persistAuctionPool(roomCode, formatted, mode).catch(console.warn);
      }

      room.lastActionMessage = `Master Excel Ingested: ${pursesCount} team purses, ${retainedCount} retained stars, ${poolCount} pool players loaded.`;
      persistRoomState(room).catch(console.warn);
      this.notify(roomCode, 'state:sync', room);

      return {
        success: true,
        summary: { pursesCount, retainedCount, poolCount },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to parse master Excel workbook' };
    }
  }

  /**
   * Bulk Player Pool Upload (Excel / CSV)
   */
  public uploadPlayerPool(
    roomCode: string,
    requesterId: string,
    playersData: Array<Omit<Player, 'id' | 'status'>>,
    mode: 'REPLACE' | 'APPEND' = 'APPEND'
  ): { success: boolean; count?: number; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    const user = room.users[requesterId];
    if (!user || (user.role !== 'AUCTIONEER' && !user.isHost)) {
      return { success: false, error: 'Only the Auctioneer or Host can upload players' };
    }

    if (!Array.isArray(playersData) || playersData.length === 0) {
      return { success: false, error: 'No valid players found in upload' };
    }

    const formattedPlayers: Player[] = playersData.map((p, idx) => ({
      ...p,
      id: `upl_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      status: 'UPCOMING',
    }));

    if (mode === 'REPLACE') {
      const preservedPlayers = room.allPlayers.filter(
        (p) => p.status === 'SOLD' || p.id === room.activePlayer?.id
      );
      const preservedNames = new Set(preservedPlayers.map((p) => p.name.trim().toLowerCase()));
      const uniqueIncoming = formattedPlayers.filter((p) => !preservedNames.has(p.name.trim().toLowerCase()));
      room.allPlayers = [...preservedPlayers, ...uniqueIncoming];
    } else {
      const existingNames = new Set(room.allPlayers.map((p) => p.name.trim().toLowerCase()));
      const uniqueIncoming = formattedPlayers.filter((p) => !existingNames.has(p.name.trim().toLowerCase()));
      room.allPlayers = [...room.allPlayers, ...uniqueIncoming];
    }

    room.lastActionMessage = `Player pool updated: ${formattedPlayers.length} players loaded (${mode.toLowerCase()} mode).`;
    persistAuctionPool(roomCode, formattedPlayers, mode).catch(console.warn);
    persistRoomState(room).catch(console.warn);

    this.notify(roomCode, 'players:uploaded', {
      count: formattedPlayers.length,
      mode,
      allPlayers: room.allPlayers,
      message: room.lastActionMessage,
    });
    this.notify(roomCode, 'state:sync', room);

    return { success: true, count: formattedPlayers.length };
  }

  /**
   * Pre-Retained Squads Bulk Upload
   */
  public uploadRetainedSquads(
    roomCode: string,
    requesterId: string,
    retainedPlayers: Array<{
      name: string;
      team: FranchiseCode;
      role: PlayerRole;
      country: string;
      isOverseas: boolean;
      price?: number;
      imageUrl?: string;
      statsSummary?: string;
      remainingPurse?: number;
    }>,
    mode: 'REPLACE' | 'APPEND' = 'APPEND'
  ): { success: boolean; count?: number; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    const user = room.users[requesterId];
    if (!user || (user.role !== 'AUCTIONEER' && !user.isHost)) {
      return { success: false, error: 'Only the Auctioneer or Host can upload retained squads' };
    }

    if (!Array.isArray(retainedPlayers) || retainedPlayers.length === 0) {
      return { success: false, error: 'No valid retained players provided' };
    }

    const affectedTeams = Array.from(new Set(retainedPlayers.map((p) => p.team)));

    if (mode === 'REPLACE') {
      // Only reset retained players for teams included in this upload, never wipe other franchises or live auction buys
      affectedTeams.forEach((teamCode) => {
        const team = room.teams[teamCode];
        if (team) {
          team.squad = team.squad.filter((p) => !p.isRetained);
          team.overseasCount = team.squad.filter((p) => p.isOverseas).length;
          // Set starting purse before retained deductions: ₹130 Cr = 13,000 Lakhs
          team.remainingPurse = 13000;
        }
      });
      room.soldHistory = room.soldHistory.filter((p) => !p.isRetained || !affectedTeams.includes(p.soldTo));
    }

    const customPurses: Partial<Record<FranchiseCode, number>> = {};
    const newBoughtPlayers: BoughtPlayer[] = [];

    retainedPlayers.forEach((p, idx) => {
      const team = room.teams[p.team];
      if (!team) return;

      const retentionPrice = Math.max(0, p.price || 0);

      const existingIdx = team.squad.findIndex(
        (sp) => sp.name.trim().toLowerCase() === p.name.trim().toLowerCase()
      );

      if (existingIdx !== -1) {
        // Live auction buys can NEVER be overwritten by an upload
        if (!team.squad[existingIdx].isRetained) return;

        // Update existing retained star in place without duplicating
        team.squad[existingIdx].basePrice = retentionPrice;
        team.squad[existingIdx].soldAmount = retentionPrice;
        team.squad[existingIdx].role = p.role;
        team.squad[existingIdx].country = p.country || team.squad[existingIdx].country;
        team.squad[existingIdx].isOverseas = p.isOverseas;
        if (p.imageUrl) team.squad[existingIdx].imageUrl = p.imageUrl;
        return;
      }

      const boughtPlayer: BoughtPlayer = {
        id: `ret_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        name: p.name,
        role: p.role,
        country: p.country || 'India',
        isOverseas: p.isOverseas,
        basePrice: retentionPrice,
        previousTeam: p.team,
        statsSummary: p.statsSummary || `Retained by ${p.team}`,
        set: 'Retained',
        status: 'SOLD',
        soldTo: p.team,
        soldAmount: retentionPrice,
        isRetained: true,
        imageUrl: p.imageUrl,
      };

      team.squad.push(boughtPlayer);
      if (p.isOverseas) {
        team.overseasCount += 1;
      }
      newBoughtPlayers.push(boughtPlayer);

      if (p.remainingPurse !== undefined && !isNaN(p.remainingPurse) && p.remainingPurse >= 0) {
        customPurses[p.team] = p.remainingPurse;
        team.remainingPurse = p.remainingPurse;
      } else {
        team.remainingPurse = Math.max(0, team.remainingPurse - retentionPrice);
        customPurses[p.team] = team.remainingPurse;
      }
    });

    // If no retention fees were provided in the file, fall back to official mini-auction purse defaults
    affectedTeams.forEach((teamCode) => {
      const team = room.teams[teamCode];
      if (team && customPurses[teamCode] === 13000) {
        team.remainingPurse = IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[teamCode].remainingPurse;
        customPurses[teamCode] = team.remainingPurse;
      }
    });

    persistRetainedSquads(roomCode, newBoughtPlayers, customPurses as any, mode).catch(console.warn);
    persistRoomState(room).catch(console.warn);

    room.lastActionMessage = `Retained squads updated: ${newBoughtPlayers.length} players registered across franchises.`;
    this.notify(roomCode, 'state:sync', room);

    return { success: true, count: newBoughtPlayers.length };
  }

  public addCustomPlayer(
    roomCode: string,
    auctioneerId: string,
    playerData: Omit<Player, 'id' | 'status' | 'isCustom'>
  ): { success: boolean; error?: string } {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    const user = room.users[auctioneerId];
    if (!user || user.role !== 'AUCTIONEER') {
      return { success: false, error: 'Only the Auctioneer can add custom players' };
    }

    const newPlayer: Player = {
      ...playerData,
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: 'UPCOMING',
      isCustom: true,
    };

    room.allPlayers.unshift(newPlayer);
    persistAuctionPool(roomCode, [newPlayer], 'APPEND').catch(console.warn);
    persistRoomState(room).catch(console.warn);

    room.lastActionMessage = `Custom player created: ${newPlayer.name} (${newPlayer.role}) at ₹${(newPlayer.basePrice / 100).toFixed(2)} Cr!`;
    this.notify(roomCode, 'state:sync', room);
    return { success: true };
  }
}

export const auctionEngine = AuctionEngine.getInstance();
