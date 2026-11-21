// Records Hypixel SkyBlock Bazaar prices into bazaar-history.json (hourly averages, last 7 days).
// Runs on GitHub Actions every hour (see .github/workflows/record.yml). Only public Bazaar data is stored.
//
// File format (kept compact so the scanner page can download it quickly):
// {
//   v: 1, updated: <ms>,
//   hours: [<hour start in ms>, ...],                 // oldest -> newest
//   n: [<runs averaged into each hour>, ...],
//   items: { ITEM_ID: [[topBuyOrder per hour...], [lowestSellOffer per hour...]] }   // null = no data that hour
// }
// The workflow is scheduled several times an hour because GitHub skips many scheduled runs.
// Every run that lands in the same hour is averaged into that hour.
import fs from 'node:fs';

const FILE = 'bazaar-history.json';
const KEEP_HOURS = 168;            // 7 days, matching the scanner's "usual price"
const HOUR = 3600000;
const SAMPLES = 2;                 // average a couple of snapshots so one odd moment doesn't skew the run
const SAMPLE_GAP_MS = 60000;

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
if (!Array.isArray(data.n) || data.n.length !== data.hours.length) data.n = data.hours.map(() => 1);  // older files

const hour = Math.floor(samples[0].t / HOUR) * HOUR;

// average the samples per item
const avg = {};
for (const s of samples) for (const [id, [bo, so]] of Object.entries(s.out)) {
  const a = avg[id] || (avg[id] = [0, 0, 0]);
  a[0] += bo; a[1] += so; a[2]++;
}
const round = x => +x.toPrecision(5);

let idx = data.hours.indexOf(hour);
let runsBefore = 0;                        // runs already averaged into this hour
if (idx < 0) {
  // insert in time order (a delayed run could belong to an earlier hour)
  idx = data.hours.findIndex(h => h > hour); if (idx < 0) idx = data.hours.length;
  data.hours.splice(idx, 0, hour);
  data.n.splice(idx, 0, 0);
  for (const id in data.items) { data.items[id][0].splice(idx, 0, null); data.items[id][1].splice(idx, 0, null); }
} else runsBefore = data.n[idx] || 1;
for (const [id, [bsum, ssum, n]] of Object.entries(avg)) {
  let it = data.items[id];
  if (!it) it = data.items[id] = [data.hours.map(() => null), data.hours.map(() => null)];
  const bo = bsum / n, so = ssum / n;
  const k = it[0][idx] == null ? 0 : runsBefore;           // average with earlier runs this hour
  it[0][idx] = round(k ? (it[0][idx] * k + bo) / (k + 1) : bo);
  it[1][idx] = round(k ? (it[1][idx] * k + so) / (k + 1) : so);
}
data.n[idx] = runsBefore + 1;

// keep only the last KEEP_HOURS hours
while (data.hours.length > KEEP_HOURS || (data.hours.length && data.hours[0] <= hour - KEEP_HOURS * HOUR)) {
  data.hours.shift(); data.n.shift();
  for (const id in data.items) { data.items[id][0].shift(); data.items[id][1].shift(); }
}
for (const id in data.items) if (data.items[id][0].every(x => x == null)) delete data.items[id];

data.updated = Date.now();
fs.writeFileSync(FILE, JSON.stringify(data));
console.log(`Saved hour ${new Date(hour).toISOString()} (run ${data.n[data.hours.indexOf(hour)]} this hour): ${Object.keys(avg).length} items from ${samples.length} samples; ${data.hours.length} hours stored.`);
