import { NextRequest, NextResponse } from 'next/server';
import {
  deleteScheduledAuction,
  getScheduledAuctions,
  isAdmin,
  saveScheduledAuction,
  SUPER_ADMIN_EMAIL,
} from '@/server/scheduleService';
import { auctionEngine } from '@/server/auctionEngine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const userIsAdmin = isAdmin(email);

    const auctions = getScheduledAuctions();
    return NextResponse.json({
      success: true,
      isAdmin: userIsAdmin,
      superAdminEmail: SUPER_ADMIN_EMAIL,
      auctions,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      adminEmail,
      title,
      roomCode,
      scheduledAt,
      appointedAuctioneerEmail,
      appointedAuctioneerName,
      teamAssignments,
      notes,
    } = body;

    if (!isAdmin(adminEmail)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only admin (hariharan12403@gmail.com) can schedule auctions' },
        { status: 403 }
      );
    }

    if (!title || !roomCode || !scheduledAt || !appointedAuctioneerEmail) {
      return NextResponse.json(
        { success: false, error: 'Title, Room Code, Schedule Date/Time, and Appointed Auctioneer are required' },
        { status: 400 }
      );
    }

    const saved = saveScheduledAuction({
      title,
      roomCode: roomCode.trim().toUpperCase(),
      scheduledAt,
      appointedAuctioneerEmail,
      appointedAuctioneerName: appointedAuctioneerName || appointedAuctioneerEmail.split('@')[0],
      teamAssignments: teamAssignments || {},
      status: 'SCHEDULED',
      notes,
    });

    // Also pre-create or verify the room in auction engine
    try {
      const existing = auctionEngine.getRoom(saved.roomCode);
      if (!existing) {
        auctionEngine.createRoom('admin_system', 'IPL System Host', 'system_sock', undefined, saved.roomCode);
      }
    } catch (e) {
      console.warn('Pre-creating room for scheduled auction notice:', e);
    }

    return NextResponse.json({
      success: true,
      auction: saved,
      message: `Auction "${saved.title}" scheduled successfully for Room ${saved.roomCode}!`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Scheduling failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const adminEmail = searchParams.get('adminEmail');

    if (!isAdmin(adminEmail)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only admin (hariharan12403@gmail.com) can delete schedules' },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Auction ID is required' }, { status: 400 });
    }

    const ok = deleteScheduledAuction(id);
    return NextResponse.json({ success: ok });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to delete scheduled auction' },
      { status: 500 }
    );
  }
}
