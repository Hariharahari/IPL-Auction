import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AuctionEngine } from '@/server/auctionEngine';
import { FRANCHISE_LIST } from '@/data/franchises';
import { IPL_2027_MINI_AUCTION_PURSE_DEFAULTS } from '@/server/rules';

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
      soldPlayers = [],
      unsoldPlayers = [],
      squads = {},
      logs = [],
      bidHistory = [],
      totalSpent,
      lastActionMessage,
    } = body;

    const engine = AuctionEngine.getInstance();
    const memRoom = engine.getRoomState(roomCode);

    // Merge in-memory server state with client fallback payload
    // Ensure no pre-retained players contaminate soldHistory
    const rawSold =
      soldPlayers && soldPlayers.length > 0
        ? soldPlayers
        : memRoom?.soldHistory || [];
    const cleanSoldHistory = rawSold.filter((p: any) => !p.isRetained);

    const cleanUnsoldHistory =
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

    const soldCount = cleanSoldHistory.length;
    const unsoldCount = cleanUnsoldHistory.length;
    const totalSpentLakhs =
      totalSpent != null
        ? Number(totalSpent)
        : cleanSoldHistory.reduce(
            (sum: number, p: any) => sum + (p.soldAmount || p.price || 0),
            0
          );

    const endedAtIso = new Date().toISOString();
    const actionMessage =
      lastActionMessage ||
      '🏆 LIVE AUCTION OFFICIALLY CONCLUDED! All franchises and final squad rosters are locked.';

    // Execute single, strictly awaited PostgreSQL transaction
    if (process.env.DATABASE_URL) {
      await prisma.$transaction(async (tx) => {
        // 1. Find or create Room record
        let dbRoom = await tx.room.findUnique({
          where: { code: roomCode },
        });

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
          soldCount,
          unsoldCount,
          totalSpentLakhs,
          endedAt: endedAtIso,
        };

        const summaryConfig = {
          soldCount,
          unsoldCount,
          totalSpentLakhs,
          endedAt: endedAtIso,
          status: 'COMPLETED',
        };

        if (!dbRoom) {
          dbRoom = await tx.room.create({
            data: {
              code: roomCode,
              hostId: memRoom?.hostId || 'system_host',
              auctioneerId: memRoom?.auctioneerId || 'auctioneer',
              status: 'COMPLETED',
              configJson: JSON.stringify(summaryConfig),
              liveStateJson: JSON.stringify(liveState),
            },
          });
        } else {
          let existingConfig = {};
          try {
            existingConfig = JSON.parse(dbRoom.configJson || '{}');
          } catch {}

          dbRoom = await tx.room.update({
            where: { id: dbRoom.id },
            data: {
              status: 'COMPLETED',
              configJson: JSON.stringify({ ...existingConfig, ...summaryConfig }),
              liveStateJson: JSON.stringify(liveState),
              updatedAt: new Date(),
            },
          });
        }

        const roomId = dbRoom.id;

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

        // 3. Persist SquadPlayer rows: delete non-retained players first to prevent duplication
        await tx.squadPlayer.deleteMany({
          where: {
            roomId,
            isRetained: false,
          },
        });

        if (cleanSoldHistory.length > 0) {
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
    }

    return NextResponse.json({
      success: true,
      roomCode,
      status: 'COMPLETED',
      soldCount,
      unsoldCount,
      totalSpentLakhs,
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
