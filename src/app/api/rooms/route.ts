import { NextResponse } from 'next/server';
import { AuctionEngine } from '@/server/auctionEngine';
import { safeDbOperation } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
      mode: 'Solo Test' | 'Multiplayer';
      status: 'Completed' | 'In Progress';
      phase: string;
      soldCount: number;
      unsoldCount: number;
      totalAuctioned: number;
      totalSpentLakhs: number;
      totalPlayers: number;
      participatingTeams: string[];
      lastActionMessage: string;
      updatedAt: number;
      createdAt: number;
      formattedDate: string;
    }>();

    // 1. Process DB rooms
    (dbRooms || []).forEach((r) => {
      let liveState: any = {};
      let config: any = {};
      try {
        liveState = JSON.parse(r.liveStateJson || '{}');
      } catch {}
      try {
        config = JSON.parse(r.configJson || '{}');
      } catch {}

      const soldCount =
        (config.soldCount != null ? Number(config.soldCount) : null) ??
        (liveState.soldCount != null ? Number(liveState.soldCount) : null) ??
        (liveState.soldHistory ? liveState.soldHistory.filter((p: any) => !p.isRetained).length : null) ??
        r.squadPlayers.filter((sp) => !sp.isRetained).length;

      const unsoldCount =
        (config.unsoldCount != null ? Number(config.unsoldCount) : null) ??
        (liveState.unsoldCount != null ? Number(liveState.unsoldCount) : null) ??
        (liveState.unsoldHistory ? liveState.unsoldHistory.length : null) ??
        r.poolPlayers.filter((pp) => pp.status === 'UNSOLD').length;

      const totalSpentLakhs =
        (config.totalSpentLakhs != null ? Number(config.totalSpentLakhs) : null) ??
        (liveState.totalSpentLakhs != null ? Number(liveState.totalSpentLakhs) : null) ??
        (liveState.soldHistory ? liveState.soldHistory.filter((p: any) => !p.isRetained).reduce((sum: number, p: any) => sum + (p.soldAmount || 0), 0) : null) ??
        r.squadPlayers
          .filter((sp) => !sp.isRetained)
          .reduce((sum, p) => sum + (p.price || 0), 0);

      const isSolo =
        r.code.startsWith('SOLO') ||
        config.isSolo === true ||
        r.hostId.startsWith('solo_');

      const participatingTeams = Array.from(
        new Set([
          ...r.teams.map((t) => t.franchiseCode),
          ...r.squadPlayers.filter((sp) => !sp.isRetained).map((sp) => sp.franchiseCode),
        ])
      );

      const d = r.updatedAt || r.createdAt;
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      }).format(d);

      sessionMap.set(r.code, {
        roomCode: r.code,
        mode: isSolo ? 'Solo Test' : 'Multiplayer',
        status:
          r.status === 'COMPLETED' ||
          liveState.phase === 'COMPLETED' ||
          config.status === 'COMPLETED'
            ? 'Completed'
            : 'In Progress',
        phase: liveState.phase || (r.status === 'ACTIVE' ? 'IDLE' : 'LOBBY'),
        soldCount,
        unsoldCount,
        totalAuctioned: soldCount + unsoldCount,
        totalSpentLakhs,
        totalPlayers: (r.squadPlayers.length || 0) + (r.poolPlayers.length || 0),
        participatingTeams: participatingTeams.length > 0 ? participatingTeams : ['CSK', 'MI', 'RCB', 'KKR', 'SRH'],
        lastActionMessage: liveState.lastActionMessage || 'Session saved in database',
        updatedAt: r.updatedAt.getTime(),
        createdAt: r.createdAt.getTime(),
        formattedDate,
      });
    });

    // 2. Overlay live RAM rooms (latest in-memory state)
    ramRooms.forEach((r) => {
      const code = r.roomCode || r.code || '';
      if (!code) return;

      const existingDb = sessionMap.get(code);
      // Never allow an in-memory stub to downgrade a Completed DB room or wipe out real sold counts
      if (existingDb) {
        if (existingDb.status === 'Completed' && r.phase !== 'COMPLETED') {
          return;
        }
        if (existingDb.soldCount > 0 && (r.soldHistory || []).filter((p) => !p.isRetained).length === 0) {
          return;
        }
      }

      const soldCount = (r.soldHistory || []).filter((p) => !p.isRetained).length;
      const unsoldCount = r.unsoldHistory?.length || 0;
      const totalSpentLakhs = (r.soldHistory || [])
        .filter((p) => !p.isRetained)
        .reduce((sum, p) => sum + (p.soldAmount || 0), 0);

      const isSolo =
        code.startsWith('SOLO') ||
        r.hostId.startsWith('solo_') ||
        (Object.keys(r.users).length <= 1 && !r.auctioneerId);

      const teamsWithAcquisitions = Object.values(r.teams || {})
        .filter((t) => (t.squad || []).some((p) => !p.isRetained))
        .map((t) => t.code as string);
      const teamsWithUsers = Array.from(
        new Set(
          Object.values(r.users || {})
            .map((u) => u.franchiseCode)
            .filter(Boolean) as string[]
        )
      );
      const participatingTeams = Array.from(
        new Set([...teamsWithAcquisitions, ...teamsWithUsers])
      );

      const formattedDate = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      }).format(new Date());

      sessionMap.set(code, {
        roomCode: code,
        mode: isSolo ? 'Solo Test' : 'Multiplayer',
        status: r.phase === 'COMPLETED' ? 'Completed' : 'In Progress',
        phase: r.phase,
        soldCount,
        unsoldCount,
        totalAuctioned: soldCount + unsoldCount,
        totalSpentLakhs,
        totalPlayers: r.allPlayers?.length || 0,
        participatingTeams: participatingTeams.length > 0 ? participatingTeams : ['CSK', 'MI', 'RCB', 'KKR', 'SRH'],
        lastActionMessage: r.lastActionMessage || 'Live auction active',
        updatedAt: Date.now(),
        createdAt: Date.now(),
        formattedDate,
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
