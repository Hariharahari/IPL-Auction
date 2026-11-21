const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const FRANCHISE_CODES = ['CSK', 'MI', 'RCB', 'KKR', 'SRH', 'RR', 'DC', 'PBKS', 'GT', 'LSG'];
const TOTAL_CAP = 13000;

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const retainedCsvPath = path.join(process.cwd(), 'public/ipl_2027_retained_players.csv');
const poolCsvPath = path.join(process.cwd(), 'public/ipl_2027_auction_pool.csv');

const wbRetained = XLSX.read(fs.readFileSync(retainedCsvPath, 'utf8'), { type: 'string' });
const rawRetained = XLSX.utils.sheet_to_json(wbRetained.Sheets[wbRetained.SheetNames[0]]);

const wbPool = XLSX.read(fs.readFileSync(poolCsvPath, 'utf8'), { type: 'string' });
const rawPool = XLSX.utils.sheet_to_json(wbPool.Sheets[wbPool.SheetNames[0]]);

const retainedSquads = rawRetained.map(r => ({
  name: String(r.Name || '').trim(),
  team: (r.Team || r.Franchise || '').toUpperCase(),
  role: r.Role || 'BAT',
  country: String(r.Country || 'India').trim(),
  isOverseas: String(r.IsOverseas).toLowerCase() === 'yes' || String(r.IsOverseas) === 'true',
  price: Number(r.Price) || 0,
  priceCr: r.Price_Cr ? Number(r.Price_Cr) : (Number(r.Price) || 0) / 100,
  imageUrl: r.ImageUrl || undefined
}));

const auctionPool = rawPool.map(r => ({
  name: String(r.Name || '').trim(),
  role: r.Role || 'BAT',
  country: String(r.Country || 'India').trim(),
  isOverseas: String(r.IsOverseas).toLowerCase() === 'yes' || String(r.IsOverseas) === 'true',
  basePrice: Number(r.BasePrice) || 20,
  set: String(r.Set || 'Accelerated').trim(),
  previousTeam: r.PreviousTeam || null,
  imageUrl: r.ImageUrl || undefined
}));

const teamPurses = {};
FRANCHISE_CODES.forEach(code => {
  teamPurses[code] = {
    remainingPurse: 13000,
    spentLakhs: 0,
    retainedCount: 0,
    overseasCount: 0,
    vacantSlots: 25,
    maxOverseasSlots: 8
  };
});

retainedSquads.forEach(p => {
  if (teamPurses[p.team]) {
    teamPurses[p.team].retainedCount += 1;
    if (p.isOverseas) teamPurses[p.team].overseasCount += 1;
    teamPurses[p.team].spentLakhs += p.price || 0;
  }
});

FRANCHISE_CODES.forEach(code => {
  const p = teamPurses[code];
  p.remainingPurse = Math.max(0, TOTAL_CAP - p.spentLakhs);
  p.vacantSlots = Math.max(0, 25 - p.retainedCount);
  p.maxOverseasSlots = Math.max(0, 8 - p.overseasCount);
});

const masterData = {
  retainedSquads,
  auctionPool,
  teamPurses,
  lastUpdated: new Date().toISOString()
};

fs.writeFileSync(path.join(DATA_DIR, 'global_master.json'), JSON.stringify(masterData, null, 2), 'utf8');

// Also seed default scheduled auction if not present
const SCHEDULES_FILE = path.join(DATA_DIR, 'scheduled_auctions.json');
if (!fs.existsSync(SCHEDULES_FILE)) {
  const defaultSchedules = [
    {
      id: 'sched-glz8pj',
      title: 'IPL 2027 Official Mini-Auction',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      roomCode: 'GLZ8PJ',
      appointedAuctioneerEmail: 'hariharan12403@gmail.com',
      appointedAuctioneerName: 'Hariharan (Chief Auctioneer)',
      teamAssignments: {
        CSK: ['hariharan12403@gmail.com'],
        MI: [],
        RCB: [],
        KKR: [],
        SRH: [],
        RR: [],
        DC: [],
        PBKS: [],
        GT: [],
        LSG: []
      },
      status: 'SCHEDULED',
      createdAt: new Date().toISOString()
    }
  ];
  fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(defaultSchedules, null, 2), 'utf8');
}

console.log('Successfully seeded data/global_master.json and data/scheduled_auctions.json');
