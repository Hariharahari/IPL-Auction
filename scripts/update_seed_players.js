const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const csvPath = path.join(__dirname, '../public/ipl_2027_auction_pool.csv');
const csvData = fs.readFileSync(csvPath, 'utf8');
const wb = XLSX.read(csvData, { type: 'string' });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const formatted = rows.map((r, i) => ({
  id: 'pool_' + String(i + 1).padStart(3, '0'),
  name: r.Name,
  role: r.Role,
  country: r.Country,
  isOverseas: String(r.IsOverseas).toLowerCase() === 'yes',
  basePrice: Number(r.BasePrice) || 20,
  set: r.Set || 'Accelerated',
  previousTeam: r.PreviousTeam || null,
  statsSummary: `${r.Role} • ${r.Country}${r.PreviousTeam ? ' • Ex-' + r.PreviousTeam : ''}`,
  status: 'UPCOMING',
}));

const code = `import { Player } from '@/types/auction';

export const SEED_PLAYERS: Player[] = ${JSON.stringify(formatted, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '../src/data/players.ts'), code, 'utf8');
console.log(`Updated src/data/players.ts with ${formatted.length} latest auction pool players!`);
