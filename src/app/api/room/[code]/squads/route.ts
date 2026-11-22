import { NextRequest, NextResponse } from 'next/server';
import { safeDbOperation } from '@/lib/db';
import { AuctionEngine } from '@/server/auctionEngine';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const roomCode = code?.toUpperCase();

  if (!roomCode) {
    return NextResponse.json({ error: 'Room code required' }, { status: 400 });
  }

  // 1. Try querying PostgreSQL database via Prisma
  const dbResult = await safeDbOperation(async (client) => {
    const room = await client.room.findUnique({
      where: { code: roomCode },
      include: {
        teams: {
          include: {
            squad: true,
          },
        },
        squadPlayers: true,
      },
    });
    return room;
  }, null);

  if (dbResult) {
    return NextResponse.json({
      source: 'database',
      roomCode: dbResult.code,
      status: dbResult.status,
      teams: dbResult.teams,
      squadPlayers: dbResult.squadPlayers,
    });
  }

  // 2. Fallback to in-memory auction engine
  const engine = AuctionEngine.getInstance();
  let room = engine.getRoomState(roomCode);

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json({
    source: 'in-memory',
    roomCode: room.roomCode || room.code,
    phase: room.phase,
    teams: room.teams,
    allPlayersCount: room.allPlayers.length,
  });
}
