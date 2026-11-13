// Sixty Winters shared-world server: graves of the fallen, and candles lit for them.
// Zero dependencies. State is one JSON file; swap for a database before real scale.
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const PORT = Number(process.env.PORT ?? 8787);
const FILE = process.env.DATA_FILE ?? new URL('./world.json', import.meta.url).pathname;
const MAX_PER_REGION = 200;

/** shades: public record + private owner. candles: shadeId -> { from ids, unclaimed count }. */
const db = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { shades: [], candles: {} };
let dirty = false;
setInterval(() => { if (dirty) { writeFileSync(FILE, JSON.stringify(db)); dirty = false; } }, 2000).unref();

const text = (v, max) => String(v ?? '').replace(/[<>&"\u0000-\u001f]/g, '').slice(0, max);
const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || lo));
const idOk = (v) => typeof v === 'string' && /^[\w-]{6,64}$/.test(v);

function cleanShade(s) {
  if (!s || !idOk(s.id)) return null;
  return {
    id: s.id, house: text(s.house, 24), name: text(s.name, 24), ageY: num(s.ageY, 16, 120),
    cause: text(s.cause, 40), week: num(s.week, 0, 99999), region: num(s.region, 0, 99),
    might: num(s.might, 1, 60), lore: num(s.lore, 1, 60), epitaph: text(s.epitaph, 80), gen: num(s.gen, 1, 9999),
  };
}

const routes = {
  'GET /v1/shades': (q) => {
    const week = Number(q.get('week'));
    // Newest first, so fresh graves are the ones the realm shows. Owners are never sent.
    return db.shades.filter((x) => x.shade.week === week).map((x) => x.shade).reverse();
  },
  'POST /v1/shades': (_q, body) => {
    const shade = cleanShade(body.shade);
    if (!shade || !idOk(body.owner) || db.shades.some((x) => x.shade.id === shade.id)) return null;
    db.shades.push({ owner: body.owner, shade });
    const same = db.shades.filter((x) => x.shade.week === shade.week && x.shade.region === shade.region);
    if (same.length > MAX_PER_REGION) db.shades.splice(db.shades.indexOf(same[0]), 1);
    return { ok: true };
  },
  'POST /v1/candles': (_q, body) => {
    const entry = db.shades.find((x) => x.shade.id === body.shadeId);
    if (!entry || !idOk(body.from) || entry.owner === body.from) return null;
    const c = (db.candles[entry.shade.id] ??= { from: [], unclaimed: 0 });
    if (!c.from.includes(body.from)) { c.from.push(body.from); c.unclaimed++; }
    return { ok: true };
  },
  'POST /v1/candles/claim': (_q, body) => {
    if (!idOk(body.owner)) return null;
    const out = [];
    for (const x of db.shades) {
      const c = db.candles[x.shade.id];
      if (x.owner === body.owner && c?.unclaimed) { out.push({ shadeId: x.shade.id, count: c.unclaimed }); c.unclaimed = 0; }
    }
    return out;
  },
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  const route = routes[`${req.method} ${url.pathname}`];
  if (!route) return res.writeHead(404).end();
  let body = {};
  if (req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 4096) return res.writeHead(413).end(); }
    try { body = JSON.parse(raw); } catch { return res.writeHead(400).end(); }
  }
  const out = route(url.searchParams, body ?? {});
  if (out === null) return res.writeHead(400).end();
  if (req.method === 'POST') dirty = true;
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
}).listen(PORT, () => console.log(`Sixty Winters world server on :${PORT}`));
