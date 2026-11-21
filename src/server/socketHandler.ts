import { Server as SocketIOServer, Socket } from 'socket.io';
import { AuctionEngine } from './auctionEngine';
import { ChatMessage, FranchiseCode, Player, RoomSettings } from '@/types/auction';
import { persistChatMessage } from './dbService';

export function setupSocketHandler(io: SocketIOServer) {
  const engine = AuctionEngine.getInstance();

  // Wire up state engine notifications to broadcast over Socket.io
  engine.registerStateChangeCallback((roomCode, state, eventName, eventData) => {
    io.to(`room_${roomCode}`).emit(eventName, eventData ?? state);
  });

  io.on('connection', (socket: Socket) => {
    // 1. Create Room
    socket.on(
      'room:create',
      (
        data: {
          hostId: string;
          hostName: string;
          settings?: Partial<RoomSettings>;
        },
        callback?: (res: { success: boolean; roomCode?: string; error?: string }) => void
      ) => {
        try {
          const room = engine.createRoom(data.hostId, data.hostName, socket.id, data.settings);
          socket.join(`room_${room.roomCode}`);
          if (callback) callback({ success: true, roomCode: room.roomCode });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to create room';
          if (callback) callback({ success: false, error: message });
        }
      }
    );

    // 2. Join Room & Room Presence
    socket.on(
      'room:join',
      async (
        data: {
          roomCode: string;
          userId: string;
          userName: string;
          userEmail?: string;
          teamAccessCode?: string;
        },
        callback?: (res: { success: boolean; room?: unknown; user?: unknown; error?: string }) => void
      ) => {
        const result = await engine.joinRoom(
          data.roomCode,
          data.userId,
          data.userName,
          socket.id,
          data.userEmail,
          data.teamAccessCode
        );
        if ('error' in result) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        const roomCode = data.roomCode.toUpperCase();
        socket.join(`room_${roomCode}`);

        // If user is already on a franchise, join team room as well
        if (result.user.franchiseCode) {
          socket.join(`room_${roomCode}_team_${result.user.franchiseCode}`);
        }

        // Direct state sync to ensure client immediately hydrates without delay
        socket.emit('state:sync', result.room);

        if (callback) {
          callback({
            success: true,
            room: result.room,
            user: result.user,
          });
        }
      }
    );

    // 2b. Remove User (Auctioneer / Host only)
    socket.on(
      'room:removeUser',
      async (
        data: { roomCode: string; requesterId: string; targetUserId: string },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = await engine.removeUser(data.roomCode, data.requesterId, data.targetUserId);
        if (callback) callback(res);
      }
    );

    // 2c. Toggle Hand Raise (For manual voice bidding)
    socket.on(
      'room:toggleHandRaise',
      (
        data: { roomCode: string; userId: string },
        callback?: (res: { success: boolean; handRaised?: boolean; error?: string }) => void
      ) => {
        const res = engine.toggleHandRaise(data.roomCode, data.userId);
        if (callback) callback(res);
      }
    );

    // 3. Assign Role / Join Franchise
    socket.on(
      'room:assignRole',
      (
        data: {
          roomCode: string;
          userId: string;
          role: 'AUCTIONEER' | 'SPECTATOR' | 'TEAM_MEMBER';
          franchiseCode?: FranchiseCode | null;
        },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const roomCode = data.roomCode.toUpperCase();
        const res = engine.assignRole(roomCode, data.userId, data.role, data.franchiseCode);

        if (res.success && data.role === 'TEAM_MEMBER' && data.franchiseCode) {
          socket.join(`room_${roomCode}_team_${data.franchiseCode}`);
        }

        if (callback) callback(res);
      }
    );

    // 4. Set Team Captain
    socket.on(
      'room:setCaptain',
      (
        data: { roomCode: string; requesterId: string; targetUserId: string },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.setTeamCaptain(data.roomCode, data.requesterId, data.targetUserId);
        if (callback) callback(res);
      }
    );

    // 5. Start Auction
    socket.on(
      'auction:start',
      (
        data: {
          roomCode: string;
          requesterId: string;
          autoNominate?: boolean;
          mode?: 'RANDOM' | 'SEQUENTIAL';
          set?: string;
        },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.startAuction(data.roomCode, data.requesterId, {
          autoNominate: data.autoNominate,
          mode: data.mode,
          set: data.set,
        });
        if (callback) callback(res);
      }
    );

    // 5b. End Auction (Auctioneer explicitly concludes)
    socket.on(
      'auction:end',
      (
        data: { roomCode: string; requesterId: string },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.endAuction(data.roomCode, data.requesterId);
        if (callback) callback(res);
      }
    );

    // 6. Nominate Player (Manual)
    socket.on(
      'auction:nominate',
      (
        data: { roomCode: string; playerId: string; auctioneerId: string },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.nominatePlayer(data.roomCode, data.playerId, data.auctioneerId);
        if (callback) callback(res);
      }
    );

    // 6b. Automatically Nominate Next Player (Random Draw or Sequential from pool/set)
    socket.on(
      'auction:nominateNext',
      (
        data: {
          roomCode: string;
          auctioneerId: string;
          mode?: 'RANDOM' | 'SEQUENTIAL';
          set?: string;
        },
        callback?: (res: { success: boolean; error?: string; player?: Player }) => void
      ) => {
        const res = engine.nominateNextPlayer(data.roomCode, data.auctioneerId, {
          mode: data.mode,
          set: data.set,
        });
        if (callback) callback(res);
      }
    );

    // 6c. Skip Player (Active on Block or from Queue)
    socket.on(
      'auction:skipPlayer',
      (
        data: {
          roomCode: string;
          auctioneerId: string;
          playerId?: string;
          autoNext?: boolean;
          mode?: 'RANDOM' | 'SEQUENTIAL';
          set?: string;
        },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.skipPlayer(data.roomCode, data.auctioneerId, data.playerId, {
          autoNext: data.autoNext,
          mode: data.mode,
          set: data.set,
        });
        if (callback) callback(res);
      }
    );

    // 7. Place Bid (Sequential Mutex Protected)
    socket.on(
      'auction:bid',
      async (
        data: { roomCode: string; userId: string; teamCode: FranchiseCode },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = await engine.placeBid(data.roomCode, data.userId, data.teamCode);
        if (callback) callback(res);
      }
    );

    // 8. Auctioneer Hammer Controls
    socket.on(
      'auction:hammerSold',
      (
        data: {
          roomCode: string;
          auctioneerId: string;
          winningTeam?: FranchiseCode;
          finalPrice?: number;
        },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.hammerSold(
          data.roomCode,
          data.auctioneerId,
          data.winningTeam,
          data.finalPrice
        );
        if (callback) callback(res);
      }
    );

    socket.on(
      'auction:hammerUnsold',
      (
        data: { roomCode: string; auctioneerId: string },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.hammerUnsold(data.roomCode, data.auctioneerId);
        if (callback) callback(res);
      }
    );

    socket.on(
      'auction:pauseTimer',
      (
        data: { roomCode: string; auctioneerId: string },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.pauseTimer(data.roomCode, data.auctioneerId);
        if (callback) callback(res);
      }
    );

    socket.on(
      'auction:resumeTimer',
      (
        data: { roomCode: string; auctioneerId: string },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.resumeTimer(data.roomCode, data.auctioneerId);
        if (callback) callback(res);
      }
    );

    // 8c. Pause & Resume Auction Toggle
    socket.on(
      'auction:togglePause',
      (
        data: { roomCode: string; auctioneerId: string },
        callback?: (res: { success: boolean; isPaused?: boolean; error?: string }) => void
      ) => {
        const res = engine.togglePauseAuction(data.roomCode, data.auctioneerId);
        if (callback) callback(res);
      }
    );

    socket.on(
      'auction:resetTimer',
      (
        data: { roomCode: string; auctioneerId: string; seconds?: number },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.resetTimer(data.roomCode, data.auctioneerId, data.seconds || 15);
        if (callback) callback(res);
      }
    );

    // 9. RTM Controls
    socket.on(
      'auction:triggerRTM',
      (
        data: { roomCode: string; auctioneerId: string },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.triggerRTM(data.roomCode, data.auctioneerId);
        if (callback) callback(res);
      }
    );

    socket.on(
      'auction:resolveRTM',
      (
        data: { roomCode: string; exercised: boolean },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.resolveRTM(data.roomCode, data.exercised);
        if (callback) callback(res);
      }
    );

    // 10. Custom Player Creation
    socket.on(
      'auction:addPlayer',
      (
        data: {
          roomCode: string;
          auctioneerId: string;
          playerData: Omit<Player, 'id' | 'status' | 'isCustom'>;
        },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = engine.addCustomPlayer(data.roomCode, data.auctioneerId, data.playerData);
        if (callback) callback(res);
      }
    );

    // 10b. Solo Testing: Simulate Bid
    socket.on(
      'auction:simulateBid',
      async (
        data: { roomCode: string; requesterId: string; teamCode: FranchiseCode },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const res = await engine.simulateBid(data.roomCode, data.requesterId, data.teamCode);
        if (callback) callback(res);
      }
    );

    // 10c. Bulk Player Pool Upload (Excel / CSV)
    socket.on(
      'auction:upload_pool',
      (
        data: {
          roomCode: string;
          requesterId: string;
          players: Array<Omit<Player, 'id' | 'status'>>;
          mode?: 'REPLACE' | 'APPEND';
        },
        callback?: (res: { success: boolean; count?: number; error?: string }) => void
      ) => {
        const res = engine.uploadPlayerPool(
          data.roomCode,
          data.requesterId,
          data.players,
          data.mode || 'APPEND'
        );
        if (callback) callback(res);
      }
    );

    socket.on(
      'auction:upload_players',
      (
        data: {
          roomCode: string;
          requesterId: string;
          players: Array<Omit<Player, 'id' | 'status'>>;
          mode?: 'REPLACE' | 'APPEND';
        },
        callback?: (res: { success: boolean; count?: number; error?: string }) => void
      ) => {
        const res = engine.uploadPlayerPool(
          data.roomCode,
          data.requesterId,
          data.players,
          data.mode || 'APPEND'
        );
        if (callback) callback(res);
      }
    );

    // 10d. Pre-Retained Squads Upload
    socket.on(
      'auction:upload_retained_squads',
      (
        data: {
          roomCode: string;
          requesterId: string;
          retainedPlayers: Array<{
            name: string;
            team: FranchiseCode;
            role: any;
            country: string;
            isOverseas: boolean;
            price?: number;
            imageUrl?: string;
            statsSummary?: string;
            remainingPurse?: number;
          }>;
          mode?: 'REPLACE' | 'APPEND';
        },
        callback?: (res: { success: boolean; count?: number; error?: string }) => void
      ) => {
        const res = engine.uploadRetainedSquads(
          data.roomCode,
          data.requesterId,
          data.retainedPlayers,
          data.mode || 'APPEND'
        );
        if (callback) callback(res);
      }
    );

    // 10e. Master Multi-sheet Excel Ingestion (TeamPurses, RetainedSquads, AuctionPool)
    socket.on(
      'auction:upload_master_excel',
      (
        data: {
          roomCode: string;
          requesterId: string;
          fileBuffer: ArrayBuffer | Buffer | string;
          mode?: 'REPLACE' | 'APPEND';
        },
        callback?: (res: {
          success: boolean;
          summary?: { pursesCount: number; retainedCount: number; poolCount: number };
          error?: string;
        }) => void
      ) => {
        try {
          let buffer: Buffer;
          if (Buffer.isBuffer(data.fileBuffer)) {
            buffer = data.fileBuffer;
          } else if (typeof data.fileBuffer === 'string') {
            const base64Data = data.fileBuffer.includes('base64,')
              ? data.fileBuffer.split('base64,')[1]
              : data.fileBuffer;
            buffer = Buffer.from(base64Data, 'base64');
          } else {
            buffer = Buffer.from(data.fileBuffer);
          }

          const res = engine.uploadMasterWorkbook(
            data.roomCode,
            data.requesterId,
            buffer,
            data.mode || 'REPLACE'
          );
          if (callback) callback(res);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to ingest master Excel';
          if (callback) callback({ success: false, error: msg });
        }
      }
    );

    // 11. Real-Time Chat (Global and Team Private)
    socket.on(
      'chat:send',
      (messageData: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        const message: ChatMessage = {
          ...messageData,
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
        };

        const roomCode = message.roomCode.toUpperCase();
        if (message.channel === 'GLOBAL') {
          io.to(`room_${roomCode}`).emit('chat:message', message);
        } else {
          // Private Team Group
          io.to(`room_${roomCode}_team_${message.channel}`).emit('chat:message', message);
        }

        // Persist to PostgreSQL asynchronously
        persistChatMessage(roomCode, message).catch(console.warn);
      }
    );

    // 12. Universal Video / Camera Broadcast for all participants
    socket.on(
      'room:camera_toggle',
      (data: {
        roomCode: string;
        userId: string;
        userName: string;
        role: string;
        franchiseCode?: string | null;
        isCameraActive: boolean;
      }) => {
        if (!data.roomCode) return;
        const roomCode = data.roomCode.toUpperCase();
        io.to(`room_${roomCode}`).emit('room:participant_camera', data);
      }
    );

    // 13. Disconnect
    socket.on('disconnect', () => {
      engine.disconnectUser(socket.id);
    });
  });
}
