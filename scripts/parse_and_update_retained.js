const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 1. Read latest user prompt containing CSV
const raw = fs.readFileSync(path.join(__dirname, 'latest_user_prompt.txt'), 'utf8');
const lines = raw.split(/\r?\n/);
const csvLines = [];
let headerFound = false;

for (let line of lines) {
  line = line.trim();
  if (line.startsWith('Name,Team,Role')) {
    headerFound = true;
    csvLines.push('Name,Team,Role,Country,IsOverseas,Price,Price_Cr');
    continue;
  }
  if (!headerFound) continue;
  if (line.startsWith('<') || line.startsWith('The current local time')) continue;
  if (line.includes('this is new updated list')) {
    line = line.replace('this is new updated list', '').trim();
  }
  if (!line) continue;
  csvLines.push(line);
}

console.log('Total csv records (including header):', csvLines.length);

const teams = {};
const TOTAL_CAP = 13000; // 130 Cr = 13000 Lakhs

for (let i = 1; i < csvLines.length; i++) {
  const parts = csvLines[i].split(',');
  const [name, team, role, country, isOverseas, price, priceCr] = parts;
  if (!teams[team]) {
    teams[team] = { count: 0, overseas: 0, totalLakhs: 0, players: [] };
  }
  teams[team].count++;
  if (isOverseas && isOverseas.toLowerCase() === 'yes') {
    teams[team].overseas++;
  }
  const p = parseFloat(price);
  if (isNaN(p)) {
    console.error('Invalid price on line', i, csvLines[i]);
  } else {
    teams[team].totalLakhs += p;
  }
  teams[team].players.push({ name, role, country, isOverseas, price: p, priceCr });
}

console.log('=== Team Breakdown ===');
const calculatedPurses = {};
for (const [team, data] of Object.entries(teams)) {
  const remaining = TOTAL_CAP - data.totalLakhs;
  calculatedPurses[team] = {
    retainedCount: data.count,
    overseasCount: data.overseas,
    spentLakhs: data.totalLakhs,
    remainingPurseLakhs: remaining,
    remainingPurseCr: (remaining / 100).toFixed(2),
    vacantSlots: 25 - data.count,
    maxOverseasSlots: 8 - data.overseas
  };
  console.log(
    team.padEnd(5),
    'Squad:', String(data.count).padStart(2),
    'OS:', String(data.overseas).padStart(2),
    'Spent:', (data.totalLakhs / 100).toFixed(2).padStart(6) + ' Cr',
    'Remaining:', (remaining / 100).toFixed(2).padStart(6) + ' Cr (' + remaining + 'L)',
    'Vacant:', 25 - data.count,
    'MaxOS:', 8 - data.overseas
  );
}

// 2. Save public/ipl_2027_retained_players.csv
const fullCsvContent = csvLines.join('\n');
fs.writeFileSync(path.join(__dirname, '../public/ipl_2027_retained_players.csv'), fullCsvContent, 'utf8');
fs.writeFileSync(path.join(__dirname, '../public/sample_retained_squads_template.csv'), fullCsvContent, 'utf8');
console.log('Updated public/ipl_2027_retained_players.csv & public/sample_retained_squads_template.csv');

// 3. Read existing Auction Pool CSV
const poolCsv = fs.readFileSync(path.join(__dirname, '../public/ipl_2027_auction_pool.csv'), 'utf8');

// 4. Generate master Excel template IPL_2027_Mini_Auction_Template.xlsx
const wb = XLSX.utils.book_new();

// Sheet 1: RetainedSquads
const retainedSheetData = [
  ['Name', 'Team', 'Role', 'Country', 'IsOverseas', 'Price', 'Price_Cr']
];
for (let i = 1; i < csvLines.length; i++) {
  const p = csvLines[i].split(',');
  retainedSheetData.push([
    p[0], p[1], p[2], p[3], p[4], parseFloat(p[5]), parseFloat(p[6])
  ]);
}
const wsRetained = XLSX.utils.aoa_to_sheet(retainedSheetData);
XLSX.utils.book_append_sheet(wb, wsRetained, 'RetainedSquads');

// Sheet 2: AuctionPool
const poolLines = poolCsv.trim().split(/\r?\n/);
const poolSheetData = [];
for (const line of poolLines) {
  poolSheetData.push(line.split(','));
}
const wsPool = XLSX.utils.aoa_to_sheet(poolSheetData);
XLSX.utils.book_append_sheet(wb, wsPool, 'AuctionPool');

// Sheet 3: TeamPurses
const teamPurseData = [
  ['Franchise', 'RetainedPlayers', 'OverseasRetained', 'SpentAmountLakhs', 'SpentAmountCr', 'RemainingPurseLakhs', 'RemainingPurseCr', 'VacantSlots', 'MaxOverseasSlots']
];
const teamNamesOrder = ['CSK', 'MI', 'RCB', 'KKR', 'SRH', 'RR', 'DC', 'PBKS', 'GT', 'LSG'];
for (const t of teamNamesOrder) {
  const info = calculatedPurses[t] || { retainedCount: 0, overseasCount: 0, spentLakhs: 0, remainingPurseLakhs: 13000, remainingPurseCr: '130.00', vacantSlots: 25, maxOverseasSlots: 8 };
  teamPurseData.push([
    t,
    info.retainedCount,
    info.overseasCount,
    info.spentLakhs,
    (info.spentLakhs / 100).toFixed(2),
    info.remainingPurseLakhs,
    info.remainingPurseCr,
    info.vacantSlots,
    info.maxOverseasSlots
  ]);
}
const wsPurses = XLSX.utils.aoa_to_sheet(teamPurseData);
XLSX.utils.book_append_sheet(wb, wsPurses, 'TeamPurses');

const excelPath = path.join(__dirname, '../public/IPL_2027_Mini_Auction_Template.xlsx');
XLSX.writeFile(wb, excelPath);
console.log('Updated public/IPL_2027_Mini_Auction_Template.xlsx');

// 5. Output JSON for rules.ts
fs.writeFileSync(path.join(__dirname, 'calculated_purses.json'), JSON.stringify(calculatedPurses, null, 2), 'utf8');
console.log('Saved calculated_purses.json');
