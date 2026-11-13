export type TraitId = 'hardy' | 'fierce' | 'keen' | 'longlived' | 'swift' | 'warded' | 'lucky';
export type Intent = 'attack' | 'charge' | 'heavy' | 'guard' | 'wither';
export type NodeType = 'battle' | 'elite' | 'event' | 'village' | 'shrine' | 'grave' | 'boss';
export type Phase = 'hall' | 'map' | 'node' | 'combat' | 'crossing' | 'death' | 'succession';
export type PerkId = 'hearth' | 'songs' | 'drill' | 'table';

export interface EnemyDef { name: string; hp: number; atk: number; armor: number; pattern: Intent[] }

/** A fallen hero as other players meet them. `npc` shades are seeded locally. */
export interface Shade {
  id: string; house: string; name: string; ageY: number; cause: string;
  week: number; region: number; might: number; lore: number;
  epitaph: string; gen: number; npc?: boolean;
}

export interface MapNode {
  id: number; layer: number; col: number; type: NodeType; cost: number;
  next: number[]; grave?: Shade; eventId?: string;
}
export interface RealmMap { layers: number[][]; nodes: MapNode[] }

/** All time is counted in seasons; four seasons make a winter (a year). */
export interface Hero {
  name: string; age: number; lifespan: number;
  might: number; lore: number; maxVigor: number; vigor: number;
  traits: TraitId[]; legacy: number; deeds: string[];
  family: boolean; shade: Shade | null; kills: number; regions: number;
}

export interface Ancestor {
  name: string; ageY: number; cause: string; epitaph: string;
  legacy: number; regions: number; gen: number; candles: number; shadeId: string;
}

export interface Dynasty {
  playerId: string; house: string; gen: number; renown: number;
  heirloom: { name: string; notches: number };
  ancestors: Ancestor[]; perks: Record<PerkId, number>;
}

export interface Combat {
  kind: 'battle' | 'elite' | 'boss';
  name: string; hp: number; maxHp: number; atk: number; armor: number;
  pattern: Intent[]; idx: number;
  invokeCd: number; poise: boolean; burn: boolean; shadeReady: boolean;
  log: string[];
}

export interface Run { week: number; region: number; map: RealmMap; at: number }

export interface Game {
  v: 1;
  rng: { s: number };
  dynasty: Dynasty;
  hero: Hero;
  run: Run | null;
  phase: Phase;
  combat: Combat | null;
  /** Text shown after a node choice resolves; null while options are open. */
  result: string | null;
  death: { cause: string; epitaphs: string[] } | null;
  /** Succession: the dead parent's traits the heir may inherit one of. */
  inherit: TraitId[] | null;
  /** Shade waiting to be sent to the shared world. */
  outbox: Shade[];
  /** Grave visits waiting to be sent as candles. */
  candlesOut: string[];
  notices: string[];
}
