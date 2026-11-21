export type FranchiseCode =
  | 'CSK'
  | 'MI'
  | 'RCB'
  | 'KKR'
  | 'SRH'
  | 'RR'
  | 'DC'
  | 'PBKS'
  | 'GT'
  | 'LSG';

export type PlayerRole = 'BAT' | 'BOWL' | 'AR' | 'WK';

export type PlayerSet =
  | 'Marquee'
  | 'Batters'
  | 'All-Rounders'
  | 'Wicketkeepers'
  | 'Fast Bowlers'
  | 'Spinners'
  | 'Accelerated'
  | (string & {});

export type PlayerStatus = 'UPCOMING' | 'NOMINATED' | 'SOLD' | 'UNSOLD' | 'SKIPPED';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  country: string;
  isOverseas: boolean;
  basePrice: number; // in Lakhs (e.g. 200 = 2.00 Cr)
  previousTeam: FranchiseCode | null;
  statsSummary: string;
  set: PlayerSet;
  status: PlayerStatus;
  soldTo?: FranchiseCode | null;
  soldAmount?: number | null;
  isCustom?: boolean;
  isRetained?: boolean;
  imageUrl?: string;
}

export interface BoughtPlayer extends Player {
  soldTo: FranchiseCode;
  soldAmount: number;
  isRetained?: boolean;
}

export interface Franchise {
  code: FranchiseCode;
  name: string;
  shortName: string;
  city: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  crestUrl?: string;
}

export type UserRole = 'HOST' | 'AUCTIONEER' | 'TEAM_MEMBER' | 'SPECTATOR';
export type MemberRole = 'CAPTAIN' | 'MEMBER';
export type BiddingPermission = 'ANY_MEMBER' | 'CAPTAIN_ONLY';

export interface RoomUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  franchiseCode?: FranchiseCode | null;
  teamRole?: MemberRole;
  isHost?: boolean;
  socketId: string;
  joinedAt: number;
  isOnline: boolean;
  handRaised?: boolean;
  isTempAuctioneer?: boolean;
}

export type AuctionPhase =
  | 'LOBBY'
  | 'IDLE'
  | 'PLAYER_NOMINATED'
  | 'BIDDING_OPEN'
  | 'GOING_ONCE'
  | 'GOING_TWICE'
  | 'RTM_PENDING'
  | 'SOLD'
  | 'UNSOLD'
  | 'COMPLETED';

export interface RoomSettings {
  initialPurse: number; // in Lakhs (e.g., 10000 = ₹100.00 Cr)
  maxSquadSize: number; // default 25
  minSquadSize: number; // default 18
  maxOverseas: number; // default 8
  rtmCardsPerTeam: number; // default 2
  bidTimerSeconds: number; // default 15
  biddingPermission: BiddingPermission;
}

export interface TeamState {
  code: FranchiseCode;
  name: string;
  shortName?: string;
  remainingPurse: number; // in Lakhs
  rtmCardsRemaining: number;
  squad: BoughtPlayer[];
  overseasCount: number;
  captainId?: string;
}

export interface BidRecord {
  id: string;
  playerId: string;
  amount: number; // in Lakhs
  teamCode: FranchiseCode;
  teamName: string;
  userId: string;
  userName: string;
  timestamp: number;
}

export interface RTMSituation {
  playerId: string;
  playerName: string;
  highestBid: number;
  highestBidderTeam: FranchiseCode;
  originalTeam: FranchiseCode;
  rtmTimerEndsAt: number;
}

export interface RoomAccessCodes {
  franchises: Record<FranchiseCode, string>;
  spectator: string;
}

export interface AuctionRoomState {
  roomCode: string;
  code?: string;
  hostId: string;
  auctioneerId?: string | null;
  tempAuctioneerId?: string | null;
  phase: AuctionPhase;
  settings: RoomSettings;
  teams: Record<FranchiseCode, TeamState>;
  users: Record<string, RoomUser>;
  accessCodes?: RoomAccessCodes;
  activePlayer: Player | null;
  currentBid: number; // in Lakhs
  highestBidderTeam: FranchiseCode | null;
  highestBidderUserId: string | null;
  bidHistory: BidRecord[];
  soldHistory: BoughtPlayer[];
  unsoldHistory: Player[];
  allPlayers: Player[];
  timerEndsAt: number | null;
  isTimerPaused: boolean;
  isAuctionPaused?: boolean;
  remainingTimeOnPause?: number;
  rtmState: RTMSituation | null;
  lastActionMessage?: string;
}

export interface ChatMessage {
  id: string;
  roomCode: string;
  channel: 'GLOBAL' | FranchiseCode;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  franchiseCode?: FranchiseCode | null;
  content: string;
  timestamp: number;
}
