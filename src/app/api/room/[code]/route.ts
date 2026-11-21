import { NextRequest, NextResponse } from 'next/server';
import { AuctionEngine } from '@/server/auctionEngine';
import { restoreRoomState } from '@/server/dbService';
import { getAuctionByCode } from '@/server/scheduleService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const roomCode = code?.toUpperCase();

  if (!roomCode) {
    return NextResponse.json({ error: 'Room code required' }, { status: 400 });
  }

  const engine = AuctionEngine.getInstance();
  let room = engine.getRoomState(roomCode);

  // If not currently in RAM, restore from PostgreSQL
  if (!room) {
    const restored = await restoreRoomState(roomCode);
    if (restored) {
      room = restored;
    }
  }

  if (!room) {
    const scheduled = getAuctionByCode(roomCode);
    if (scheduled || roomCode === 'GLZ8PJ' || (roomCode.length === 6 && /^[A-Z0-9]+$/.test(roomCode))) {
      room = engine.createRoom('system_host', 'IPL Auction System', 'system_sock', undefined, roomCode);
    }
  }

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    room,
  });
}
