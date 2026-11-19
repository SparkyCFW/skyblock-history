// Records Hypixel SkyBlock Bazaar prices into bazaar-history.json (hourly averages, last 7 days).
// Runs on GitHub Actions every hour (see .github/workflows/record.yml). Only public Bazaar data is stored.
//
// File format (kept compact so the scanner page can download it quickly):
// {
//   v: 1, updated: <ms>,
//   hours: [<hour start in ms>, ...],                 // oldest -> newest
//   items: { ITEM_ID: [[topBuyOrder per hour...], [lowestSellOffer per hour...]] }   // null = no data that hour
// }
import fs from 'node:fs';

const FILE = 'bazaar-history.json';
const KEEP_HOURS = 168;            // 7 days, matching the scanner's "usual price"
const HOUR = 3600000;
const SAMPLES = 4;                 // average a few snapshots so one odd moment doesn't skew the hour
const SAMPLE_GAP_MS = 70000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function snapshot() {
  const res = await fetch('https://api.hypixel.net/v2/skyblock/bazaar');
  const j = await res.json();
  if (!j.success) throw new Error(j.cause || 'Hypixel API error');
  const out = {};
  for (const [id, p] of Object.entries(j.products)) {
    const bo = p.sell_summary?.[0]?.pricePerUnit;   // top buy order
    const so = p.buy_summary?.[0]?.pricePerUnit;    // lowest sell offer
    if (bo != null && so != null) out[id] = [bo, so];
  }
  return { t: j.lastUpdated, out };
}

const samples = [];
for (let i = 0; i < SAMPLES; i++) {
  try { samples.push(await snapshot()); } catch (e) { console.log('sample failed:', e.message); }
  if (i < SAMPLES - 1) await sleep(SAMPLE_GAP_MS);
}
if (!samples.length) { console.log('No data from Hypixel this run.'); process.exit(1); }

let data = { v: 1, hours: [], items: {} };
try {
  const old = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (old && Array.isArray(old.hours) && old.items) data = old;
} catch { console.log('No previous history found, starting fresh.'); }

const hour = Math.floor(samples[0].t / HOUR) * HOUR;

// average the samples per item
const avg = {};
for (const s of samples) for (const [id, [bo, so]] of Object.entries(s.out)) {
  const a = avg[id] || (avg[id] = [0, 0, 0]);
  a[0] += bo; a[1] += so; a[2]++;
}
const round = x => +x.toPrecision(5);

let idx = data.hours.indexOf(hour);
if (idx < 0) {
  data.hours.push(hour);
  idx = data.hours.length - 1;
  for (const id in data.items) { data.items[id][0].push(null); data.items[id][1].push(null); }
}
for (const [id, [bsum, ssum, n]] of Object.entries(avg)) {
  let it = data.items[id];
  if (!it) it = data.items[id] = [data.hours.map(() => null), data.hours.map(() => null)];
  it[0][idx] = round(bsum / n);
  it[1][idx] = round(ssum / n);
}

// keep only the last KEEP_HOURS hours
while (data.hours.length > KEEP_HOURS || (data.hours.length && data.hours[0] <= hour - KEEP_HOURS * HOUR)) {
  data.hours.shift();
  for (const id in data.items) { data.items[id][0].shift(); data.items[id][1].shift(); }
}
for (const id in data.items) if (data.items[id][0].every(x => x == null)) delete data.items[id];

data.updated = Date.now();
fs.writeFileSync(FILE, JSON.stringify(data));
console.log(`Saved hour ${new Date(hour).toISOString()}: ${Object.keys(avg).length} items from ${samples.length} samples; ${data.hours.length} hours stored.`);
