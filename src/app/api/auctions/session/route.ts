import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { FRANCHISE_LIST } from '@/data/franchises';
import { IPL_2027_MINI_AUCTION_PURSE_DEFAULTS } from '@/server/rules';
import { isSuperAdminEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      roomCode: rawCode,
      mode = 'MULTIPLAYER',
      hostEmail: rawEmail,
      hostName = 'Auctioneer',
      settings = {},
    } = body;

    const roomCode = rawCode?.trim().toUpperCase();
    if (!roomCode) {
      return NextResponse.json({ error: 'roomCode is required' }, { status: 400 });
    }

    const hostEmail = rawEmail?.trim().toLowerCase() || null;
    const isSolo = mode === 'SOLO' || roomCode.startsWith('SOLO');
    const isSuper = isSuperAdminEmail(hostEmail);

    const configData = {
      mode: isSolo ? 'SOLO' : 'MULTIPLAYER',
      isSolo,
      hostEmail,
      hostName,
      status: 'ACTIVE',
      soldCount: 0,
      unsoldCount: 0,
      totalSpentLakhs: 0,
      initialPurse: settings.initialPurse || 13000,
      maxSquadSize: settings.maxSquadSize || 25,
      minSquadSize: settings.minSquadSize || 0,
      maxOverseas: settings.maxOverseas || 8,
      bidTimerSeconds: settings.bidTimerSeconds || 15,
      biddingPermission: settings.biddingPermission || 'ANY_MEMBER',
      createdAt: new Date().toISOString(),
    };

    const liveStateData = {
      phase: 'LOBBY',
      currentBid: 0,
      highestBidderTeam: null,
      highestBidderUserId: null,
      activePlayer: null,
      lastActionMessage: isSolo
        ? 'Solo Test Arena initialized'
        : 'Multiplayer Auction Lobby initialized',
      soldHistory: [],
      unsoldHistory: [],
      bidHistory: [],
      isAuctionPaused: false,
      soldCount: 0,
      unsoldCount: 0,
      totalSpentLakhs: 0,
    };

    if (process.env.DATABASE_URL) {
      await prisma.$transaction(async (tx) => {
        // 1. Upsert Room record
        const dbRoom = await tx.room.upsert({
          where: { code: roomCode },
          update: {
            hostId: hostEmail || (isSolo ? 'solo_host' : 'system_host'),
            status: 'ACTIVE',
            configJson: JSON.stringify(configData),
            liveStateJson: JSON.stringify(liveStateData),
            updatedAt: new Date(),
          },
          create: {
            code: roomCode,
            hostId: hostEmail || (isSolo ? 'solo_host' : 'system_host'),
            status: 'ACTIVE',
            configJson: JSON.stringify(configData),
            liveStateJson: JSON.stringify(liveStateData),
          },
        });

        // 2. Upsert User & AuctionParticipant if email provided
        if (hostEmail) {
          const dbUser = await tx.user.upsert({
            where: { email: hostEmail },
            update: {
              name: hostName,
              ...(isSuper ? { role: 'SUPER_ADMIN' } : {}),
            },
            create: {
              email: hostEmail,
              name: hostName,
              role: isSuper ? 'SUPER_ADMIN' : 'USER',
            },
          });

          await tx.auctionParticipant.upsert({
            where: {
              roomCode_userEmail: {
                roomCode,
                userEmail: hostEmail,
              },
            },
            update: {
              userName: hostName,
              userId: dbUser.id,
              role: 'AUCTIONEER',
              isCaptain: true,
              updatedAt: new Date(),
            },
            create: {
              roomId: dbRoom.id,
              roomCode,
              userEmail: hostEmail,
              userName: hostName,
              userId: dbUser.id,
              role: 'AUCTIONEER',
              isCaptain: true,
            },
          });
        }

        // 3. Initialize FranchiseTeam rows with default purses
        for (const f of FRANCHISE_LIST) {
          const defaultPurse =
            IPL_2027_MINI_AUCTION_PURSE_DEFAULTS[f.code]?.remainingPurse ?? 13000;
          await tx.franchiseTeam.upsert({
            where: {
              roomId_franchiseCode: {
                roomId: dbRoom.id,
                franchiseCode: f.code,
              },
            },
            update: {
              remainingPurse: defaultPurse,
              maxSquadSize: settings.maxSquadSize || 25,
              maxOverseas: settings.maxOverseas || 8,
            },
            create: {
              roomId: dbRoom.id,
              franchiseCode: f.code,
              remainingPurse: defaultPurse,
              maxSquadSize: settings.maxSquadSize || 25,
              maxOverseas: settings.maxOverseas || 8,
            },
          });
        }
      });
    }

    return NextResponse.json({
      success: true,
      roomCode,
      mode: isSolo ? 'SOLO' : 'MULTIPLAYER',
      status: 'ACTIVE',
    });
  } catch (error: any) {
    console.error('[Session API] Error initializing auction session:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to initialize session' },
      { status: 500 }
    );
  }
}
