import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AuctionEngine } from '@/server/auctionEngine';
import { FRANCHISE_LIST } from '@/data/franchises';
import { IPL_2027_MINI_AUCTION_PURSE_DEFAULTS } from '@/server/rules';
import { isSuperAdminEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode: rawCode } = await params;
    const roomCode = rawCode?.trim().toUpperCase();

    if (!roomCode) {
      return NextResponse.json({ error: 'Room code required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      mode,
      hostEmail: rawEmail,
      hostName = 'Auctioneer',
      participatingTeams = [],
      soldPlayers = [],
      unsoldPlayers = [],
      squads = {},
      logs = [],
      bidHistory = [],
      totalSpent,
      lastActionMessage,
    } = body;

    const hostEmail = rawEmail?.trim().toLowerCase() || null;
    const isSuper = isSuperAdminEmail(hostEmail);

    const engine = AuctionEngine.getInstance();
    const memRoom = engine.getRoomState(roomCode);

    // Merge in-memory server state with client fallback payload
    // Ensure no pre-retained players contaminate soldHistory
    const rawSold =
      soldPlayers && soldPlayers.length > 0
        ? soldPlayers
        : memRoom?.soldHistory || [];
    let cleanSoldHistory = rawSold.filter((p: any) => !p.isRetained);

    let cleanUnsoldHistory =
      unsoldPlayers && unsoldPlayers.length > 0
        ? unsoldPlayers
        : memRoom?.unsoldHistory || [];

    const cleanBidHistory =
      bidHistory && bidHistory.length > 0
        ? bidHistory
        : memRoom?.bidHistory || [];

    const finalSquads =
      squads && Object.keys(squads).length > 0
        ? squads
        : memRoom?.teams || {};

    const endedAtIso = new Date().toISOString();
    const actionMessage =
      lastActionMessage ||
      '🏆 LIVE AUCTION OFFICIALLY CONCLUDED! All franchises and final squad rosters are locked.';

    let finalSoldCount = cleanSoldHistory.length;
    let finalUnsoldCount = cleanUnsoldHistory.length;
    let finalTotalSpentLakhs =
      totalSpent != null
        ? Number(totalSpent)
        : cleanSoldHistory.reduce(
            (sum: number, p: any) => sum + (p.soldAmount || p.price || 0),
            0
          );

    // Execute single, strictly awaited PostgreSQL transaction
    if (process.env.DATABASE_URL) {
      await prisma.$transaction(async (tx) => {
        // 1. Find or create Room record
        let dbRoom = await tx.room.findUnique({
          where: { code: roomCode },
          include: {
            squadPlayers: true,
            poolPlayers: true,
          },
        });

        // Defensive recovery: If client and RAM had 0 sold players, inspect existing DB squadPlayers
        if (cleanSoldHistory.length === 0 && dbRoom?.squadPlayers) {
          const existingBought = dbRoom.squadPlayers.filter(
            (sp) => !sp.isRetained
          );
          if (existingBought.length > 0) {
            cleanSoldHistory = existingBought.map((sp) => ({
              id: sp.id,
              name: sp.name,
              role: sp.role as any,
              country: sp.country,
              isOverseas: sp.isOverseas,
              basePrice: sp.price,
              previousTeam: (sp.franchiseCode as any) || null,
              statsSummary: `Bought by ${sp.franchiseCode}`,
              set: 'Accelerated' as any,
              status: 'SOLD' as const,
              soldTo: sp.franchiseCode as any,
              soldAmount: sp.price,
              isRetained: false,
              imageUrl: sp.imageUrl || undefined,
            }));
            finalSoldCount = cleanSoldHistory.length;
            finalTotalSpentLakhs = cleanSoldHistory.reduce(
              (sum: number, p: any) => sum + (p.soldAmount || 0),
              0
            );
          }
        }

        if (cleanUnsoldHistory.length === 0 && dbRoom?.poolPlayers) {
          const existingUnsold = dbRoom.poolPlayers.filter(
            (pp) => pp.status === 'UNSOLD'
          );
          if (existingUnsold.length > 0) {
            cleanUnsoldHistory = existingUnsold.map((pp) => ({
              id: pp.id,
              name: pp.name,
              role: pp.role as any,
              country: pp.country,
              isOverseas: pp.isOverseas,
              basePrice: pp.basePrice,
              previousTeam: null,
              statsSummary: `Base Price ₹${(pp.basePrice / 100).toFixed(2)} Cr`,
              set: pp.set as any,
              status: 'UNSOLD' as const,
              soldTo: null,
              soldAmount: null,
              imageUrl: pp.imageUrl || undefined,
            }));
            finalUnsoldCount = cleanUnsoldHistory.length;
          }
        }

        const liveState = {
          phase: 'COMPLETED',
          currentBid: 0,
          highestBidderTeam: null,
          highestBidderUserId: null,
          activePlayer: null,
          lastActionMessage: actionMessage,
          soldHistory: cleanSoldHistory,
          unsoldHistory: cleanUnsoldHistory,
          bidHistory: cleanBidHistory,
          isAuctionPaused: false,
          soldCount: finalSoldCount,
          unsoldCount: finalUnsoldCount,
          totalSpentLakhs: finalTotalSpentLakhs,
          endedAt: endedAtIso,
        };

        let existingConfig: any = {};
        if (dbRoom) {
          try {
            existingConfig = JSON.parse(dbRoom.configJson || '{}');
          } catch {}
        }

        const isSolo =
          mode === 'SOLO' ||
          roomCode.startsWith('SOLO') ||
          existingConfig.isSolo === true ||
          memRoom?.hostId?.startsWith('solo_');

        const effectiveHostEmail = hostEmail || existingConfig.hostEmail || null;
        const effectiveHostName = hostName || existingConfig.hostName || 'Auctioneer';

        const summaryConfig = {
          ...existingConfig,
          mode: isSolo ? 'SOLO' : 'MULTIPLAYER',
          isSolo,
          hostEmail: effectiveHostEmail,
          hostName: effectiveHostName,
          soldCount: finalSoldCount,
          unsoldCount: finalUnsoldCount,
          totalSpentLakhs: finalTotalSpentLakhs,
          endedAt: endedAtIso,
          status: 'COMPLETED',
        };

        if (!dbRoom) {
          dbRoom = await tx.room.create({
            data: {
              code: roomCode,
              hostId: effectiveHostEmail || (isSolo ? 'solo_host' : memRoom?.hostId || 'system_host'),
              auctioneerId: memRoom?.auctioneerId || 'auctioneer',
              status: 'COMPLETED',
              configJson: JSON.stringify(summaryConfig),
              liveStateJson: JSON.stringify(liveState),
            },
            include: {
              squadPlayers: true,
              poolPlayers: true,
            },
          });
        } else {
          dbRoom = await tx.room.update({
            where: { id: dbRoom.id },
            data: {
              status: 'COMPLETED',
              configJson: JSON.stringify(summaryConfig),
              liveStateJson: JSON.stringify(liveState),
              updatedAt: new Date(),
            },
            include: {
              squadPlayers: true,
              poolPlayers: true,
            },
          });
        }

        const roomId = dbRoom.id;

        // Upsert User and AuctionParticipant so user mapping is guaranteed
        if (effectiveHostEmail) {
          const dbUser = await tx.user.upsert({
            where: { email: effectiveHostEmail },
            update: {
              name: effectiveHostName,
              ...(isSuper ? { role: 'SUPER_ADMIN' } : {}),
            },
            create: {
              email: effectiveHostEmail,
              name: effectiveHostName,
              role: isSuper ? 'SUPER_ADMIN' : 'USER',
            },
          });

          await tx.auctionParticipant.upsert({
            where: {
              roomCode_userEmail: {
                roomCode,
                userEmail: effectiveHostEmail,
              },
            },
            update: {
              userName: effectiveHostName,
              userId: dbUser.id,
              role: 'AUCTIONEER',
              isCaptain: true,
              updatedAt: new Date(),
            },
            create: {
              roomId,
              roomCode,
              userEmail: effectiveHostEmail,
              userName: effectiveHostName,
              userId: dbUser.id,
              role: 'AUCTIONEER',
              isCaptain: true,
            },
          });
        }

        // 2. Persist all FranchiseTeam records
        for (const franchise of FRANCHISE_LIST) {
          const teamData = finalSquads[franchise.code];
          const remainingPurse =
            teamData?.remainingPurse ??
            IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[franchise.code]?.remainingPurse ??
            13000;

          await tx.franchiseTeam.upsert({
            where: {
              roomId_franchiseCode: {
                roomId,
                franchiseCode: franchise.code,
              },
            },
            update: {
              remainingPurse,
              maxSquadSize: 25,
              maxOverseas: 8,
            },
            create: {
              roomId,
              franchiseCode: franchise.code,
              remainingPurse,
              maxSquadSize: 25,
              maxOverseas: 8,
            },
          });
        }

        // 3. Persist SquadPlayer rows: only replace if we have non-retained players
        if (cleanSoldHistory.length > 0) {
          await tx.squadPlayer.deleteMany({
            where: {
              roomId,
              isRetained: false,
            },
          });

          await tx.squadPlayer.createMany({
            data: cleanSoldHistory.map((p: any) => ({
              roomId,
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
          });
        }

        // 4. Update AuctionPoolPlayer statuses
        for (const p of cleanSoldHistory) {
          await tx.auctionPoolPlayer.updateMany({
            where: {
              roomId,
              name: p.name,
            },
            data: {
              status: 'SOLD',
              soldToTeam: p.soldTo,
              soldPrice: p.soldAmount || p.price,
            },
          });
        }

        for (const p of cleanUnsoldHistory) {
          await tx.auctionPoolPlayer.updateMany({
            where: {
              roomId,
              name: p.name,
            },
            data: {
              status: 'UNSOLD',
            },
          });
        }
      });
    }

    // Update in-memory room as well if present
    if (memRoom) {
      memRoom.phase = 'COMPLETED';
      memRoom.activePlayer = null;
      memRoom.currentBid = 0;
      memRoom.highestBidderTeam = null;
      memRoom.highestBidderUserId = null;
      memRoom.soldHistory = cleanSoldHistory;
      memRoom.unsoldHistory = cleanUnsoldHistory;
      memRoom.lastActionMessage = actionMessage;
      // Ensure in-memory team squads also have the newly bought players
      cleanSoldHistory.forEach((p: any) => {
        const teamCode = p.soldTo as keyof typeof memRoom.teams;
        if (teamCode && memRoom.teams[teamCode]) {
          const squad = memRoom.teams[teamCode].squad;
          if (!squad.some((sp: any) => sp.id === p.id || sp.name?.toLowerCase() === p.name?.toLowerCase())) {
            squad.push(p);
          }
        }
      });
      engine.setRoomState(roomCode, memRoom);
    }

    return NextResponse.json({
      success: true,
      roomCode,
      status: 'COMPLETED',
      soldCount: finalSoldCount,
      unsoldCount: finalUnsoldCount,
      totalSpentLakhs: finalTotalSpentLakhs,
      endedAt: endedAtIso,
    });
  } catch (error: any) {
    console.error('[Complete Auction API] Error finalizing auction:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to complete auction' },
      { status: 500 }
    );
  }
}
