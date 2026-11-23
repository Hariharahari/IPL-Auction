import { NextRequest, NextResponse } from 'next/server';
import { AuctionEngine } from '@/server/auctionEngine';
import { restoreRoomState } from '@/server/dbService';
import { getAuctionByCode } from '@/server/scheduleService';
import { getConductedSession } from '@/server/conductedStore';

export const dynamic = 'force-dynamic';

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
      engine.setRoomState(roomCode, restored);
    }
  }

  // If not in PostgreSQL, restore from conductedStore backup
  if (!room) {
    const session = getConductedSession(roomCode);
    if (session) {
      const created = engine.createRoom('system_host', session.hostName || 'IPL Auction System', 'system_sock', undefined, roomCode);
      created.phase = 'COMPLETED';
      created.soldHistory = (session.soldPlayers || []).filter(
        (p: any) => !p.isRetained && p.set !== 'Retained' && !p.id?.startsWith('ret_')
      );
      created.unsoldHistory = session.unsoldPlayers || [];
      created.bidHistory = session.bidHistory || [];
      created.lastActionMessage = session.lastActionMessage || 'Auction Concluded';
      if (session.squads && Object.keys(session.squads).length > 0) {
        Object.keys(session.squads).forEach((tCode) => {
          const tc = tCode as keyof typeof created.teams;
          if (created.teams[tc] && session.squads![tCode]) {
            created.teams[tc] = {
              ...created.teams[tc],
              ...session.squads![tCode],
            };
          }
        });
      }
      room = created;
      engine.setRoomState(roomCode, created);
    }
  }

  if (!room) {
    const scheduled = getAuctionByCode(roomCode);
    if (scheduled || roomCode === 'GLZ8PJ') {
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
