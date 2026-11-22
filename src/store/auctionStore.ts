import { create } from 'zustand';
import {
  AuctionRoomState,
  BoughtPlayer,
  ChatMessage,
  FranchiseCode,
  MemberRole,
  Player,
  PlayerRole,
  RoomSettings,
  RoomUser,
  UserRole,
} from '@/types/auction';
import { getSocket } from '@/lib/socketClient';
import { getStoredUser } from '@/lib/utils';
import { livekitClient } from '@/lib/livekitClient';

export type MicRouting = 'MUTED' | 'TEAM' | 'MAIN';

interface AuctionStoreState {
  // Current client identity
  userId: string;
  userName: string;
  role: UserRole;
  franchiseCode: FranchiseCode | null;
  teamRole?: MemberRole;
  isHost: boolean;

  // Room state
  roomCode: string | null;
  room: AuctionRoomState | null;
  isConnected: boolean;
  connectionError: string | null;

  // Real-time chat
  messages: ChatMessage[];
  unreadTeamCount: number;
  unreadGlobalCount: number;
  activeChatTab: 'GLOBAL' | 'TEAM';
  latestIncomingMessage: ChatMessage | null;
  clearLatestIncomingMessage: () => void;
  resetUnreadChat: () => void;

  // Audio / Comms routing
  micRoute: MicRouting;
  isTeammateSpeaking: boolean;
  activeSpeakers: Set<string>;
  isCameraActive: boolean;
  activeCameras: Array<{
    userId: string;
    userName: string;
    role: string;
    franchiseCode?: FranchiseCode | null;
    isCameraActive: boolean;
  }>;
  latestSoldPlayer: {
    player: BoughtPlayer;
    winningTeam: FranchiseCode;
    finalAmount: number;
    message?: string;
  } | null;
  isHandRaised: boolean;

  // Actions
  setIdentity: (name: string) => void;
  clearLatestSoldPlayer: () => void;
  setActiveChatTab: (tab: 'GLOBAL' | 'TEAM') => void;
  setMicRoute: (route: MicRouting) => void;
  setIsTeammateSpeaking: (speaking: boolean) => void;
  setIsCameraActive: (active: boolean) => void;
  addActiveSpeaker: (identity: string) => void;
  removeActiveSpeaker: (identity: string) => void;

  // Socket action triggers
  initSocket: (roomCode: string) => void;
  createRoom: (
    hostName: string,
    settings?: Partial<RoomSettings>
  ) => Promise<{ success: boolean; roomCode?: string; error?: string }>;
  joinRoom: (
    roomCode: string,
    userName: string,
    userEmail?: string,
    teamAccessCode?: string
  ) => Promise<{ success: boolean; error?: string }>;
  removeUser: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  toggleHandRaise: () => Promise<{ success: boolean; handRaised?: boolean; error?: string }>;
  claimRole: (
    role: 'AUCTIONEER' | 'SPECTATOR' | 'TEAM_MEMBER',
    franchiseCode?: FranchiseCode | null
  ) => Promise<{ success: boolean; error?: string }>;
  appointTempAuctioneer: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  transferGavel: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  leaveAuction: () => Promise<{ success: boolean }>;
  setCaptain: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  startAuction: (options?: {
    autoNominate?: boolean;
    mode?: 'RANDOM' | 'SEQUENTIAL';
    set?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  endAuction: () => Promise<{ success: boolean; error?: string }>;
  nominatePlayer: (playerId: string) => Promise<{ success: boolean; error?: string }>;
  nominateNext: (options?: {
    mode?: 'RANDOM' | 'SEQUENTIAL';
    set?: string;
  }) => Promise<{ success: boolean; error?: string; player?: Player }>;
  skipPlayer: (
    playerId?: string,
    options?: { autoNext?: boolean; mode?: 'RANDOM' | 'SEQUENTIAL'; set?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  placeBid: () => Promise<{ success: boolean; error?: string }>;
  hammerSold: (options?: {
    winningTeam?: FranchiseCode;
    finalPrice?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  hammerUnsold: () => Promise<{ success: boolean; error?: string }>;
  pauseTimer: () => Promise<{ success: boolean; error?: string }>;
  resumeTimer: () => Promise<{ success: boolean; error?: string }>;
  togglePauseAuction: () => Promise<{ success: boolean; isPaused?: boolean; error?: string }>;
  resetTimer: (seconds?: number) => Promise<{ success: boolean; error?: string }>;
  triggerRTM: () => Promise<{ success: boolean; error?: string }>;
  resolveRTM: (exercised: boolean) => Promise<{ success: boolean; error?: string }>;
  simulateBid: (teamCode: FranchiseCode) => Promise<{ success: boolean; error?: string }>;
  uploadPlayerPool: (
    players: Array<Omit<Player, 'id' | 'status'>>,
    mode?: 'REPLACE' | 'APPEND'
  ) => Promise<{ success: boolean; count?: number; error?: string }>;
  uploadRetainedSquads: (
    retainedPlayers: Array<{
      name: string;
      team: FranchiseCode;
      role: PlayerRole;
      country: string;
      isOverseas: boolean;
      price?: number;
      imageUrl?: string;
      statsSummary?: string;
      remainingPurse?: number;
    }>,
    mode?: 'REPLACE' | 'APPEND'
  ) => Promise<{ success: boolean; count?: number; error?: string }>;
  uploadMasterExcel: (
    fileBuffer: ArrayBuffer | string,
    mode?: 'REPLACE' | 'APPEND'
  ) => Promise<{
    success: boolean;
    summary?: { pursesCount: number; retainedCount: number; poolCount: number };
    error?: string;
  }>;
  addCustomPlayer: (
    playerData: Omit<Player, 'id' | 'status' | 'isCustom'>
  ) => Promise<{ success: boolean; error?: string }>;
  sendChatMessage: (content: string, channel: 'GLOBAL' | FranchiseCode) => void;
}

export const useAuctionStore = create<AuctionStoreState>((set, get) => {
  const session = getStoredUser();

  return {
    userId: session.userId,
    userName: session.userName,
    role: 'SPECTATOR',
    franchiseCode: null,
    teamRole: undefined,
    isHost: false,

    roomCode: null,
    room: null,
    isConnected: false,
    connectionError: null,

    messages: [],
    unreadTeamCount: 0,
    unreadGlobalCount: 0,
    activeChatTab: 'GLOBAL',
    latestIncomingMessage: null,

    micRoute: 'MUTED',
    isTeammateSpeaking: false,
    activeSpeakers: new Set(),
    isCameraActive: false,
    activeCameras: [],
    latestSoldPlayer: null,
    isHandRaised: false,

    setIdentity: (name: string) => {
      set({ userName: name });
    },

    clearLatestSoldPlayer: () => {
      set({ latestSoldPlayer: null });
    },

    setIsCameraActive: (active: boolean) => {
      set({ isCameraActive: active });
      const socket = getSocket();
      const { roomCode, userId, userName, role, franchiseCode } = get();
      if (roomCode) {
        socket.emit('room:camera_toggle', {
          roomCode,
          userId,
          userName,
          role,
          franchiseCode,
          isCameraActive: active,
        });
      }
    },

    setActiveChatTab: (tab: 'GLOBAL' | 'TEAM') => {
      if (tab === 'GLOBAL') {
        set({ activeChatTab: 'GLOBAL', unreadGlobalCount: 0 });
      } else {
        set({ activeChatTab: 'TEAM', unreadTeamCount: 0 });
      }
    },

    clearLatestIncomingMessage: () => {
      set({ latestIncomingMessage: null });
    },

    resetUnreadChat: () => {
      set({ unreadGlobalCount: 0, unreadTeamCount: 0 });
    },

    setMicRoute: (route: MicRouting) => {
      set({ micRoute: route });
      livekitClient.setMicRoute(route);
    },

    setIsTeammateSpeaking: (speaking: boolean) => {
      set({ isTeammateSpeaking: speaking });
    },

    addActiveSpeaker: (identity: string) => {
      set((state) => {
        const next = new Set(state.activeSpeakers);
        next.add(identity);
        return { activeSpeakers: next };
      });
    },

    removeActiveSpeaker: (identity: string) => {
      set((state) => {
        const next = new Set(state.activeSpeakers);
        next.delete(identity);
        return { activeSpeakers: next };
      });
    },

    initSocket: (targetRoomCode: string) => {
      const socket = getSocket();
      const code = targetRoomCode.toUpperCase();
      set({ roomCode: code });

      // Clean up previous listeners to prevent duplicates
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('state:sync');
      socket.off('chat:message');
      socket.off('bid:accepted');
      socket.off('player:nominated');
      socket.off('player:sold');
      socket.off('player:unsold');
      socket.off('auction:ended');
      socket.off('room:participant_camera');
      socket.off('user:hand_raised');
      socket.off('user:removed');
      socket.off('lobby:state_updated');
      socket.off('room:participants_updated');
      socket.off('user:joined');
      socket.off('user:left');

      socket.on(
        'room:participant_camera',
        (data: {
          userId: string;
          userName: string;
          role: string;
          franchiseCode?: FranchiseCode | null;
          isCameraActive: boolean;
        }) => {
          set((state) => {
            const list = state.activeCameras.filter((c) => c.userId !== data.userId);
            if (data.isCameraActive) {
              list.push(data);
            }
            return { activeCameras: list };
          });
        }
      );

      socket.on('user:hand_raised', (data: { userId: string; handRaised: boolean; userName: string }) => {
        set((state) => {
          if (!state.room) return {};
          const users = { ...state.room.users };
          if (users[data.userId]) {
            users[data.userId] = { ...users[data.userId], handRaised: data.handRaised };
          }
          const isMe = data.userId === state.userId;
          return {
            room: { ...state.room, users },
            ...(isMe ? { isHandRaised: data.handRaised } : {}),
          };
        });
      });

      socket.on('user:removed', (data: { userId: string; userName: string }) => {
        if (data.userId === get().userId) {
          set({ connectionError: 'You have been removed from this auction room by the Host.' });
        }
        set((state) => {
          if (!state.room) return {};
          const users = { ...state.room.users };
          delete users[data.userId];
          return { room: { ...state.room, users } };
        });
      });

      const performJoin = () => {
        let { userId, userName } = get();
        if (!userId) {
          const stored = getStoredUser();
          userId = stored.userId;
          userName = userName || stored.userName;
          set({ userId, userName });
        }
        if (userId && code) {
          const stored = getStoredUser();
          const storedPin =
            typeof window !== 'undefined'
              ? sessionStorage.getItem(`ipl_team_pin_${code}`) || undefined
              : undefined;
          get().joinRoom(code, userName || stored.userName || 'Guest', stored.userEmail, storedPin);
        }
      };

      // 1. If socket is already connected, join immediately
      if (socket.connected) {
        set({ isConnected: true, connectionError: null });
        performJoin();
      }

      // 2. On connect / reconnect, join
      socket.on('connect', () => {
        set({ isConnected: true, connectionError: null });
        performJoin();
      });

      socket.on('disconnect', () => {
        set({ isConnected: false });
      });

      socket.on('connect_error', (err) => {
        set({ connectionError: err.message, isConnected: false });
      });

      // Synchronize full room state
      socket.on('state:sync', (updatedRoom: AuctionRoomState) => {
        const currentUserId = get().userId;
        const myUser = updatedRoom.users[currentUserId];
        const isAuctioneer = updatedRoom.auctioneerId === currentUserId || (myUser && myUser.role === 'AUCTIONEER');
        const isHost = updatedRoom.hostId === currentUserId || (myUser && myUser.isHost);

        set({
          room: updatedRoom,
          role: isAuctioneer ? 'AUCTIONEER' : myUser ? myUser.role : get().role,
          franchiseCode: myUser ? (myUser.franchiseCode ?? null) : get().franchiseCode,
          teamRole: myUser ? myUser.teamRole : get().teamRole,
          isHost: !!isHost,
          isHandRaised: myUser ? !!myUser.handRaised : false,
        });
      });

      // Authoritative real-time lobby and participant sync without manual page refresh
      socket.on('lobby:state_updated', (data: { room?: AuctionRoomState; user?: RoomUser }) => {
        if (data?.room) {
          const currentUserId = get().userId;
          const myUser = data.room.users[currentUserId];
          const isAuctioneer = data.room.auctioneerId === currentUserId || (myUser && myUser.role === 'AUCTIONEER');
          const isHost = data.room.hostId === currentUserId || (myUser && myUser.isHost);

          set({
            room: data.room,
            role: isAuctioneer ? 'AUCTIONEER' : myUser ? myUser.role : get().role,
            franchiseCode: myUser ? (myUser.franchiseCode ?? null) : get().franchiseCode,
            teamRole: myUser ? myUser.teamRole : get().teamRole,
            isHost: !!isHost,
          });
        }
      });

      socket.on('room:participants_updated', (data: { users?: Record<string, RoomUser>; room?: AuctionRoomState }) => {
        if (data?.room) {
          set({ room: data.room });
        } else if (data?.users) {
          set((state) => {
            if (!state.room) return {};
            return {
              room: {
                ...state.room,
                users: data.users!,
              },
            };
          });
        }
      });

      socket.on('user:joined', (user: RoomUser) => {
        set((state) => {
          if (!state.room) return {};
          return {
            room: {
              ...state.room,
              users: {
                ...state.room.users,
                [user.id]: user,
              },
            },
          };
        });
      });

      socket.on('user:left', (data: { userId: string; userName: string }) => {
        set((state) => {
          if (!state.room || !state.room.users[data.userId]) return {};
          const updatedUsers = { ...state.room.users };
          updatedUsers[data.userId] = {
            ...updatedUsers[data.userId],
            isOnline: false,
          };
          return {
            room: {
              ...state.room,
              users: updatedUsers,
            },
          };
        });
      });

      // Real-time instant bid event (0ms update for bidding block)
      socket.on('bid:accepted', (payload: {
        bid: any;
        currentBid: number;
        highestBidderTeam: FranchiseCode;
        timerEndsAt: number | null;
        message: string;
      }) => {
        set((state) => {
          if (!state.room) return {};
          const currentBids = state.room.bidHistory || [];
          const exists = currentBids.some((b) => b.id === payload.bid?.id);
          const newBids = exists ? currentBids : [payload.bid, ...currentBids];

          return {
            room: {
              ...state.room,
              currentBid: payload.currentBid,
              highestBidderTeam: payload.highestBidderTeam,
              highestBidderUserId: payload.bid?.userId || state.room.highestBidderUserId,
              phase: 'BIDDING_OPEN',
              timerEndsAt: payload.timerEndsAt,
              lastActionMessage: payload.message,
              bidHistory: newBids,
            },
          };
        });
      });

      // Player Sold Celebration Event
      socket.on(
        'player:sold',
        (payload: {
          player: BoughtPlayer;
          winningTeam: FranchiseCode;
          finalAmount: number;
          message?: string;
        }) => {
          set({ latestSoldPlayer: payload });
        }
      );

      socket.on('auction:ended', () => {
        set((state) => {
          if (!state.room) return {};
          return { room: { ...state.room, phase: 'COMPLETED' } };
        });
      });

      // 3. Proactive HTTP pre-hydration for instant UI load
      if (!get().room) {
        fetch(`/api/room/${code}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.room) {
              const currentUserId = get().userId;
              const myUser = data.room.users?.[currentUserId];
              const isAuctioneer = data.room.auctioneerId === currentUserId || (myUser && myUser.role === 'AUCTIONEER');
              const isHost = data.room.hostId === currentUserId || (myUser && myUser.isHost);
              set({
                room: data.room,
                role: isAuctioneer ? 'AUCTIONEER' : myUser ? myUser.role : get().role,
                franchiseCode: myUser ? (myUser.franchiseCode ?? null) : get().franchiseCode,
                teamRole: myUser ? myUser.teamRole : get().teamRole,
                isHost: !!isHost,
              });
            }
          })
          .catch(() => {});
      }

      // Chat Messages
      socket.on('chat:message', (msg: ChatMessage) => {
        const { activeChatTab, franchiseCode } = get();
        set((state) => {
          let unreadGlobal = state.unreadGlobalCount;
          let unreadTeam = state.unreadTeamCount;

          if (msg.channel === 'GLOBAL' && activeChatTab !== 'GLOBAL') {
            unreadGlobal += 1;
          } else if (msg.channel === franchiseCode && activeChatTab !== 'TEAM') {
            unreadTeam += 1;
          }

          return {
            messages: [...state.messages, msg],
            unreadGlobalCount: unreadGlobal,
            unreadTeamCount: unreadTeam,
            latestIncomingMessage: msg,
          };
        });
      });

      if (socket.connected) {
        set({ isConnected: true });
        const { userId, userName } = get();
        if (userId && userName && code) {
          get().joinRoom(code, userName);
        }
      } else {
        socket.connect();
      }
    },

    createRoom: async (hostName: string, settings?: Partial<RoomSettings>) => {
      const socket = getSocket();
      const { userId } = get();

      return new Promise((resolve) => {
        socket.emit(
          'room:create',
          { hostId: userId, hostName, settings },
          (res: { success: boolean; roomCode?: string; error?: string }) => {
            if (res.success && res.roomCode) {
              set({
                roomCode: res.roomCode,
                userName: hostName,
                isHost: true,
                role: 'HOST',
              });
            }
            resolve(res);
          }
        );
      });
    },

    joinRoom: async (
      roomCode: string,
      userName: string,
      userEmail?: string,
      teamAccessCode?: string
    ) => {
      const socket = getSocket();
      const { userId } = get();
      const session = getStoredUser();
      const email = userEmail || session.userEmail;

      if (teamAccessCode && typeof window !== 'undefined') {
        sessionStorage.setItem(`ipl_team_pin_${roomCode.toUpperCase()}`, teamAccessCode);
      }

      return new Promise((resolve) => {
        socket.emit(
          'room:join',
          { roomCode, userId, userName, userEmail: email, teamAccessCode },
          (res: { success: boolean; room?: AuctionRoomState; user?: RoomUser; error?: string }) => {
            if (res.success && res.room && res.user) {
              set({
                room: res.room,
                roomCode: res.room.roomCode,
                userName: res.user.name,
                role: res.user.role,
                franchiseCode: res.user.franchiseCode ?? null,
                teamRole: res.user.teamRole,
                isHost: !!res.user.isHost,
                isHandRaised: !!res.user.handRaised,
              });
              resolve({ success: true });
            } else {
              resolve({ success: false, error: res.error || 'Failed to join room' });
            }
          }
        );
      });
    },

    removeUser: async (targetUserId: string) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'room:removeUser',
          { roomCode, requesterId: userId, targetUserId },
          (res: { success: boolean; error?: string }) => {
            resolve(res);
          }
        );
      });
    },

    toggleHandRaise: async () => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode || !userId) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'room:toggleHandRaise',
          { roomCode, userId },
          (res: { success: boolean; handRaised?: boolean; error?: string }) => {
            if (res.success && typeof res.handRaised === 'boolean') {
              set({ isHandRaised: res.handRaised });
            }
            resolve(res);
          }
        );
      });
    },

    claimRole: async (role: 'AUCTIONEER' | 'SPECTATOR' | 'TEAM_MEMBER', franchiseCode?: FranchiseCode | null) => {
      const socket = getSocket();
      const { roomCode, userId, franchiseCode: currentFranchise } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      // STRICT PERMANENT LOCK:
      if (currentFranchise && role === 'TEAM_MEMBER' && franchiseCode && currentFranchise !== franchiseCode) {
        return { success: false, error: `You are permanently locked to ${currentFranchise}. Team switching is disabled.` };
      }

      return new Promise((resolve) => {
        socket.emit(
          'room:assignRole',
          { roomCode, userId, role, franchiseCode },
          (res: { success: boolean; error?: string }) => {
            if (res.success) {
              set({
                role,
                franchiseCode: franchiseCode ?? null,
              });
            }
            resolve(res);
          }
        );
      });
    },

    appointTempAuctioneer: async (targetUserId: string) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:appointTempAuctioneer',
          { roomCode, requesterId: userId, targetUserId },
          (res: { success: boolean; error?: string }) => {
            resolve(res);
          }
        );
      });
    },

    transferGavel: async (targetUserId: string) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:transferGavel',
          { roomCode, requesterId: userId, targetUserId },
          (res: { success: boolean; error?: string }) => {
            resolve(res);
          }
        );
      });
    },

    leaveAuction: async () => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (roomCode && userId) {
        socket.emit('room:leave', { roomCode, userId });
      }
      livekitClient.disconnect();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ipl_active_room_code');
      }
      set({
        roomCode: null,
        room: null,
        isCameraActive: false,
        micRoute: 'MUTED',
      });
      return { success: true };
    },

    setCaptain: async (targetUserId: string) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'room:setCaptain',
          { roomCode, requesterId: userId, targetUserId },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    startAuction: async (options?: {
      autoNominate?: boolean;
      mode?: 'RANDOM' | 'SEQUENTIAL';
      set?: string;
    }) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:start',
          { roomCode, requesterId: userId, ...options },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    endAuction: async () => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:end',
          { roomCode, requesterId: userId },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    nominatePlayer: async (playerId: string) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:nominate',
          { roomCode, playerId, auctioneerId: userId },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    nominateNext: async (options?: { mode?: 'RANDOM' | 'SEQUENTIAL'; set?: string }) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:nominateNext',
          { roomCode, auctioneerId: userId, ...options },
          (res: { success: boolean; error?: string; player?: Player }) => resolve(res)
        );
      });
    },

    skipPlayer: async (
      playerId?: string,
      options?: { autoNext?: boolean; mode?: 'RANDOM' | 'SEQUENTIAL'; set?: string }
    ) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:skipPlayer',
          { roomCode, auctioneerId: userId, playerId, ...options },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    placeBid: async () => {
      const socket = getSocket();
      const { roomCode, userId, franchiseCode } = get();
      if (!roomCode || !franchiseCode) {
        return { success: false, error: 'Must belong to a franchise to bid' };
      }

      return new Promise((resolve) => {
        socket.emit(
          'auction:bid',
          { roomCode, userId, teamCode: franchiseCode },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    hammerSold: async (manualData?: { winningTeam?: FranchiseCode; finalPrice?: number }) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:hammerSold',
          {
            roomCode,
            auctioneerId: userId,
            winningTeam: manualData?.winningTeam,
            finalPrice: manualData?.finalPrice,
          },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    hammerUnsold: async () => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:hammerUnsold',
          { roomCode, auctioneerId: userId },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    pauseTimer: async () => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:pauseTimer',
          { roomCode, auctioneerId: userId },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    resumeTimer: async () => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:resumeTimer',
          { roomCode, auctioneerId: userId },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    togglePauseAuction: async () => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:togglePause',
          { roomCode, auctioneerId: userId },
          (res: { success: boolean; isPaused?: boolean; error?: string }) => resolve(res)
        );
      });
    },

    resetTimer: async (seconds = 15) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:resetTimer',
          { roomCode, auctioneerId: userId, seconds },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    triggerRTM: async () => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:triggerRTM',
          { roomCode, auctioneerId: userId },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    resolveRTM: async (exercised: boolean) => {
      const socket = getSocket();
      const { roomCode } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:resolveRTM',
          { roomCode, exercised },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    simulateBid: async (teamCode: FranchiseCode) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:simulateBid',
          { roomCode, requesterId: userId, teamCode },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    uploadPlayerPool: async (
      players: Array<Omit<Player, 'id' | 'status'>>,
      mode: 'REPLACE' | 'APPEND' = 'APPEND'
    ) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:upload_players',
          { roomCode, requesterId: userId, players, mode },
          (res: { success: boolean; count?: number; error?: string }) => resolve(res)
        );
      });
    },

    uploadRetainedSquads: async (
      retainedPlayers: Array<{
        name: string;
        team: FranchiseCode;
        role: PlayerRole;
        country: string;
        isOverseas: boolean;
        price?: number;
        imageUrl?: string;
        statsSummary?: string;
        remainingPurse?: number;
      }>,
      mode: 'REPLACE' | 'APPEND' = 'APPEND'
    ) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:upload_retained_squads',
          { roomCode, requesterId: userId, retainedPlayers, mode },
          (res: { success: boolean; count?: number; error?: string }) => resolve(res)
        );
      });
    },

    uploadMasterExcel: async (
      fileBuffer: ArrayBuffer | string,
      mode: 'REPLACE' | 'APPEND' = 'REPLACE'
    ) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:upload_master_excel',
          { roomCode, requesterId: userId, fileBuffer, mode },
          (res: {
            success: boolean;
            summary?: { pursesCount: number; retainedCount: number; poolCount: number };
            error?: string;
          }) => resolve(res)
        );
      });
    },

    addCustomPlayer: async (playerData: Omit<Player, 'id' | 'status' | 'isCustom'>) => {
      const socket = getSocket();
      const { roomCode, userId } = get();
      if (!roomCode) return { success: false, error: 'No active room' };

      return new Promise((resolve) => {
        socket.emit(
          'auction:addPlayer',
          { roomCode, auctioneerId: userId, playerData },
          (res: { success: boolean; error?: string }) => resolve(res)
        );
      });
    },

    sendChatMessage: (content: string, channel: 'GLOBAL' | FranchiseCode) => {
      const socket = getSocket();
      const { roomCode, userId, userName, role, franchiseCode } = get();
      if (!roomCode || !content.trim()) return;

      socket.emit('chat:send', {
        roomCode,
        channel,
        senderId: userId,
        senderName: userName,
        senderRole: role,
        franchiseCode,
        content: content.trim(),
      });
    },
  };
});
