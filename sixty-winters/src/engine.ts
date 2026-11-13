import { BOSSES, ELITES, ENEMIES, HEIRLOOMS, HOUSES, NAMES, TRAIT_IDS, regionName } from './content';
import type {
  Combat, EnemyDef, Game, Hero, MapNode, NodeType, PerkId, RealmMap, Shade, TraitId,
} from './types';

export const START_AGE = 16 * 4;
export const BASE_LIFE = 60 * 4;
export const BURN_COST = 4;
export const PERK_MAX = 5;

// ---------- seeded randomness (state lives in plain objects so saves replay) ----------
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rnd(r: { s: number }): number {
  r.s = (r.s + 0x6d2b79f5) | 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (r: { s: number }, a: number, b: number) => a + Math.floor(rnd(r) * (b - a + 1));
const pick = <T>(r: { s: number }, arr: readonly T[]): T => arr[Math.floor(rnd(r) * arr.length)];

/** The shared realm changes every Monday (UTC); everyone walks the same one. */
export const weekOf = (ms: number) => Math.floor((ms / 86400000 + 3) / 7);

// ---------- ageing ----------
function curve(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) { const [x0, y0] = points[i - 1]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  }
  return points[points.length - 1][1];
}
export const mightMult = (y: number) => curve([[16, 0.85], [26, 1.1], [36, 1.1], [60, 0.55], [80, 0.4]], y);
export const loreMult = (y: number) => curve([[16, 0.6], [60, 1.5], [80, 1.8]], y);
export const vigorMult = (y: number) => curve([[16, 0.9], [25, 1], [40, 1], [60, 0.7], [80, 0.5]], y);

export const ageY = (h: Hero) => Math.floor(h.age / 4);
export const seasonsLeft = (h: Hero) => Math.max(0, h.lifespan - h.age);

export function eff(g: Game) {
  const h = g.hero, y = h.age / 4;
  return {
    might: Math.round(h.might * mightMult(y)),
    lore: Math.round(h.lore * loreMult(y)),
    maxVigor: Math.round(h.maxVigor * vigorMult(y)),
    loom: Math.ceil(g.dynasty.heirloom.notches / 2),
  };
}
const has = (g: Game, t: TraitId) => g.hero.traits.includes(t);
const heal = (g: Game, n: number) => { g.hero.vigor = Math.min(eff(g).maxVigor, g.hero.vigor + Math.round(n)); };

// ---------- heroes and houses ----------
function makeHero(g: Pick<Game, 'rng' | 'dynasty'>, inherit: TraitId | null, parent: Hero | null): Hero {
  const p = g.dynasty.perks;
  const traits: TraitId[] = inherit ? [inherit] : [];
  while (traits.length < 2) { const t = pick(g.rng, TRAIT_IDS); if (!traits.includes(t)) traits.push(t); }
  const h: Hero = {
    name: pick(g.rng, NAMES.filter((n) => n !== parent?.name)),
    age: START_AGE, lifespan: BASE_LIFE + 4 * p.table,
    might: 6 + p.drill, lore: 4 + p.songs, maxVigor: 30 + 2 * p.hearth, vigor: 0,
    traits, legacy: 0, deeds: [], family: false, shade: null, kills: 0, regions: 0,
  };
  if (traits.includes('hardy')) h.maxVigor += 6;
  if (traits.includes('fierce')) h.might += 2;
  if (traits.includes('keen')) h.lore += 2;
  if (traits.includes('longlived')) h.lifespan += 20;
  // A child raised at the hearth learns the parent's best craft.
  if (inherit && parent) { if (parent.might >= parent.lore) h.might += 1; else h.lore += 1; }
  h.vigor = Math.round(h.maxVigor * vigorMult(16));
  return h;
}

export function newGame(seed: number, playerId: string): Game {
  const rng = { s: seed | 0 };
  const dynasty = {
    playerId, house: pick(rng, HOUSES), gen: 1, renown: 0,
    heirloom: { name: pick(rng, HEIRLOOMS), notches: 0 },
    ancestors: [], perks: { hearth: 0, songs: 0, drill: 0, table: 0 },
  };
  return {
    v: 1, rng, dynasty, hero: makeHero({ rng, dynasty }, null, null), run: null, phase: 'hall',
    combat: null, result: null, death: null, inherit: null, outbox: [], candlesOut: [], notices: [],
  };
}

export const PERKS: Record<PerkId, { name: string; desc: string }> = {
  hearth: { name: 'Hearthstone', desc: 'Heirs start with +2 Vigor' },
  drill: { name: 'Drilled Youth', desc: 'Heirs start with +1 Might' },
  songs: { name: 'Old Songs', desc: 'Heirs start with +1 Lore' },
  table: { name: 'Long Table', desc: 'Heirs live 1 winter longer' },
};
export const perkCost = (g: Game, id: PerkId) => 4 * (g.dynasty.perks[id] + 1);
/** Perks shape the next heir; the living hero is already who they are. */
export function buyPerk(g: Game, id: PerkId): boolean {
  const cost = perkCost(g, id);
  if (g.phase !== 'hall' || g.dynasty.perks[id] >= PERK_MAX || g.dynasty.renown < cost) return false;
  g.dynasty.renown -= cost;
  g.dynasty.perks[id]++;
  // Still at the hall before setting out: the bonus applies to this hero too.
  const h = g.hero;
  if (id === 'hearth') { h.maxVigor += 2; h.vigor += 2; }
  if (id === 'drill') h.might += 1;
  if (id === 'songs') h.lore += 1;
  if (id === 'table') h.lifespan += 4;
  return true;
}

// ---------- the shared realm ----------
export function npcShades(week: number, region: number): Shade[] {
  const r = { s: hashStr(`npc:${week}:${region}`) };
  const lines = ['Walked further than the map.', 'Kept the fire for those behind.', 'Owed the road nothing.'];
  return [0, 1].map((i) => ({
    id: `npc-${week}-${region}-${i}`, house: pick(r, HOUSES), name: pick(r, NAMES),
    ageY: int(r, 22, 58), cause: pick(r, ['the cold', 'old age', 'a Rime Knight']),
    week, region, might: 5 + 3 * region, lore: 4 + 3 * region,
    epitaph: pick(r, lines), gen: int(r, 1, 9), npc: true,
  }));
}

const EVENT_IDS = ['hermit', 'bridge', 'duel', 'orchard', 'hourglass', 'cache', 'child', 'spring'];

export function genMap(week: number, region: number, shades: Shade[]): RealmMap {
  const r = { s: hashStr(`realm:${week}:${region}`) };
  const nodes: MapNode[] = [];
  const layers: number[][] = [];
  const LAYERS = 8;
  for (let l = 0; l <= LAYERS; l++) {
    const n = l === LAYERS ? 1 : l === 0 ? 3 : int(r, 2, 3);
    const row: number[] = [];
    for (let c = 0; c < n; c++) {
      let type: NodeType = 'battle';
      const x = rnd(r);
      if (l === LAYERS) type = 'boss';
      else if (l === 4 && c === 0) type = 'village';
      else if (l === 0) type = x < 0.7 ? 'battle' : 'event';
      else if (x < 0.42) type = 'battle';
      else if (x < 0.64) type = 'event';
      else if (x < 0.78) type = 'village';
      else if (x < 0.9) type = 'shrine';
      else type = l >= 3 ? 'elite' : 'battle';
      const cost = type === 'boss' ? 4 : type === 'elite' ? 3 : int(r, 2, 3);
      const node: MapNode = { id: nodes.length, layer: l, col: c, type, cost, next: [] };
      if (type === 'event') node.eventId = pick(r, EVENT_IDS);
      nodes.push(node);
      row.push(node.id);
    }
    layers.push(row);
  }
  for (let l = 0; l < LAYERS; l++) {
    const a = layers[l], b = layers[l + 1];
    a.forEach((id, i) => {
      const j = a.length === 1 ? 0 : Math.round((i * (b.length - 1)) / (a.length - 1));
      const next = new Set([b[j]]);
      if (rnd(r) < 0.5) { const k = j + (rnd(r) < 0.5 ? -1 : 1); if (b[k] !== undefined) next.add(b[k]); }
      nodes[id].next = [...next];
    });
    b.forEach((id, j) => {
      if (!a.some((p) => nodes[p].next.includes(id))) {
        const i = Math.min(a.length - 1, Math.round((j * (a.length - 1)) / Math.max(1, b.length - 1)));
        nodes[a[i]].next.push(id);
      }
    });
  }
  // Graves of the fallen: real players first, seeded wanderers fill the gaps.
  const real = shades.filter((s) => s.region === region && s.week === week).slice(0, 2);
  const graves = [...real, ...npcShades(week, region)].slice(0, 2);
  const spots = nodes.filter((n) => n.layer >= 1 && n.layer < LAYERS && !(n.layer === 4 && n.col === 0));
  graves.forEach((s, i) => {
    const free = spots.filter((n) => n.type !== 'grave');
    const node = free[(hashStr(`${week}:${region}:${i}`)) % free.length];
    node.type = 'grave'; node.grave = s; node.cost = 2; delete node.eventId;
  });
  return { layers, nodes };
}

export function startRegion(g: Game, week: number, shades: Shade[]) {
  if (g.phase !== 'hall' && g.phase !== 'crossing') return;
  g.run = { week, region: g.hero.regions, map: genMap(week, g.hero.regions, shades), at: -1 };
  g.phase = 'map'; g.result = null; g.combat = null;
}

export const here = (g: Game): MapNode | null => (g.run && g.run.at >= 0 ? g.run.map.nodes[g.run.at] : null);
export function reachable(g: Game): number[] {
  if (!g.run || g.phase !== 'map') return [];
  return g.run.at < 0 ? g.run.map.layers[0] : g.run.map.nodes[g.run.at].next;
}
export const moveCost = (g: Game, n: MapNode) => Math.max(1, n.cost - (has(g, 'swift') ? 1 : 0));

/** Spend seasons of life. Returns true if this was the hero's last. */
function passTime(g: Game, seasons: number, cause = 'old age'): boolean {
  const h = g.hero;
  h.age += seasons;
  h.vigor = Math.min(h.vigor, eff(g).maxVigor);
  if (h.age >= h.lifespan) { die(g, cause); return true; }
  return false;
}

export function travel(g: Game, id: number) {
  if (!g.run || !reachable(g).includes(id)) return;
  const node = g.run.map.nodes[id];
  g.run.at = id;
  if (passTime(g, moveCost(g, node))) return;
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') startCombat(g, node);
  else { g.phase = 'node'; g.result = null; }
}

export const REST_COST = 2;
export function rest(g: Game) {
  if (g.phase !== 'map') return;
  if (passTime(g, REST_COST)) return;
  heal(g, eff(g).maxVigor * 0.4);
}

// ---------- scenes: villages, shrines, graves, events ----------
export interface Option { id: string; label: string; hint: string; off?: boolean; run: (g: Game) => string }
export interface Scene { title: string; text: string; options: Option[] }

const gain = (g: Game, n: number) => { g.hero.legacy += n; };
const hurt = (g: Game, n: number) => { g.hero.vigor = Math.max(1, g.hero.vigor - n); };
function relic(g: Game): string {
  const k = int(g.rng, 0, 2);
  if (k === 0) { g.hero.might += 1; return '+1 Might'; }
  if (k === 1) { g.hero.lore += 1; return '+1 Lore'; }
  g.hero.maxVigor += 3; heal(g, 3); return '+3 Vigor';
}
const leave = (label = 'Walk on'): Option => ({ id: 'leave', label, hint: 'Costs nothing', run: () => 'The road goes on.' });
/** An option that costs seasons; if the hero dies paying, the death screen takes over. */
const timed = (id: string, label: string, seasons: number, hint: string, fn: (g: Game) => string): Option => ({
  id, label, hint: `${seasons} season${seasons > 1 ? 's' : ''} · ${hint}`,
  run: (g) => (passTime(g, seasons) ? '' : fn(g)),
});

const EVENTS: Record<string, (g: Game) => Scene> = {
  hermit: () => ({
    title: 'The Hermit', text: 'A hermit offers to teach you what the snow taught him. It took him a lifetime; he can spare you most of it.',
    options: [
      timed('stay', 'Stay a winter', 4, '+2 Lore', (g) => { g.hero.lore += 2; return 'You leave a year older and a little quieter. +2 Lore.'; }),
      timed('talk', 'Trade stories', 1, '+6 Legacy', (g) => { gain(g, 6); return 'He will tell your story to whoever comes next. +6 Legacy.'; }),
      leave(),
    ],
  }),
  bridge: () => ({
    title: 'The Fallen Bridge', text: 'The rope bridge is down. You could ford the river now, or spend seasons rebuilding it for everyone who comes after.',
    options: [
      timed('build', 'Rebuild it', 3, '+14 Legacy', (g) => { gain(g, 14); g.hero.deeds.push('rebuilt a bridge'); return 'Strangers will cross here for a hundred years. +14 Legacy.'; }),
      { id: 'ford', label: 'Ford the river', hint: '−8 Vigor', run: (g) => { hurt(g, 8); return 'The water is knives. You cross. −8 Vigor.'; } },
    ],
  }),
  duel: () => ({
    title: 'The Sword-Saint', text: 'A wandering sword-saint offers a lesson. Payment is taken in bruises.',
    options: [
      { id: 'spar', label: 'Spar', hint: '−10 Vigor · +2 Might', run: (g) => { hurt(g, 10); g.hero.might += 2; return 'You lose, instructively. +2 Might.'; } },
      leave('Decline'),
    ],
  }),
  orchard: () => ({
    title: 'The Frozen Orchard', text: 'One tree still bears fruit under the ice.',
    options: [
      { id: 'eat', label: 'Eat', hint: 'Heal 12 Vigor', run: (g) => { heal(g, 12); return 'Sweet, and very cold. +12 Vigor.'; } },
      timed('plant', 'Plant the seeds', 2, '+10 Legacy', (g) => { gain(g, 10); g.hero.deeds.push('planted an orchard'); return 'You will never see them grow. Someone will. +10 Legacy.'; }),
    ],
  }),
  hourglass: (g) => ({
    title: 'The Merchant of Hours', text: 'She sells time by the winter, and buys it too. Her scales are honest. That is the unsettling part.',
    options: [
      { id: 'buy', label: 'Buy a winter', hint: '−20 Legacy · +1 winter of life', off: g.hero.legacy < 20, run: (g) => { g.hero.legacy -= 20; g.hero.lifespan += 4; return 'One more winter, paid for in memory. +1 winter.'; } },
      { id: 'sell', label: 'Sell a winter', hint: '−1 winter of life · +25 Legacy', off: seasonsLeft(g.hero) <= 8, run: (g) => { g.hero.lifespan -= 4; gain(g, 25); return 'You will be remembered a little more, a little sooner. +25 Legacy.'; } },
      leave(),
    ],
  }),
  cache: () => ({
    title: 'The Cairn', text: 'Stones stacked by a careful hand. Something is buried beneath.',
    options: [
      timed('dig', 'Dig', 1, 'Find a relic', (g) => `Wrapped in oilcloth, still good. ${relic(g)}.`),
      leave('Leave it for another'),
    ],
  }),
  child: () => ({
    title: 'The Lost Child', text: 'A child from a far village, too proud to admit being lost.',
    options: [
      timed('escort', 'Walk them home', 3, '+18 Legacy', (g) => { gain(g, 18); g.hero.deeds.push('brought a lost child home'); return 'The whole village learns your name. +18 Legacy.'; }),
      { id: 'point', label: 'Point the way', hint: '+3 Legacy', run: (g) => { gain(g, 3); return 'They set off, chin up. +3 Legacy.'; } },
    ],
  }),
  spring: () => ({
    title: 'The Hot Spring', text: 'Steam in the pines. The cold cannot follow you in.',
    options: [
      timed('soak', 'Soak a while', 2, 'Full heal · +2 Vigor', (g) => { g.hero.maxVigor += 2; heal(g, 999); return 'You had forgotten what warm was. Fully healed, +2 Vigor.'; }),
      leave(),
    ],
  }),
};

export function scene(g: Game): Scene | null {
  const node = here(g);
  if (!node || g.phase !== 'node') return null;
  if (node.type === 'village') return {
    title: 'A Village', text: 'Smoke, dogs, and the smell of bread. People here measure their lives in harvests.',
    options: [
      timed('train', 'Train at arms', 4, '+2 Might', (g) => { g.hero.might += 2; return 'A year of drills. +2 Might.'; }),
      timed('study', 'Study with the elder', 4, '+2 Lore', (g) => { g.hero.lore += 2; return 'A year of listening. +2 Lore.'; }),
      { ...timed('family', 'Found a family', 8, 'An heir who inherits a trait', (g) => { g.hero.family = true; gain(g, 10); g.hero.deeds.push('raised a child'); return 'Two winters by a hearth of your own. When you fall, your child will take up the road. +10 Legacy.'; }), off: g.hero.family },
      timed('inn', 'Rest at the inn', 1, 'Full heal', (g) => { heal(g, 999); return 'A real bed. Fully healed.'; }),
      leave('Move on'),
    ],
  };
  if (node.type === 'shrine') return {
    title: 'A Wayside Shrine', text: 'Older than the road. The offerings are fresh.',
    options: [
      timed('meditate', 'Meditate', 3, '+2 Lore · heal 5', (g) => { g.hero.lore += 2; heal(g, 5); return 'The seasons turn without you. +2 Lore.'; }),
      { id: 'offer', label: 'Blood offering', hint: '−8 Vigor · +12 Legacy', off: g.hero.vigor <= 8, run: (g) => { hurt(g, 8); gain(g, 12); return 'The stone drinks. +12 Legacy.'; } },
      leave('Pass by'),
    ],
  };
  if (node.type === 'grave' && node.grave) {
    const s = node.grave;
    const candle = (g: Game) => { if (!s.npc && !g.candlesOut.includes(s.id)) g.candlesOut.push(s.id); };
    return {
      title: `Grave of ${s.name}`,
      text: `Here lies ${s.name} of House ${s.house}, ${nth(s.gen)} of that line, who fell at ${s.ageY} to ${s.cause}. “${s.epitaph}”`,
      options: [
        { id: 'candle', label: 'Light a candle', hint: 'Heal 8 · +5 Legacy', run: (g) => { candle(g); heal(g, 8); gain(g, 5); return `You sit a while with ${s.name}. House ${s.house} will know someone came.`; } },
        { id: 'bind', label: 'Ask the shade to walk with you', hint: 'Strikes once in each battle of this realm', run: (g) => { candle(g); g.hero.shade = s; return `${s.name} rises, patient as frost, and falls in beside you.`; } },
      ],
    };
  }
  if (node.type === 'event' && node.eventId) return EVENTS[node.eventId](g);
  return null;
}
export const nth = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

export function choose(g: Game, id: string) {
  if (g.phase !== 'node') return;
  if (g.result !== null) { g.result = null; g.phase = 'map'; return; }
  const opt = scene(g)?.options.find((o) => o.id === id);
  if (!opt || opt.off) return;
  const text = opt.run(g);
  if (g.phase === 'node') g.result = text; // phase changes if the choice was the hero's last
}

// ---------- combat ----------
function startCombat(g: Game, node: MapNode) {
  const run = g.run!, t = run.region;
  const r = { s: hashStr(`foe:${run.week}:${t}:${node.id}`) };
  const kind = node.type as Combat['kind'];
  const def: EnemyDef = kind === 'boss' ? BOSSES[Math.min(t, BOSSES.length - 1)] : pick(r, kind === 'elite' ? ELITES : ENEMIES);
  const hp = Math.round(def.hp * (1 + 0.4 * t));
  g.combat = {
    kind, name: def.name, hp, maxHp: hp, atk: Math.round(def.atk + 1.3 * t), armor: def.armor + Math.floor(t / 2),
    pattern: def.pattern, idx: 0, invokeCd: 0, poise: false, burn: false, shadeReady: !!g.hero.shade,
    log: [`${def.name} bars the way.`],
  };
  g.phase = 'combat';
}
export const intent = (c: Combat) => c.pattern[c.idx % c.pattern.length];
export const canBurn = (g: Game) => seasonsLeft(g.hero) > BURN_COST;
export const FLEE_COST = 3;

export type Action = 'strike' | 'invoke' | 'guard' | 'shade' | 'burn' | 'flee';
export function act(g: Game, a: Action) {
  const c = g.combat, h = g.hero;
  if (!c || g.phase !== 'combat') return;
  const e = eff(g);
  const say = (s: string) => { c.log.push(s); if (c.log.length > 4) c.log.shift(); };
  if (a === 'burn') { c.burn = !c.burn && canBurn(g); return; }
  if (a === 'shade') {
    if (!c.shadeReady || !h.shade) return;
    const dmg = Math.max(h.shade.might, h.shade.lore);
    c.shadeReady = false; c.hp -= dmg;
    say(`${h.shade.name}'s shade strikes for ${dmg}.`);
    if (c.hp <= 0) win(g);
    return;
  }
  if (a === 'flee') {
    if (c.kind === 'boss') return;
    g.combat = null; g.phase = 'map';
    if (!passTime(g, FLEE_COST)) g.notices.push(`You slip away from ${c.name}. It costs you ${FLEE_COST} seasons.`);
    return;
  }
  if (a === 'invoke' && c.invokeCd > 0) return;

  let mult = 1;
  if (c.burn && canBurn(g)) { mult = 2; h.age += BURN_COST; say('You burn a winter of your life.'); }
  c.burn = false;
  const now = intent(c);
  let block = 0;
  if (a === 'strike') {
    const armor = c.armor + (now === 'guard' ? 4 : 0);
    const raw = (e.might + e.loom + int(g.rng, 0, 2)) * (c.poise ? 1.5 : 1) * mult;
    const dmg = Math.max(1, Math.round(raw) - armor);
    c.poise = false; c.hp -= dmg;
    say(`You strike for ${dmg}.`);
  } else if (a === 'invoke') {
    const dmg = Math.round((e.lore * 1.4 + e.loom) * mult);
    c.hp -= dmg; c.invokeCd = 3;
    say(`You invoke for ${dmg}, through its guard.`);
  } else {
    block = Math.round((4 + (e.might + e.lore) / 3 + (has(g, 'warded') ? 3 : 0)) * mult);
    c.poise = true;
    say(`You guard (${block}). Your next strike is poised.`);
  }
  if (c.hp <= 0) { win(g); return; }

  if (now === 'attack' || now === 'heavy') {
    const dmg = Math.max(0, Math.round(c.atk * (now === 'heavy' ? 2.2 : 1)) - block);
    h.vigor -= dmg;
    say(dmg ? `${c.name} hits you for ${dmg}.` : `You turn ${c.name}'s blow aside.`);
  } else if (now === 'wither') {
    if (a === 'guard') say('You deny it your seasons.');
    else {
      const stolen = 3 + Math.floor(g.run!.region / 2);
      h.age += stolen;
      say(`${c.name} steals ${stolen} seasons from you.`);
    }
  } else if (now === 'charge') say(`${c.name} gathers itself.`);
  else say(`${c.name} braces.`);
  c.idx++;
  c.invokeCd = Math.max(0, c.invokeCd - 1);
  h.vigor = Math.min(h.vigor, eff(g).maxVigor);
  if (h.vigor <= 0) die(g, c.name);
  else if (h.age >= h.lifespan) die(g, 'old age, mid-battle');
}

function win(g: Game) {
  const c = g.combat!, h = g.hero, t = g.run!.region;
  h.kills++;
  const legacy = c.kind === 'boss' ? 30 + 12 * t : c.kind === 'elite' ? 14 + 5 * t : 6 + 3 * t;
  h.legacy += legacy;
  const parts = [`+${legacy} Legacy`];
  if (c.kind !== 'battle' || rnd(g.rng) < (has(g, 'lucky') ? 0.5 : 0.3)) parts.push(relic(g));
  g.combat = null;
  if (c.kind === 'boss') {
    h.regions++; h.shade = null;
    h.deeds.push(`crossed ${regionName(t)}`);
    heal(g, eff(g).maxVigor * 0.4);
    g.phase = 'crossing';
    g.result = `${c.name} falls. ${parts.join(' · ')}.`;
  } else {
    if (c.kind === 'elite') heal(g, 6);
    g.phase = 'map';
    g.notices.push(`${c.name} falls. ${parts.join(' · ')}.`);
  }
}

// ---------- death and succession ----------
function die(g: Game, cause: string) {
  const h = g.hero, y = ageY(h);
  const lines: string[] = [];
  if (h.regions > 0) lines.push(`Crossed ${h.regions} realm${h.regions > 1 ? 's' : ''} and feared none.`);
  if (h.family) lines.push('Left a child and a warm hearth.');
  if (h.deeds.some((d) => /bridge|orchard|child home/.test(d))) lines.push('Built for those who came after.');
  if (h.kills >= 5) lines.push(`Felled ${h.kills} foes before the cold came.`);
  if (cause.startsWith('old age')) lines.push(`Saw all ${y} winters and wasted few.`);
  if (y < 30) lines.push('Burned bright, burned brief.');
  lines.push('Spent every winter on the road.', 'Asked nothing of the snow.');
  g.combat = null; g.result = null;
  g.death = { cause, epitaphs: lines.slice(0, 3) };
  g.phase = 'death';
}

export const renownFor = (h: Hero) => Math.floor(h.legacy / 10) + 2 * h.regions;

export function chooseEpitaph(g: Game, i: number) {
  if (g.phase !== 'death' || !g.death) return;
  const h = g.hero, d = g.dynasty, e = eff(g);
  const epitaph = g.death.epitaphs[i] ?? g.death.epitaphs[0];
  const id = `s${Math.floor(rnd(g.rng) * 2 ** 32).toString(36)}${Math.floor(rnd(g.rng) * 2 ** 32).toString(36)}`;
  const region = g.run?.region ?? 0;
  g.outbox.push({
    id, house: d.house, name: h.name, ageY: ageY(h), cause: g.death.cause, week: g.run?.week ?? 0,
    region, might: e.might + e.loom, lore: e.lore + e.loom, epitaph, gen: d.gen,
  });
  d.ancestors.push({ name: h.name, ageY: ageY(h), cause: g.death.cause, epitaph, legacy: h.legacy, regions: h.regions, gen: d.gen, candles: 0, shadeId: id });
  d.renown += renownFor(h);
  if (h.regions >= 1) d.heirloom.notches++;
  g.run = null;
  if (h.family) { g.inherit = [...h.traits]; g.phase = 'succession'; }
  else succeed(g, null);
}

export function succeed(g: Game, trait: TraitId | null) {
  if (g.phase !== 'death' && g.phase !== 'succession') return;
  const parent = g.hero;
  const inherit = trait && g.inherit?.includes(trait) ? trait : null;
  g.dynasty.gen++;
  g.hero = makeHero(g, inherit, inherit ? parent : null);
  g.inherit = null; g.death = null; g.phase = 'hall';
}

/** Candles other players lit at your ancestors' graves while you were away. */
export function receiveCandles(g: Game, candles: { shadeId: string; count: number }[]) {
  let total = 0;
  for (const c of candles) {
    const a = g.dynasty.ancestors.find((x) => x.shadeId === c.shadeId);
    if (!a || c.count <= 0) continue;
    a.candles += c.count; total += c.count;
    g.notices.push(`${c.count} traveler${c.count > 1 ? 's' : ''} lit a candle for ${a.name}.`);
  }
  g.dynasty.renown += total;
  return total;
}
