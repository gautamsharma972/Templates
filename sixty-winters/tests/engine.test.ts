import { describe, expect, it } from 'vitest';
import {
  act, ageY, buyPerk, canBurn, choose, chooseEpitaph, eff, genMap, intent, newGame, reachable,
  receiveCandles, rest, scene, seasonsLeft, startRegion, succeed, travel,
} from '../src/engine';
import type { Game } from '../src/types';

/** A plain, sensible player: guards what should be guarded, rests when hurt. */
function playLife(g: Game, opts = { burn: false }) {
  let steps = 0;
  while (g.phase !== 'death' && steps++ < 5000) {
    if (g.phase === 'hall' || g.phase === 'crossing') startRegion(g, 100, []);
    else if (g.phase === 'map') {
      if (g.hero.vigor < eff(g).maxVigor * 0.5 && seasonsLeft(g.hero) > 12) rest(g);
      else { const r = reachable(g); travel(g, r[steps % r.length]); }
    } else if (g.phase === 'node') {
      if (g.result !== null) choose(g, '');
      else { const o = scene(g)!.options.filter((x) => !x.off); choose(g, o[steps % o.length].id); }
    } else if (g.phase === 'combat') {
      const c = g.combat!, now = intent(c);
      if (c.shadeReady) act(g, 'shade');
      else if (now === 'heavy' || now === 'wither') act(g, 'guard');
      else {
        if (opts.burn && now === 'charge' && canBurn(g) && !c.burn) act(g, 'burn');
        act(g, c.invokeCd === 0 && (now === 'guard' || eff(g).lore > eff(g).might) ? 'invoke' : 'strike');
      }
    }
  }
  return g;
}

describe('the realm', () => {
  it('is the same for every player in a week, and different next week', () => {
    expect(genMap(7, 0, [])).toEqual(genMap(7, 0, []));
    expect(genMap(7, 0, [])).not.toEqual(genMap(8, 0, []));
  });
  it('can always be walked from the first layer to the boss', () => {
    for (let w = 0; w < 200; w++) {
      const m = genMap(w, w % 5, []);
      const seen = new Set(m.layers[0]);
      for (const n of m.nodes) if (seen.has(n.id)) n.next.forEach((x) => seen.add(x));
      expect(seen.size).toBe(m.nodes.length);
      expect(m.nodes.filter((n) => n.type === 'grave')).toHaveLength(2);
    }
  });
  it("places a real player's shade ahead of the seeded ones", () => {
    const shade = { id: 'x1', house: 'Brandt', name: 'Tova', ageY: 41, cause: 'the cold', week: 7, region: 0, might: 9, lore: 9, epitaph: 'x', gen: 3 };
    const graves = genMap(7, 0, [shade]).nodes.filter((n) => n.grave).map((n) => n.grave!.id);
    expect(graves).toContain('x1');
  });
});

describe('a life', () => {
  it('always ends, and time only moves forward', () => {
    for (let s = 1; s <= 40; s++) {
      const g = playLife(newGame(s, 'p'));
      expect(g.phase).toBe('death');
      expect(g.hero.age).toBeGreaterThan(64);
    }
  });
  it('is balanced so a typical first hero crosses a realm or two, not zero or all', () => {
    const regions = Array.from({ length: 300 }, (_, s) => playLife(newGame(s + 1, 'p')).hero.regions).sort((a, b) => a - b);
    const ages = Array.from({ length: 300 }, (_, s) => ageY(playLife(newGame(s + 1, 'p')).hero));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    console.log('regions p10/p50/p90', regions[30], regions[150], regions[270], 'mean age', mean(ages).toFixed(1));
    expect(regions[150]).toBeGreaterThanOrEqual(1);
    expect(regions[150]).toBeLessThanOrEqual(3);
    expect(regions[270]).toBeLessThanOrEqual(5);
  });
  it('ages a fighter into a sage', () => {
    const g = newGame(3, 'p');
    g.hero.might = 10; g.hero.lore = 10;
    g.hero.age = 26 * 4; const young = eff(g);
    g.hero.age = 58 * 4; const old = eff(g);
    expect(young.might).toBeGreaterThan(young.lore);
    expect(old.lore).toBeGreaterThan(old.might);
  });
  it('lets you burn a winter to double a blow', () => {
    const g = newGame(5, 'p');
    startRegion(g, 100, []);
    const battle = g.run!.map.layers[0].find((id) => g.run!.map.nodes[id].type === 'battle')!;
    travel(g, battle);
    const age = g.hero.age, hp = g.combat!.hp;
    act(g, 'burn'); act(g, 'strike');
    expect(g.hero.age).toBeGreaterThanOrEqual(age + 4);
    expect(hp - (g.combat?.hp ?? 0)).toBeGreaterThanOrEqual((eff(g).might) * 2 - 6);
  });
});

describe('the house', () => {
  it('passes a chosen trait to an heir, and remembers the dead', () => {
    const g = playLife(newGame(11, 'p'));
    g.hero.family = true;
    const parentTraits = [...g.hero.traits], name = g.hero.name;
    chooseEpitaph(g, 0);
    expect(g.phase).toBe('succession');
    expect(g.outbox).toHaveLength(1);
    succeed(g, parentTraits[1]);
    expect(g.phase).toBe('hall');
    expect(g.hero.traits).toContain(parentTraits[1]);
    expect(g.dynasty.gen).toBe(2);
    expect(g.dynasty.ancestors[0].name).toBe(name);
  });
  it('turns candles from strangers into renown, and renown into perks', () => {
    const g = playLife(newGame(12, 'p'));
    chooseEpitaph(g, 0);
    const before = g.dynasty.renown;
    expect(receiveCandles(g, [{ shadeId: g.dynasty.ancestors[0].shadeId, count: 3 }, { shadeId: 'nope', count: 9 }])).toBe(3);
    expect(g.dynasty.renown).toBe(before + 3);
    g.dynasty.renown = 4;
    const might = g.hero.might;
    expect(buyPerk(g, 'drill')).toBe(true);
    expect(g.hero.might).toBe(might + 1);
    expect(buyPerk(g, 'drill')).toBe(false);
  });
  it('survives a save and load mid-journey', () => {
    const g = newGame(9, 'p');
    startRegion(g, 100, []);
    travel(g, reachable(g)[0]);
    const copy: Game = JSON.parse(JSON.stringify(g));
    expect(playLife(copy).hero).toEqual(playLife(g).hero);
  });
});
