import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomCode, userId, userName, role, franchiseCode } = body;

    if (!roomCode || !userId || !userName) {
      return NextResponse.json(
        { error: 'Missing required fields: roomCode, userId, userName' },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    // Check for demo mode / placeholder keys
    const isDemo =
      !apiKey ||
      !apiSecret ||
      !wsUrl ||
      apiKey.includes('your_api_key') ||
      apiSecret.includes('your_api_secret') ||
      wsUrl.includes('your-project');

    if (isDemo) {
      return NextResponse.json({
        demoMode: true,
        message: 'LiveKit credentials are not configured. Running in Voice & Video Demo Mode.',
        mainToken: null,
        teamToken: null,
        serverUrl: null,
      });
    }

    // 1. Mint Token for Main Auction Hall (Public Room)
    const mainRoomName = `ipl_${roomCode.toUpperCase()}_main`;
    const canPublishMain = role === 'AUCTIONEER' || role === 'TEAM_MEMBER' || role === 'HOST';

    const mainTokenObj = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: userName,
    });
    mainTokenObj.addGrant({
      room: mainRoomName,
      roomJoin: true,
      canPublish: canPublishMain,
      canSubscribe: true,
    });
    const mainToken = await mainTokenObj.toJwt();

    // 2. Mint Token for Private Franchise Huddle Room
    // STRICT ISOLATION: Auctioneer and Spectators NEVER receive a teamToken for huddle rooms
    let teamToken: string | null = null;
    const isAuctioneerOrSpectator = role === 'AUCTIONEER' || role === 'SPECTATOR' || role === 'HOST';

    if (!isAuctioneerOrSpectator && role === 'TEAM_MEMBER' && franchiseCode) {
      const teamRoomName = `ipl_${roomCode.toUpperCase()}_team_${franchiseCode}`;
      const teamTokenObj = new AccessToken(apiKey, apiSecret, {
        identity: userId,
        name: userName,
      });
      teamTokenObj.addGrant({
        room: teamRoomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      });
      teamToken = await teamTokenObj.toJwt();
    }

    return NextResponse.json({
      demoMode: false,
      serverUrl: wsUrl,
      mainToken,
      teamToken,
    });
  } catch (error: unknown) {
    console.error('Failed to mint LiveKit token:', error);
    return NextResponse.json(
      {
        demoMode: true,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 200 }
    );
  }
}
