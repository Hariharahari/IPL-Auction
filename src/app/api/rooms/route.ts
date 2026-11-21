import { NextResponse } from 'next/server';
import { AuctionEngine } from '@/server/auctionEngine';
import { safeDbOperation } from '@/lib/db';

export async function GET() {
  try {
    const engine = AuctionEngine.getInstance();
    const ramRooms = engine.getAllRooms();

    // Also fetch rooms from PostgreSQL
    const dbRooms = await safeDbOperation(async (client) => {
      return await client.room.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 30,
        include: {
          squadPlayers: true,
          poolPlayers: true,
          teams: true,
        },
      });
    }, []);

    const sessionMap = new Map<string, {
      roomCode: string;
      status: string;
      phase: string;
      soldCount: number;
      unsoldCount: number;
      totalSpentLakhs: number;
      totalPlayers: number;
      lastActionMessage: string;
      updatedAt: number;
      createdAt: number;
    }>();

    // 1. Process DB rooms
    (dbRooms || []).forEach((r) => {
      let liveState: any = {};
      try {
        liveState = JSON.parse(r.liveStateJson || '{}');
      } catch {}

      const soldCount =
        (liveState.soldHistory && liveState.soldHistory.length) ||
        r.squadPlayers.filter((sp) => !sp.isRetained).length;

      const unsoldCount =
        (liveState.unsoldHistory && liveState.unsoldHistory.length) ||
        r.poolPlayers.filter((pp) => pp.status === 'UNSOLD').length;

      const totalSpentLakhs = r.squadPlayers
        .filter((sp) => !sp.isRetained)
        .reduce((sum, p) => sum + (p.price || 0), 0);

      sessionMap.set(r.code, {
        roomCode: r.code,
        status: r.status,
        phase: liveState.phase || (r.status === 'ACTIVE' ? 'IDLE' : 'LOBBY'),
        soldCount,
        unsoldCount,
        totalSpentLakhs,
        totalPlayers: (r.squadPlayers.length || 0) + (r.poolPlayers.length || 0),
        lastActionMessage: liveState.lastActionMessage || 'Session saved in database',
        updatedAt: r.updatedAt.getTime(),
        createdAt: r.createdAt.getTime(),
      });
    });

    // 2. Overlay live RAM rooms (latest in-memory state)
    ramRooms.forEach((r) => {
      const code = r.roomCode || r.code || '';
      if (!code) return;

      const soldCount = r.soldHistory?.length || 0;
      const unsoldCount = r.unsoldHistory?.length || 0;
      const totalSpentLakhs = (r.soldHistory || []).reduce((sum, p) => sum + (p.soldAmount || 0), 0);

      sessionMap.set(code, {
        roomCode: code,
        status: r.phase === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE',
        phase: r.phase,
        soldCount,
        unsoldCount,
        totalSpentLakhs,
        totalPlayers: r.allPlayers?.length || 0,
        lastActionMessage: r.lastActionMessage || 'Live auction active',
        updatedAt: Date.now(),
        createdAt: Date.now(),
      });
    });

    const sessions = Array.from(sessionMap.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error: unknown) {
    console.error('Failed to fetch rooms list:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
