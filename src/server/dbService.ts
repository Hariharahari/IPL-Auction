import { prisma, safeDbOperation } from '@/lib/db';
import { AuctionRoomState, BoughtPlayer, ChatMessage, FranchiseCode, Player, RoomUser } from '@/types/auction';
import { FRANCHISE_LIST } from '@/data/franchises';
import { IPL_2027_MINI_AUCTION_PURSE_DEFAULTS, generateRoomAccessCodes } from './rules';

/**
 * Persists Room, Franchise Teams, and Member records to PostgreSQL
 */
export async function persistRoomState(room: AuctionRoomState): Promise<void> {
  await safeDbOperation(async (client) => {
    const roomCode = room.roomCode || room.code || '';
    // 1. Upsert Room record
    const dbRoom = await client.room.upsert({
      where: { code: roomCode },
      update: {
        hostId: room.hostId,
        auctioneerId: room.auctioneerId,
        status: room.phase === 'LOBBY' ? 'LOBBY' : 'ACTIVE',
        configJson: JSON.stringify({
          ...room.settings,
          accessCodes: room.accessCodes,
        }),
        liveStateJson: JSON.stringify({
          phase: room.phase,
          currentBid: room.currentBid,
          highestBidderTeam: room.highestBidderTeam,
          highestBidderUserId: room.highestBidderUserId,
          activePlayer: room.activePlayer,
          lastActionMessage: room.lastActionMessage,
        }),
      },
      create: {
        code: roomCode,
        hostId: room.hostId,
        auctioneerId: room.auctioneerId,
        status: room.phase === 'LOBBY' ? 'LOBBY' : 'ACTIVE',
        configJson: JSON.stringify({
          ...room.settings,
          accessCodes: room.accessCodes,
        }),
        liveStateJson: JSON.stringify({
          phase: room.phase,
          currentBid: room.currentBid,
          highestBidderTeam: room.highestBidderTeam,
          highestBidderUserId: room.highestBidderUserId,
          activePlayer: room.activePlayer,
          lastActionMessage: room.lastActionMessage,
        }),
      },
    });

    // 2. Upsert FranchiseTeam rows
    const teamPromises = Object.values(room.teams).map((team) =>
      client.franchiseTeam.upsert({
        where: {
          roomId_franchiseCode: {
            roomId: dbRoom.id,
            franchiseCode: team.code,
          },
        },
        update: {
          remainingPurse: team.remainingPurse,
          maxSquadSize: room.settings.maxSquadSize || 25,
          maxOverseas: room.settings.maxOverseas || 8,
        },
        create: {
          roomId: dbRoom.id,
          franchiseCode: team.code,
          remainingPurse: team.remainingPurse,
          maxSquadSize: room.settings.maxSquadSize || 25,
          maxOverseas: room.settings.maxOverseas || 8,
        },
      })
    );
    await Promise.all(teamPromises);

    // 3. Upsert RoomMember rows
    const memberPromises = Object.values(room.users).map((user) =>
      client.roomMember.upsert({
        where: {
          roomId_userId: {
            roomId: dbRoom.id,
            userId: user.id,
          },
        },
        update: {
          name: user.name,
          role: user.role,
          franchiseCode: user.franchiseCode || null,
          isCaptain: user.teamRole === 'CAPTAIN',
          isOnline: user.isOnline,
        },
        create: {
          roomId: dbRoom.id,
          userId: user.id,
          name: user.name,
          role: user.role,
          franchiseCode: user.franchiseCode || null,
          isCaptain: user.teamRole === 'CAPTAIN',
          isOnline: user.isOnline,
        },
      })
    );
    await Promise.all(memberPromises);
  }, undefined);
}

/**
 * Persists newly uploaded Auction Pool players to PostgreSQL
 */
export async function persistAuctionPool(
  roomCode: string,
  players: Player[],
  mode: 'REPLACE' | 'APPEND'
): Promise<void> {
  await safeDbOperation(async (client) => {
    const dbRoom = await client.room.findUnique({ where: { code: roomCode } });
    if (!dbRoom) return;

    if (mode === 'REPLACE') {
      // Delete existing non-sold pool players
      await client.auctionPoolPlayer.deleteMany({
        where: {
          roomId: dbRoom.id,
          status: { notIn: ['SOLD'] },
        },
      });
    }

    if (players.length > 0) {
      await client.auctionPoolPlayer.createMany({
        data: players.map((p, idx) => ({
          roomId: dbRoom.id,
          name: p.name,
          role: p.role,
          country: p.country,
          isOverseas: p.isOverseas,
          basePrice: p.basePrice,
          set: p.set || 'Accelerated',
          previousTeam: p.previousTeam || null,
          imageUrl: p.imageUrl || null,
          status: p.status === 'SOLD' ? 'SOLD' : 'PENDING',
          nominationOrder: idx + 1,
        })),
        skipDuplicates: true,
      });
    }
  }, undefined);
}

/**
 * Persists Retained Squads to PostgreSQL SquadPlayer & FranchiseTeam tables
 */
export async function persistRetainedSquads(
  roomCode: string,
  retainedPlayers: BoughtPlayer[],
  teamPurses?: Record<FranchiseCode, number>,
  mode: 'REPLACE' | 'APPEND' = 'APPEND'
): Promise<void> {
  await safeDbOperation(async (client) => {
    const dbRoom = await client.room.findUnique({ where: { code: roomCode } });
    if (!dbRoom) return;

    if (mode === 'REPLACE') {
      const affectedTeams = Array.from(new Set(retainedPlayers.map((p) => p.soldTo)));
      await client.squadPlayer.deleteMany({
        where: {
          roomId: dbRoom.id,
          isRetained: true,
          franchiseCode: { in: affectedTeams },
        },
      });
    }

    // Insert retained squad players
    if (retainedPlayers.length > 0) {
      await client.squadPlayer.createMany({
        data: retainedPlayers.map((p) => ({
          roomId: dbRoom.id,
          franchiseCode: p.soldTo,
          name: p.name,
          role: p.role,
          country: p.country,
          isOverseas: p.isOverseas,
          price: p.soldAmount,
          isRetained: true,
          imageUrl: p.imageUrl || null,
        })),
        skipDuplicates: true,
      });
    }

    // Update remaining purses in FranchiseTeam
    if (teamPurses) {
      const updatePromises = Object.entries(teamPurses).map(([teamCode, purse]) =>
        client.franchiseTeam.updateMany({
          where: {
            roomId: dbRoom.id,
            franchiseCode: teamCode,
          },
          data: {
            remainingPurse: purse,
          },
        })
      );
      await Promise.all(updatePromises);
    }
  }, undefined);
}

/**
 * Persists a SOLD player into SquadPlayer and updates FranchiseTeam remainingPurse
 */
export async function persistSoldPlayer(
  roomCode: string,
  player: BoughtPlayer,
  winningTeamCode: FranchiseCode,
  newRemainingPurse: number
): Promise<void> {
  await safeDbOperation(async (client) => {
    const dbRoom = await client.room.findUnique({ where: { code: roomCode } });
    if (!dbRoom) return;

    // 1. Insert into SquadPlayer
    await client.squadPlayer.create({
      data: {
        roomId: dbRoom.id,
        franchiseCode: winningTeamCode,
        name: player.name,
        role: player.role,
        country: player.country,
        isOverseas: player.isOverseas,
        price: player.soldAmount,
        isRetained: false,
        imageUrl: player.imageUrl || null,
      },
    });

    // 2. Update FranchiseTeam remaining purse
    await client.franchiseTeam.updateMany({
      where: {
        roomId: dbRoom.id,
        franchiseCode: winningTeamCode,
      },
      data: {
        remainingPurse: newRemainingPurse,
      },
    });

    // 3. Mark in AuctionPoolPlayer as SOLD
    await client.auctionPoolPlayer.updateMany({
      where: {
        roomId: dbRoom.id,
        name: player.name,
      },
      data: {
        status: 'SOLD',
        soldToTeam: winningTeamCode,
        soldPrice: player.soldAmount,
      },
    });
  }, undefined);
}

/**
 * Updates an AuctionPoolPlayer's status (e.g. UNSOLD or ON_BLOCK)
 */
export async function persistPoolPlayerStatus(
  roomCode: string,
  playerName: string,
  status: 'PENDING' | 'ON_BLOCK' | 'UNSOLD'
): Promise<void> {
  await safeDbOperation(async (client) => {
    const dbRoom = await client.room.findUnique({ where: { code: roomCode } });
    if (!dbRoom) return;

    await client.auctionPoolPlayer.updateMany({
      where: {
        roomId: dbRoom.id,
        name: playerName,
      },
      data: {
        status,
      },
    });
  }, undefined);
}

/**
 * Persists chat messages to PostgreSQL
 */
export async function persistChatMessage(roomCode: string, msg: ChatMessage): Promise<void> {
  await safeDbOperation(async (client) => {
    const dbRoom = await client.room.findUnique({ where: { code: roomCode } });
    if (!dbRoom) return;

    await client.chatMessage.create({
      data: {
        roomId: dbRoom.id,
        channel: msg.channel,
        franchiseCode: msg.franchiseCode || null,
        senderName: msg.senderName,
        text: msg.content,
      },
    });
  }, undefined);
}

/**
 * Attempts to rehydrate a room from PostgreSQL if it exists in DB but not in-memory
 */
export async function rehydrateRoomFromDb(roomCode: string): Promise<AuctionRoomState | null> {
  return await safeDbOperation(async (client) => {
    const dbRoom = await client.room.findUnique({
      where: { code: roomCode },
      include: {
        teams: true,
        squadPlayers: true,
        poolPlayers: true,
        members: true,
      },
    });

    if (!dbRoom) return null;

    const config = JSON.parse(dbRoom.configJson || '{}');
    const liveState = JSON.parse(dbRoom.liveStateJson || '{}');

    // Reconstruct teams
    const teams = {} as AuctionRoomState['teams'];
    FRANCHISE_LIST.forEach((f) => {
      const dbTeam = dbRoom.teams.find((t) => t.franchiseCode === f.code);
      const teamSquad = dbRoom.squadPlayers
        .filter((sp) => sp.franchiseCode === f.code)
        .map((sp) => ({
          id: sp.id,
          name: sp.name,
          role: sp.role as any,
          country: sp.country,
          isOverseas: sp.isOverseas,
          basePrice: sp.price,
          previousTeam: f.code,
          statsSummary: sp.isRetained ? `Retained by ${f.code}` : `Bought by ${f.code}`,
          set: sp.isRetained ? ('Retained' as any) : ('Accelerated' as any),
          status: 'SOLD' as const,
          soldTo: f.code,
          soldAmount: sp.price,
          isRetained: sp.isRetained,
          imageUrl: sp.imageUrl || undefined,
        }));

      teams[f.code] = {
        code: f.code,
        name: f.name,
        shortName: f.shortName,
        remainingPurse: dbTeam ? dbTeam.remainingPurse : IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[f.code].remainingPurse,
        rtmCardsRemaining: 0,
        squad: teamSquad,
        overseasCount: teamSquad.filter((p) => p.isOverseas).length,
      };
    });

    // Reconstruct users
    const users: Record<string, RoomUser> = {};
    dbRoom.members.forEach((m) => {
      users[m.userId] = {
        id: m.userId,
        name: m.name,
        role: m.role as any,
        franchiseCode: (m.franchiseCode as FranchiseCode) || null,
        teamRole: m.isCaptain ? 'CAPTAIN' : undefined,
        isOnline: m.isOnline,
        joinedAt: m.createdAt.getTime(),
        isHost: m.userId === dbRoom.hostId,
        socketId: '',
      };
    });

    // Reconstruct catalog of all players
    const allPlayers: Player[] = dbRoom.poolPlayers.map((pp) => ({
      id: pp.id,
      name: pp.name,
      role: pp.role as any,
      country: pp.country,
      isOverseas: pp.isOverseas,
      basePrice: pp.basePrice,
      previousTeam: (pp.previousTeam as FranchiseCode) || null,
      statsSummary: `Base Price ₹${(pp.basePrice / 100).toFixed(2)} Cr`,
      set: pp.set as any,
      status: pp.status === 'SOLD' ? 'SOLD' : pp.status === 'UNSOLD' ? 'UNSOLD' : 'UPCOMING',
      soldTo: (pp.soldToTeam as FranchiseCode) || null,
      soldAmount: pp.soldPrice || null,
      imageUrl: pp.imageUrl || undefined,
    }));

    const restoredRoom: AuctionRoomState = {
      roomCode: dbRoom.code,
      code: dbRoom.code,
      hostId: dbRoom.hostId,
      auctioneerId: dbRoom.auctioneerId,
      phase: (liveState.phase as any) || (dbRoom.status === 'ACTIVE' ? 'IDLE' : 'LOBBY'),
      settings: {
        initialPurse: config.initialPurse || 13000,
        maxSquadSize: config.maxSquadSize || 25,
        minSquadSize: config.minSquadSize || 0,
        maxOverseas: config.maxOverseas || 8,
        rtmCardsPerTeam: 0,
        bidTimerSeconds: 15,
        biddingPermission: config.biddingPermission || 'ANY_MEMBER',
      },
      teams,
      users,
      accessCodes: config.accessCodes || generateRoomAccessCodes(),
      activePlayer: liveState.activePlayer || null,
      currentBid: liveState.currentBid || 0,
      highestBidderTeam: liveState.highestBidderTeam || null,
      highestBidderUserId: liveState.highestBidderUserId || null,
      timerEndsAt: null,
      isTimerPaused: false,
      rtmState: null,
      bidHistory: [],
      soldHistory: [],
      unsoldHistory: [],
      allPlayers,
      lastActionMessage: liveState.lastActionMessage || 'Room loaded from PostgreSQL database.',
    };

    return restoredRoom;
  }, null);
}

export async function removeRoomMember(roomCode: string, userId: string): Promise<void> {
  await safeDbOperation(async (client) => {
    const dbRoom = await client.room.findUnique({ where: { code: roomCode } });
    if (!dbRoom) return;

    await client.roomMember.deleteMany({
      where: {
        roomId: dbRoom.id,
        userId: userId,
      },
    });
  }, undefined);
}

export const restoreRoomState = rehydrateRoomFromDb;
