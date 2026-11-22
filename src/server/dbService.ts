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
    if (!roomCode) return;

    // Check existing room in DB first to protect against data regression
    const existing = await client.room.findUnique({
      where: { code: roomCode },
    });

    let existingLiveState: any = {};
    let existingConfig: any = {};
    try {
      existingLiveState = JSON.parse(existing?.liveStateJson || '{}');
    } catch {}
    try {
      existingConfig = JSON.parse(existing?.configJson || '{}');
    } catch {}

    // Never allow a COMPLETED room to be downgraded to LOBBY or ACTIVE
    const isCompleted =
      room.phase === 'COMPLETED' ||
      existing?.status === 'COMPLETED' ||
      existingConfig?.status === 'COMPLETED';
    const status = isCompleted
      ? 'COMPLETED'
      : room.phase === 'LOBBY'
      ? 'LOBBY'
      : 'ACTIVE';

    // Preserve non-zero sold history so an incidental stub never wipes out completed auction data
    const cleanSold = (room.soldHistory || []).filter((p) => !p.isRetained);
    const existingSold = (existingLiveState.soldHistory || []).filter(
      (p: any) => !p.isRetained
    );
    const finalSold = cleanSold.length > 0 ? cleanSold : existingSold;

    const finalUnsold =
      room.unsoldHistory && room.unsoldHistory.length > 0
        ? room.unsoldHistory
        : existingLiveState.unsoldHistory || [];

    const soldCount = finalSold.length;
    const unsoldCount = finalUnsold.length;
    const totalSpentLakhs = finalSold.reduce(
      (sum: number, p: any) => sum + (p.soldAmount || 0),
      0
    );

    const mergedConfig = {
      ...existingConfig,
      ...room.settings,
      accessCodes: room.accessCodes,
      soldCount,
      unsoldCount,
      totalSpentLakhs,
      status: isCompleted ? 'COMPLETED' : status,
    };

    const mergedLiveState = {
      phase: isCompleted ? 'COMPLETED' : room.phase,
      currentBid: isCompleted ? 0 : room.currentBid,
      highestBidderTeam: isCompleted ? null : room.highestBidderTeam,
      highestBidderUserId: isCompleted ? null : room.highestBidderUserId,
      activePlayer: isCompleted ? null : room.activePlayer,
      lastActionMessage: room.lastActionMessage,
      soldHistory: finalSold,
      unsoldHistory: finalUnsold,
      bidHistory: room.bidHistory || existingLiveState.bidHistory || [],
      isAuctionPaused: isCompleted ? false : room.isAuctionPaused || false,
      tempAuctioneerId: room.tempAuctioneerId || null,
      soldCount,
      unsoldCount,
      totalSpentLakhs,
    };

    // 1. Upsert Room record
    const dbRoom = await client.room.upsert({
      where: { code: roomCode },
      update: {
        hostId: room.hostId,
        auctioneerId: room.auctioneerId,
        status,
        configJson: JSON.stringify(mergedConfig),
        liveStateJson: JSON.stringify(mergedLiveState),
      },
      create: {
        code: roomCode,
        hostId: room.hostId,
        auctioneerId: room.auctioneerId,
        status,
        configJson: JSON.stringify(mergedConfig),
        liveStateJson: JSON.stringify(mergedLiveState),
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

    // 4. Upsert AuctionParticipant rows for users with email
    const participantPromises = Object.values(room.users)
      .filter((u) => !!u.email && u.email.includes('@'))
      .map(async (user) => {
        const cleanEmail = user.email!.trim().toLowerCase();
        // Ensure user exists
        await client.user.upsert({
          where: { email: cleanEmail },
          update: { name: user.name },
          create: {
            email: cleanEmail,
            name: user.name,
            role: cleanEmail === (process.env.SUPER_ADMIN_EMAIL || 'hariharan12403@gmail.com').toLowerCase() ? 'SUPER_ADMIN' : 'USER',
          },
        }).catch(() => null);

        return client.auctionParticipant.upsert({
          where: {
            roomCode_userEmail: {
              roomCode: roomCode,
              userEmail: cleanEmail,
            },
          },
          update: {
            userName: user.name,
            franchiseCode: user.franchiseCode || null,
            role: user.role || 'TEAM_MEMBER',
            isCaptain: user.teamRole === 'CAPTAIN',
          },
          create: {
            roomCode: roomCode,
            roomId: dbRoom.id,
            userEmail: cleanEmail,
            userName: user.name,
            franchiseCode: user.franchiseCode || null,
            role: user.role || 'TEAM_MEMBER',
            isCaptain: user.teamRole === 'CAPTAIN',
          },
        }).catch(() => null);
      });
    await Promise.all(participantPromises);

    // 5. Ensure newly bought SquadPlayer rows are saved in DB
    if (finalSold.length > 0) {
      await client.squadPlayer.createMany({
        data: finalSold.map((p: any) => ({
          roomId: dbRoom.id,
          franchiseCode: p.soldTo || 'CSK',
          name: p.name,
          role: p.role || 'BAT',
          country: p.country || 'India',
          isOverseas: !!p.isOverseas,
          price: p.soldAmount || p.price || 0,
          isRetained: false,
          imageUrl: p.imageUrl || null,
        })),
        skipDuplicates: true,
      }).catch(console.warn);
    }
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
    const rawSoldHistory = (
      Array.isArray(liveState.soldHistory)
        ? liveState.soldHistory
        : Array.isArray(config.soldHistory)
        ? config.soldHistory
        : []
    ).filter((p: any) => !p.isRetained);

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

      // Merge any newly bought players from soldHistory that are not already in teamSquad
      const missingFromSquad = rawSoldHistory.filter(
        (p: any) =>
          p.soldTo === f.code &&
          !teamSquad.some(
            (sp) => sp.id === p.id || sp.name?.toLowerCase() === p.name?.toLowerCase()
          )
      );

      missingFromSquad.forEach((p: any) => {
        teamSquad.push({
          id: p.id || `sold_${f.code}_${p.name.replace(/\s+/g, '_')}`,
          name: p.name,
          role: (p.role as any) || 'BAT',
          country: p.country || 'India',
          isOverseas: !!p.isOverseas,
          basePrice: p.basePrice || 20,
          previousTeam: f.code,
          statsSummary: `Bought by ${f.code}`,
          set: (p.set as any) || 'Accelerated',
          status: 'SOLD' as const,
          soldTo: f.code,
          soldAmount: p.soldAmount || p.price || 0,
          isRetained: false,
          imageUrl: p.imageUrl || undefined,
        });
      });

      const totalSpentByTeam = teamSquad
        .filter((sp) => !sp.isRetained)
        .reduce((sum, sp) => sum + (sp.soldAmount || 0), 0);
      const defaultPurse = IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[f.code].remainingPurse;
      const remainingPurse = dbTeam
        ? dbTeam.remainingPurse
        : Math.max(0, defaultPurse - totalSpentByTeam);

      teams[f.code] = {
        code: f.code,
        name: f.name,
        shortName: f.shortName,
        remainingPurse,
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

    const isCompleted =
      dbRoom.status === 'COMPLETED' ||
      liveState.phase === 'COMPLETED' ||
      config.status === 'COMPLETED';

    const restoredRoom: AuctionRoomState = {
      roomCode: dbRoom.code,
      code: dbRoom.code,
      hostId: dbRoom.hostId,
      auctioneerId: dbRoom.auctioneerId,
      phase: isCompleted
        ? 'COMPLETED'
        : (liveState.phase as any) ||
          (dbRoom.status === 'ACTIVE' ? 'IDLE' : 'LOBBY'),
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
      tempAuctioneerId: liveState.tempAuctioneerId || null,
      timerEndsAt: null,
      isTimerPaused: false,
      isAuctionPaused: liveState.isAuctionPaused || false,
      rtmState: null,
      bidHistory: liveState.bidHistory || [],
      soldHistory: liveState.soldHistory && liveState.soldHistory.length > 0
        ? liveState.soldHistory.filter((p: any) => !p.isRetained)
        : dbRoom.squadPlayers
            .filter((sp) => !sp.isRetained)
            .map((sp) => ({
              id: sp.id,
              name: sp.name,
              role: sp.role as any,
              country: sp.country,
              isOverseas: sp.isOverseas,
              basePrice: sp.price,
              previousTeam: (sp.franchiseCode as FranchiseCode) || null,
              statsSummary: `Bought by ${sp.franchiseCode}`,
              set: 'Accelerated' as any,
              status: 'SOLD' as const,
              soldTo: sp.franchiseCode as FranchiseCode,
              soldAmount: sp.price,
              isRetained: false,
              imageUrl: sp.imageUrl || undefined,
            })),
      unsoldHistory: liveState.unsoldHistory && liveState.unsoldHistory.length > 0
        ? liveState.unsoldHistory
        : dbRoom.poolPlayers
            .filter((pp) => pp.status === 'UNSOLD')
            .map((pp) => ({
              id: pp.id,
              name: pp.name,
              role: pp.role as any,
              country: pp.country,
              isOverseas: pp.isOverseas,
              basePrice: pp.basePrice,
              previousTeam: (pp.previousTeam as FranchiseCode) || null,
              statsSummary: `Base Price ₹${(pp.basePrice / 100).toFixed(2)} Cr`,
              set: pp.set as any,
              status: 'UNSOLD' as const,
              soldTo: null,
              soldAmount: null,
              imageUrl: pp.imageUrl || undefined,
            })),
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

export async function upsertDbUser(name: string, email: string): Promise<{ id: string; name: string; email: string; role: string } | null> {
  return await safeDbOperation(async (client) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const isSuper = cleanEmail === (process.env.SUPER_ADMIN_EMAIL || 'hariharan12403@gmail.com').toLowerCase();
    const defaultRole = isSuper ? 'SUPER_ADMIN' : 'USER';

    const user = await client.user.upsert({
      where: { email: cleanEmail },
      update: {
        name: cleanName,
        ...(isSuper ? { role: 'SUPER_ADMIN' } : {}),
      },
      create: {
        email: cleanEmail,
        name: cleanName,
        role: defaultRole,
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }, null);
}

export async function recordAuctionParticipant(params: {
  userEmail: string;
  userName: string;
  roomCode: string;
  franchiseCode?: string | null;
  role?: string;
  isCaptain?: boolean;
}): Promise<void> {
  await safeDbOperation(async (client) => {
    const cleanEmail = params.userEmail.trim().toLowerCase();
    const cleanRoomCode = params.roomCode.trim().toUpperCase();

    // Ensure User exists
    await client.user.upsert({
      where: { email: cleanEmail },
      update: { name: params.userName },
      create: {
        email: cleanEmail,
        name: params.userName,
        role: cleanEmail === (process.env.SUPER_ADMIN_EMAIL || 'hariharan12403@gmail.com').toLowerCase() ? 'SUPER_ADMIN' : 'USER',
      },
    });

    // Ensure Room exists
    const dbRoom = await client.room.findUnique({ where: { code: cleanRoomCode } });
    if (!dbRoom) return;

    await client.auctionParticipant.upsert({
      where: {
        roomCode_userEmail: {
          roomCode: cleanRoomCode,
          userEmail: cleanEmail,
        },
      },
      update: {
        userName: params.userName,
        franchiseCode: params.franchiseCode || null,
        role: params.role || 'TEAM_MEMBER',
        isCaptain: params.isCaptain || false,
      },
      create: {
        roomCode: cleanRoomCode,
        roomId: dbRoom.id,
        userEmail: cleanEmail,
        userName: params.userName,
        franchiseCode: params.franchiseCode || null,
        role: params.role || 'TEAM_MEMBER',
        isCaptain: params.isCaptain || false,
      },
    });
  }, undefined);
}

export async function getUserSessions(email: string, isAdmin: boolean = false): Promise<any[]> {
  return await safeDbOperation(async (client) => {
    const cleanEmail = email.trim().toLowerCase();

    if (isAdmin) {
      // Admins see all rooms
      const allRooms = await client.room.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 50,
        include: {
          squadPlayers: true,
          poolPlayers: true,
          participants: true,
        },
      });
      return allRooms;
    }

    // Returning user: query participations and rooms hosted
    const participations = await client.auctionParticipant.findMany({
      where: { userEmail: cleanEmail },
      include: {
        room: {
          include: {
            squadPlayers: true,
            poolPlayers: true,
            participants: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return participations.map((p) => p.room).filter(Boolean);
  }, []);
}

export const restoreRoomState = rehydrateRoomFromDb;
