import { NextRequest, NextResponse } from 'next/server';
import {
  getGlobalMasterData,
  updateGlobalAuctionPool,
  updateGlobalRetainedSquads,
} from '@/server/globalMasterStore';
import { isAdmin, SUPER_ADMIN_EMAIL } from '@/server/scheduleService';
import { auctionEngine } from '@/server/auctionEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target, mode = 'REPLACE', players, adminEmail } = body;

    // Optional admin security check (allow during initial onboarding or verify email)
    if (adminEmail && !isAdmin(adminEmail)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only admin (hariharan12403@gmail.com) can manage global squads' },
        { status: 403 }
      );
    }

    if (!Array.isArray(players) || players.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No player data provided in upload payload' },
        { status: 400 }
      );
    }

    let result;
    if (target === 'RETAINED_SQUADS') {
      result = updateGlobalRetainedSquads(players, mode);

      // If active rooms exist, propagate the update
      try {
        const rooms = auctionEngine.getActiveRooms();
        for (const room of rooms) {
          const c = room.roomCode || room.code;
          if (!c) continue;
          auctionEngine.uploadRetainedSquads(
            c,
            room.hostId || 'admin',
            players.map((p) => ({
              name: p.name,
              team: p.team,
              role: p.role,
              country: p.country,
              isOverseas: p.isOverseas,
              price: p.price,
              imageUrl: p.imageUrl,
            })),
            mode
          );
        }
      } catch (e) {
        console.warn('Error syncing running rooms with global retained squad', e);
      }

      return NextResponse.json({
        success: true,
        target: 'RETAINED_SQUADS',
        count: players.length,
        totalSquad: result.retainedSquads.length,
        message: `Successfully updated server master squad (${players.length} players ${mode === 'REPLACE' ? 'replaced' : 'appended'}).`,
      });
    } else if (target === 'AUCTION_POOL') {
      result = updateGlobalAuctionPool(players, mode);

      // If active rooms exist, propagate the update
      try {
        const rooms = auctionEngine.getActiveRooms();
        for (const room of rooms) {
          const c = room.roomCode || room.code;
          if (!c) continue;
          auctionEngine.uploadPlayerPool(
            c,
            room.hostId || 'admin',
            players.map((p) => ({
              name: p.name,
              role: p.role,
              country: p.country,
              isOverseas: p.isOverseas,
              basePrice: p.basePrice,
              set: p.set,
              previousTeam: p.previousTeam || null,
              statsSummary: `${p.role} • ${p.country}`,
              isCustom: true,
              imageUrl: p.imageUrl,
            })),
            mode
          );
        }
      } catch (e) {
        console.warn('Error syncing running rooms with global auction pool', e);
      }

      return NextResponse.json({
        success: true,
        target: 'AUCTION_POOL',
        count: players.length,
        totalPool: result.auctionPool.length,
        message: `Successfully updated server auction pool (${players.length} players ${mode === 'REPLACE' ? 'replaced' : 'appended'}).`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid target: must be RETAINED_SQUADS or AUCTION_POOL' },
        { status: 400 }
      );
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Global upload failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const data = getGlobalMasterData();
    return NextResponse.json({
      success: true,
      retainedCount: data.retainedSquads.length,
      poolCount: data.auctionPool.length,
      retainedSquads: data.retainedSquads,
      auctionPool: data.auctionPool,
      teamPurses: data.teamPurses,
      lastUpdated: data.lastUpdated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch global master data' },
      { status: 500 }
    );
  }
}
