import './style.css';
import { INTENT_TEXT, TRAITS, regionName } from './content';
import {
  BURN_COST, FLEE_COST, PERKS, PERK_MAX, REST_COST, act, ageY, buyPerk, canBurn, choose, chooseEpitaph,
  eff, here, intent, loreMult, mightMult, moveCost, newGame, nth, perkCost, reachable, receiveCandles,
  renownFor, rest, scene, seasonsLeft, startRegion, succeed, travel, weekOf,
} from './engine';
import type { Action } from './engine';
import { claimCandles, fetchShades, online, postCandle, postShade } from './net';
import type { Game, NodeType, PerkId, TraitId } from './types';

const KEY = 'sixty-winters.save.v1';
const root = document.getElementById('app')!;

function load(): Game {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const g = JSON.parse(raw) as Game; if (g.v === 1) return g; }
  } catch { /* storage unavailable: play without saving */ }
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  return newGame((Math.random() * 2 ** 32) | 0, id);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* ignore */ } }

let g = load();
let busy = false;

// ---------- shared world sync: best effort, never blocks play ----------
async function sync() {
  if (!online) return;
  for (const s of [...g.outbox]) if (await postShade(g.dynasty.playerId, s)) g.outbox = g.outbox.filter((x) => x.id !== s.id);
  for (const id of [...g.candlesOut]) if (await postCandle(g.dynasty.playerId, id)) g.candlesOut = g.candlesOut.filter((x) => x !== id);
  save();
}
async function setOut() {
  busy = true; render();
  const week = weekOf(Date.now());
  startRegion(g, week, await fetchShades(week));
  busy = false;
}

// ---------- view helpers ----------
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const btn = (act: string, label: string, hint = '', cls = '', off = false) =>
  `<button class="btn ${cls}" data-act="${act}" ${off ? 'disabled' : ''}><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</button>`;
const bar = (cls: string, v: number, max: number) =>
  `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%"></i></div>`;
function span(seasons: number) {
  const w = Math.floor(seasons / 4), s = seasons % 4;
  return `${w} winter${w === 1 ? '' : 's'}${s ? `, ${s} season${s === 1 ? '' : 's'}` : ''}`;
}
const notices = () => (g.notices.length ? `<div class="notices">${g.notices.map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : '');
const traits = (ids: TraitId[]) => ids.map((t) => `<span class="trait" title="${TRAITS[t].desc}">${TRAITS[t].name}<small>${TRAITS[t].desc}</small></span>`).join('');

function hud() {
  const h = g.hero, e = eff(g), y = h.age / 4;
  const trend = (f: (y: number) => number) => { const d = f(y + 2) - f(y); return d > 0.005 ? '<em class="up">▲</em>' : d < -0.005 ? '<em class="down">▼</em>' : ''; };
  const left = seasonsLeft(h);
  return `<header class="hud">
    <div class="row"><span class="who">${esc(h.name)} <small>of House ${esc(g.dynasty.house)} · age ${ageY(h)}</small></span><span class="legacy">${h.legacy} Legacy</span></div>
    <div class="life ${left <= 20 ? 'low' : ''}">${bar('time', left, h.lifespan - 64)}<span>${span(left)} left</span></div>
    <div class="row stats">
      <span class="vig">${bar('vigor', h.vigor, e.maxVigor)}<small>Vigor ${Math.max(0, h.vigor)}/${e.maxVigor}</small></span>
      <span>Might <b>${e.might}</b>${trend(mightMult)}</span><span>Lore <b>${e.lore}</b>${trend(loreMult)}</span>
    </div>
  </header>`;
}

const GLYPH: Record<NodeType, string> = { battle: '⚔︎', elite: '☠︎', event: '?', village: '⌂', shrine: '✦', grave: '†', boss: '❄︎' };
const LABEL: Record<NodeType, string> = { battle: 'Battle', elite: 'Elite', event: 'Unknown', village: 'Village', shrine: 'Shrine', grave: 'Grave', boss: 'Warden' };

function mapView() {
  const run = g.run!, m = run.map, open = reachable(g), cur = here(g);
  const W = 320, RH = 58, H = m.layers.length * RH + 16;
  const pos = (id: number) => { const n = m.nodes[id], k = m.layers[n.layer].length; return { x: (W * (n.col + 1)) / (k + 1), y: H - 34 - n.layer * RH }; };
  let svg = '';
  for (const n of m.nodes) for (const t of n.next) {
    const a = pos(n.id), b = pos(t);
    const live = (cur ? n.id === cur.id : false) && open.includes(t);
    svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${live ? 'live' : ''}"/>`;
  }
  for (const n of m.nodes) {
    const p = pos(n.id), can = open.includes(n.id);
    const cls = [n.type, can ? 'open' : '', cur?.id === n.id ? 'cur' : '', cur && n.layer <= cur.layer && n.id !== cur.id ? 'past' : ''].join(' ');
    svg += `<g class="node ${cls}" ${can ? `data-act="go:${n.id}" role="button" aria-label="${LABEL[n.type]}, ${moveCost(g, n)} seasons"` : ''}>
      <circle cx="${p.x}" cy="${p.y}" r="${n.type === 'boss' ? 21 : 17}"/><text x="${p.x}" y="${p.y + 6}">${GLYPH[n.type]}</text>
      ${can ? `<text class="cost" x="${p.x}" y="${p.y + 31}">${moveCost(g, n)} seasons</text>` : ''}</g>`;
  }
  const e = eff(g);
  return `${hud()}<main class="map">
    <h2>${regionName(run.region)}<small>Realm ${run.region + 1} · the same road for every traveler this week</small></h2>
    ${notices()}
    <svg viewBox="0 0 ${W} ${H}" class="realm">${svg}</svg>
    <p class="legend">${(Object.keys(GLYPH) as NodeType[]).map((t) => `<span>${GLYPH[t]} ${LABEL[t]}</span>`).join('')}</p>
  </main>
  <footer>${g.hero.shade ? `<p class="with">${esc(g.hero.shade.name)}'s shade walks with you.</p>` : ''}
    ${btn('rest', 'Rest by the road', `${REST_COST} seasons · heal ${Math.round(e.maxVigor * 0.4)} Vigor`, '', g.hero.vigor >= e.maxVigor)}</footer>`;
}

function combatView() {
  const c = g.combat!, e = eff(g), it = intent(c), mult = c.burn ? 2 : 1;
  const armor = c.armor + (it === 'guard' ? 4 : 0);
  const strike = Math.max(1, Math.round((e.might + e.loom + 1) * (c.poise ? 1.5 : 1) * mult) - armor);
  const invoke = Math.round((e.lore * 1.4 + e.loom) * mult);
  const block = Math.round((4 + (e.might + e.lore) / 3 + (g.hero.traits.includes('warded') ? 3 : 0)) * mult);
  const hit = it === 'attack' ? c.atk : it === 'heavy' ? Math.round(c.atk * 2.2) : 0;
  return `${hud()}<main class="combat">
    <section class="foe ${c.kind}">
      <h2>${esc(c.name)}</h2>${bar('foehp', c.hp, c.maxHp)}<small>${c.hp}/${c.maxHp}${c.armor ? ` · armor ${c.armor}` : ''}</small>
      <div class="intent ${it}"><b>${INTENT_TEXT[it].label}${hit ? ` · ${hit}` : ''}</b><span>${INTENT_TEXT[it].tip}</span></div>
    </section>
    <ul class="log">${c.log.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
  </main>
  <footer class="actions">
    <div class="grid">
      ${btn('act:strike', 'Strike', `${strike} damage${c.poise ? ' · poised' : ''}`)}
      ${btn('act:invoke', 'Invoke', c.invokeCd ? `ready in ${c.invokeCd}` : `${invoke} · pierces armor`, '', c.invokeCd > 0)}
      ${btn('act:guard', 'Guard', `block ${block} · poise next strike`)}
      ${btn('act:burn', c.burn ? 'Burning a winter' : 'Burn a winter', `−${BURN_COST} seasons · doubles your next move`, c.burn ? 'burn on' : 'burn', !canBurn(g))}
    </div>
    ${c.shadeReady && g.hero.shade ? btn('act:shade', `Call ${esc(g.hero.shade.name)}'s shade`, `${Math.max(g.hero.shade.might, g.hero.shade.lore)} damage · free`, 'shade') : ''}
    ${c.kind !== 'boss' ? btn('act:flee', 'Slip away', `${FLEE_COST} seasons`, 'ghost') : ''}
  </footer>`;
}

function nodeView() {
  const s = scene(g)!;
  const body = g.result !== null
    ? `<p class="result">${esc(g.result)}</p>${btn('pick:', 'Continue')}`
    : `<p>${esc(s.text)}</p>${s.options.map((o) => btn(`pick:${o.id}`, o.label, o.hint, '', o.off)).join('')}`;
  return `${hud()}<main class="scene"><h2>${esc(s.title)}</h2>${body}</main>`;
}

function crossingView() {
  const r = g.hero.regions;
  return `${hud()}<main class="scene"><h2>${regionName(r - 1)} is behind you</h2>
    <p class="result">${esc(g.result ?? '')}</p>
    <p>You are ${ageY(g.hero)}. Ahead lies ${regionName(r)}, and it is colder.</p>
    ${btn('setout', busy ? 'Reading the road…' : 'Walk on', '', 'primary', busy)}</main>`;
}

function deathView() {
  const h = g.hero, d = g.death!;
  return `<main class="scene death"><p class="kicker">House ${esc(g.dynasty.house)} · ${nth(g.dynasty.gen)} generation</p>
    <h1>${esc(h.name)}</h1>
    <p>died at ${ageY(h)}, taken by ${esc(d.cause)}.</p>
    <p class="tally">${h.legacy} Legacy · ${h.regions} realm${h.regions === 1 ? '' : 's'} crossed · ${h.kills} foes felled<br>
      The house gains <b>${renownFor(h)} Renown</b>${h.regions ? `, and ${esc(g.dynasty.heirloom.name)} earns a notch` : ''}.</p>
    <p>${esc(h.name)}'s grave will stand on this week's road for other travelers to find. Choose the words on the stone:</p>
    ${d.epitaphs.map((e, i) => btn(`epitaph:${i}`, `“${esc(e)}”`, '', 'stone')).join('')}</main>`;
}

function successionView() {
  const dead = g.dynasty.ancestors[g.dynasty.ancestors.length - 1];
  return `<main class="scene"><p class="kicker">Succession</p><h2>${esc(dead.name)}'s child takes up the road</h2>
    <p>Children are not their parents, but something always carries over. What did ${esc(dead.name)} pass on?</p>
    ${(g.inherit ?? []).map((t) => btn(`inherit:${t}`, TRAITS[t].name, TRAITS[t].desc)).join('')}</main>`;
}

function hallView() {
  const d = g.dynasty, h = g.hero, first = d.ancestors.length === 0;
  const perks = (Object.keys(PERKS) as PerkId[]).map((id) => {
    const lvl = d.perks[id], max = lvl >= PERK_MAX;
    return btn(`perk:${id}`, `${PERKS[id].name} <i>${'●'.repeat(lvl)}${'○'.repeat(PERK_MAX - lvl)}</i>`, `${PERKS[id].desc}${max ? '' : ` · ${perkCost(g, id)} Renown`}`, 'perk', max || d.renown < perkCost(g, id));
  }).join('');
  const stones = [...d.ancestors].reverse().map((a) => `<li><b>${esc(a.name)}</b> <small>${nth(a.gen)} · died at ${a.ageY} · ${esc(a.cause)}</small>
    <q>${esc(a.epitaph)}</q><small>${a.legacy} Legacy · ${a.regions} realm${a.regions === 1 ? '' : 's'}${a.candles ? ` · <span class="candle">${a.candles} candle${a.candles > 1 ? 's' : ''} lit by travelers</span>` : ''}</small></li>`).join('');
  return `<main class="hall">
    <p class="kicker">${nth(d.gen)} generation</p><h1>House ${esc(d.house)}</h1>
    <p class="loom">Bearer of ${esc(d.heirloom.name)}${d.heirloom.notches ? ` · ${d.heirloom.notches} notch${d.heirloom.notches > 1 ? 'es' : ''} (+${Math.ceil(d.heirloom.notches / 2)} to every blow)` : ''}</p>
    ${notices()}
    <section class="card"><h2>${esc(h.name)}<small>age 16 · ${span(seasonsLeft(h))} to live</small></h2>
      <p>${traits(h.traits)}</p>
      <p class="stats">Might <b>${h.might}</b> · Lore <b>${h.lore}</b> · Vigor <b>${h.maxVigor}</b></p></section>
    ${first ? `<section class="how"><p><b>Your life is the only currency.</b> Every road, rest and lesson costs seasons you will not get back.</p>
      <p>Might fades with age; Lore deepens. Fight young, think old.</p>
      <p>When ${esc(h.name)} falls, the grave stays on the road for other players, and the house goes on.</p></section>` : ''}
    ${btn('setout', busy ? 'Reading the road…' : 'Set out', `This week's realm · ${online ? 'shared with all travelers' : 'offline: wanderers only'}`, 'primary', busy)}
    <h3>The house <span class="renown">${d.renown} Renown</span></h3>
    <div class="perks">${perks}</div>
    ${stones ? `<h3>The stones</h3><ul class="stones">${stones}</ul>` : ''}
  </main>`;
}

function render() {
  const view = { hall: hallView, map: mapView, node: nodeView, combat: combatView, crossing: crossingView, death: deathView, succession: successionView }[g.phase];
  root.className = g.phase;
  root.innerHTML = view();
  // The road runs upward: keep the traveler's next steps on screen.
  if (g.phase === 'map') root.querySelector('.node.open')?.scrollIntoView({ block: 'center' });
  else if (g.phase !== 'combat') window.scrollTo(0, 0);
}

root.addEventListener('click', async (ev) => {
  const el = (ev.target as Element).closest<HTMLElement | SVGElement>('[data-act]');
  if (!el || busy || (el as HTMLButtonElement).disabled) return;
  const [name, arg = ''] = el.dataset.act!.split(':');
  g.notices = [];
  if (name === 'setout') await setOut();
  else if (name === 'go') travel(g, Number(arg));
  else if (name === 'rest') rest(g);
  else if (name === 'pick') choose(g, arg);
  else if (name === 'act') act(g, arg as Action);
  else if (name === 'epitaph') chooseEpitaph(g, Number(arg));
  else if (name === 'inherit') succeed(g, arg as TraitId);
  else if (name === 'perk') buyPerk(g, arg as PerkId);
  save(); render();
  if (g.outbox.length || g.candlesOut.length) void sync();
});

render();
void (async () => {
  if (!online) return;
  await sync();
  if (receiveCandles(g, await claimCandles(g.dynasty.playerId))) { save(); if (g.phase === 'hall' || g.phase === 'map') render(); }
})();
