import { AuctionRoomState, FranchiseCode, RoomAccessCodes, RoomUser } from '@/types/auction';

export function generateRoomAccessCodes(): RoomAccessCodes {
  const gen4 = () => Math.floor(1000 + Math.random() * 9000).toString();
  const franchises: Record<FranchiseCode, string> = {
    CSK: `CSK-${gen4()}`,
    MI: `MI-${gen4()}`,
    RCB: `RCB-${gen4()}`,
    KKR: `KKR-${gen4()}`,
    SRH: `SRH-${gen4()}`,
    RR: `RR-${gen4()}`,
    DC: `DC-${gen4()}`,
    PBKS: `PBKS-${gen4()}`,
    GT: `GT-${gen4()}`,
    LSG: `LSG-${gen4()}`,
  };
  return {
    franchises,
    spectator: `SPEC-${gen4()}`,
  };
}

export interface BidValidationResult {
  valid: boolean;
  error?: string;
  nextBidAmount?: number;
}

/**
 * Official IPL 2027 Mini-Auction Team Purses & Vacancies
 * Based on ₹125 Cr purse + ₹5 Cr performance cap = ₹130 Cr total auction purse.
 * Values in Lakhs (e.g. 4745 = ₹47.45 Cr).
 */
export const IPL_2027_MINI_AUCTION_PURSE_DEFAULTS: Record<
  FranchiseCode,
  { remainingPurse: number; vacantSlots: number; maxOverseasSlots: number }
> = {
  LSG: { remainingPurse: 4745, vacantSlots: 7, maxOverseasSlots: 3 },
  KKR: { remainingPurse: 4165, vacantSlots: 8, maxOverseasSlots: 3 },
  SRH: { remainingPurse: 4015, vacantSlots: 7, maxOverseasSlots: 3 },
  DC: { remainingPurse: 3950, vacantSlots: 9, maxOverseasSlots: 4 },
  MI: { remainingPurse: 3260, vacantSlots: 9, maxOverseasSlots: 2 },
  CSK: { remainingPurse: 2805, vacantSlots: 6, maxOverseasSlots: 2 },
  RR: { remainingPurse: 2705, vacantSlots: 6, maxOverseasSlots: 3 },
  PBKS: { remainingPurse: 1860, vacantSlots: 6, maxOverseasSlots: 2 },
  RCB: { remainingPurse: 1415, vacantSlots: 5, maxOverseasSlots: 1 },
  GT: { remainingPurse: 875, vacantSlots: 3, maxOverseasSlots: 2 },
};

/**
 * Server-Authoritative Dynamic IPL Bid Increment Slabs:
 * - Base Price to < ₹1.00 Cr (100 Lakhs): +₹5 Lakh
 * - ₹1.00 Cr to < ₹2.00 Cr (200 Lakhs): +₹10 Lakh
 * - ₹2.00 Cr to < ₹5.00 Cr (500 Lakhs): +₹20 Lakh
 * - ₹5.00 Cr and above (500+ Lakhs): +₹25 Lakh
 */
export function getNextBidAmount(
  currentBid: number,
  hasBids: boolean,
  basePrice: number
): number {
  if (!hasBids || currentBid <= 0) {
    return basePrice;
  }

  let increment = 5;
  if (currentBid < 100) {
    increment = 5;
  } else if (currentBid < 200) {
    increment = 10;
  } else if (currentBid < 500) {
    increment = 20;
  } else {
    increment = 25;
  }

  return currentBid + increment;
}

/**
 * Strict Server-Side Bid Validation
 * Reject bids if remainingPurse < nextBidAmount, squad.length >= 25,
 * player.isOverseas && overseasCount >= 8, or bidderTeam === highestBidderTeam.
 */
export function validateBid(
  room: AuctionRoomState,
  teamCode: FranchiseCode,
  user: RoomUser
): BidValidationResult {
  // 1. Stage phase check
  const allowedPhases = ['BIDDING_OPEN', 'GOING_ONCE', 'GOING_TWICE'];
  if (!allowedPhases.includes(room.phase)) {
    return {
      valid: false,
      error: `Bidding is closed in current stage (${room.phase.replace('_', ' ')})`,
    };
  }

  // Active player check
  const player = room.activePlayer;
  if (!player) {
    return {
      valid: false,
      error: 'No active player is currently on the auction block',
    };
  }

  // 2. Bidding permission (Captain only rule if enabled)
  if (
    room.settings.biddingPermission === 'CAPTAIN_ONLY' &&
    user.teamRole !== 'CAPTAIN'
  ) {
    return {
      valid: false,
      error: 'Only the designated Team Captain can place bids in this room',
    };
  }

  // 3. Consecutive bid check (Cannot outbid your own team)
  if (room.highestBidderTeam === teamCode) {
    return {
      valid: false,
      error: 'Your franchise already holds the highest bid',
    };
  }

  const team = room.teams[teamCode];
  if (!team) {
    return {
      valid: false,
      error: `Franchise ${teamCode} not found in room state`,
    };
  }

  const hasBids = room.highestBidderTeam !== null;
  const nextBid = getNextBidAmount(room.currentBid, hasBids, player.basePrice);

  // 4. Remaining purse check
  if (team.remainingPurse < nextBid) {
    return {
      valid: false,
      error: `Insufficient purse! Next bid requires ₹${(nextBid / 100).toFixed(2)} Cr, but ${team.name} only has ₹${(team.remainingPurse / 100).toFixed(2)} Cr`,
    };
  }

  // 5. Maximum squad size check (25 players max)
  const maxSquad = room.settings.maxSquadSize || 25;
  if (team.squad.length >= maxSquad) {
    return {
      valid: false,
      error: `Maximum squad limit of ${maxSquad} players reached for ${team.name}`,
    };
  }

  // 6. Maximum overseas check (8 overseas max)
  const maxOverseas = room.settings.maxOverseas || 8;
  if (player.isOverseas && team.overseasCount >= maxOverseas) {
    return {
      valid: false,
      error: `Overseas quota full! Maximum ${maxOverseas} overseas players allowed per squad`,
    };
  }

  // 7. Optional Minimum Floor Reserve Check (only if minSquadSize explicitly enabled > 0)
  if (room.settings.minSquadSize && room.settings.minSquadSize > 0) {
    const remainingMandatorySlots = Math.max(
      0,
      room.settings.minSquadSize - (team.squad.length + 1)
    );
    const requiredReserve = remainingMandatorySlots * 20; // ₹20L base minimum per mandatory slot
    if (requiredReserve > 0 && team.remainingPurse - nextBid < requiredReserve) {
      return {
        valid: false,
        error: `Purse reserve violation! Must reserve at least ₹${(requiredReserve / 100).toFixed(2)} Cr to reach your minimum squad floor`,
      };
    }
  }

  return {
    valid: true,
    nextBidAmount: nextBid,
  };
}
