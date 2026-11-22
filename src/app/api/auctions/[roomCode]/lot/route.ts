import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { FranchiseCode } from '@/types/auction';

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
      eventType, // 'SOLD' | 'UNSOLD'
      player,
      winningTeam,
      finalPrice,
      newRemainingPurse,
    } = body;

    if (!player || !player.name) {
      return NextResponse.json({ error: 'Player data required' }, { status: 400 });
    }

    if (process.env.DATABASE_URL) {
      await prisma.$transaction(async (tx) => {
        // Ensure Room exists
        let dbRoom = await tx.room.findUnique({
          where: { code: roomCode },
        });

        if (!dbRoom) {
          dbRoom = await tx.room.create({
            data: {
              code: roomCode,
              hostId: 'system_host',
              status: 'ACTIVE',
            },
          });
        }

        const roomId = dbRoom.id;

        if (eventType === 'SOLD' && winningTeam) {
          // 1. Create SquadPlayer entry for winning team
          await tx.squadPlayer.create({
            data: {
              roomId,
              franchiseCode: winningTeam,
              name: player.name,
              role: player.role || 'BAT',
              country: player.country || 'India',
              isOverseas: !!player.isOverseas,
              price: finalPrice || player.soldAmount || 0,
              isRetained: false,
              imageUrl: player.imageUrl || null,
            },
          });

          // 2. Update FranchiseTeam remaining purse
          if (newRemainingPurse !== undefined && newRemainingPurse !== null) {
            await tx.franchiseTeam.updateMany({
              where: {
                roomId,
                franchiseCode: winningTeam,
              },
              data: {
                remainingPurse: Number(newRemainingPurse),
              },
            });
          }

          // 3. Update AuctionPoolPlayer
          await tx.auctionPoolPlayer.updateMany({
            where: {
              roomId,
              name: player.name,
            },
            data: {
              status: 'SOLD',
              soldToTeam: winningTeam,
              soldPrice: finalPrice || player.soldAmount || 0,
            },
          });

          // 4. Update liveStateJson with incremental soldHistory
          let liveState: any = {};
          try {
            liveState = JSON.parse(dbRoom.liveStateJson || '{}');
          } catch {}

          const soldHistory = (liveState.soldHistory || []).filter(
            (p: any) => !p.isRetained && p.name !== player.name
          );
          soldHistory.unshift({
            ...player,
            status: 'SOLD',
            soldTo: winningTeam,
            soldAmount: finalPrice || player.soldAmount || 0,
            isRetained: false,
          });

          await tx.room.update({
            where: { id: roomId },
            data: {
              status: 'ACTIVE',
              liveStateJson: JSON.stringify({
                ...liveState,
                soldHistory,
                lastActionMessage: `SOLD! ${player.name} bought by ${winningTeam} for ₹${(
                  (finalPrice || 0) / 100
                ).toFixed(2)} Cr!`,
              }),
              updatedAt: new Date(),
            },
          });
        } else if (eventType === 'UNSOLD') {
          // 1. Update AuctionPoolPlayer
          await tx.auctionPoolPlayer.updateMany({
            where: {
              roomId,
              name: player.name,
            },
            data: {
              status: 'UNSOLD',
            },
          });

          // 2. Update liveStateJson with incremental unsoldHistory
          let liveState: any = {};
          try {
            liveState = JSON.parse(dbRoom.liveStateJson || '{}');
          } catch {}

          const unsoldHistory = (liveState.unsoldHistory || []).filter(
            (p: any) => p.name !== player.name
          );
          unsoldHistory.unshift({
            ...player,
            status: 'UNSOLD',
            soldTo: null,
            soldAmount: null,
          });

          await tx.room.update({
            where: { id: roomId },
            data: {
              status: 'ACTIVE',
              liveStateJson: JSON.stringify({
                ...liveState,
                unsoldHistory,
                lastActionMessage: `UNSOLD! ${player.name} passed unsold at base price ₹${(
                  (player.basePrice || 20) / 100
                ).toFixed(2)} Cr.`,
              }),
              updatedAt: new Date(),
            },
          });
        }
      });
    }

    return NextResponse.json({
      success: true,
      roomCode,
      eventType,
      playerName: player.name,
    });
  } catch (error: any) {
    console.error('[Lot API] Error persisting lot:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to persist lot' },
      { status: 500 }
    );
  }
}
