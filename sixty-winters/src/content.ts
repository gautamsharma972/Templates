import type { EnemyDef, TraitId } from './types';

export const TRAITS: Record<TraitId, { name: string; desc: string }> = {
  hardy: { name: 'Hardy', desc: '+6 Vigor' },
  fierce: { name: 'Fierce', desc: '+2 Might' },
  keen: { name: 'Keen', desc: '+2 Lore' },
  longlived: { name: 'Long-lived', desc: '+5 winters of life' },
  swift: { name: 'Swift', desc: 'Travel costs 1 season less' },
  warded: { name: 'Warded', desc: 'Guard blocks +3' },
  lucky: { name: 'Lucky', desc: 'Finds spoils more often' },
};
export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

export const NAMES = [
  'Mira', 'Aldo', 'Senna', 'Bram', 'Ysolde', 'Corin', 'Tova', 'Hale', 'Edda', 'Rurik',
  'Isen', 'Marga', 'Odo', 'Linnea', 'Garrick', 'Sif', 'Emer', 'Jorun', 'Petra', 'Wyn',
  'Aksel', 'Brisa', 'Dunya', 'Fenn', 'Ilse', 'Kaj', 'Maren', 'Nils', 'Runa', 'Torv',
];
export const HOUSES = [
  'Ashgrove', 'Vintermark', 'Hollowell', 'Brandt', 'Stormrook', 'Elderfen',
  'Coldharbor', 'Thornwake', 'Greywater', 'Lanternby', 'Ravensholt', 'Emberlin',
];
export const HEIRLOOMS = ['the Ash Blade', 'the Wolf-Bone Staff', 'the Kin Lantern', 'the Winter Horn'];

export const REGIONS = [
  'The Thawing Vale', 'Greywood', 'The Rime Marches', 'Hollow Pass', 'The Long Winter',
];
export const regionName = (i: number) =>
  i < REGIONS.length ? REGIONS[i] : `The Long Winter, ${i - REGIONS.length + 2}th crossing`;

export const ENEMIES: EnemyDef[] = [
  { name: 'Frost Wolf', hp: 16, atk: 5, armor: 0, pattern: ['attack', 'attack', 'charge', 'heavy'] },
  { name: 'Hollow Pilgrim', hp: 20, atk: 4, armor: 1, pattern: ['attack', 'guard', 'attack'] },
  { name: 'Year-Eater', hp: 15, atk: 4, armor: 0, pattern: ['wither', 'attack', 'attack'] },
  { name: 'Bog Witch', hp: 17, atk: 5, armor: 0, pattern: ['attack', 'wither', 'guard'] },
  { name: 'Rime Knight', hp: 22, atk: 5, armor: 2, pattern: ['guard', 'attack', 'charge', 'heavy'] },
  { name: 'Snow Stalker', hp: 14, atk: 6, armor: 0, pattern: ['attack', 'attack', 'attack', 'guard'] },
];
export const ELITES: EnemyDef[] = [
  { name: 'Barrow Champion', hp: 30, atk: 6, armor: 2, pattern: ['attack', 'guard', 'charge', 'heavy'] },
  { name: 'The Clockless One', hp: 26, atk: 5, armor: 0, pattern: ['wither', 'attack', 'wither', 'charge', 'heavy'] },
];
export const BOSSES: EnemyDef[] = [
  { name: 'Warden of First Frost', hp: 40, atk: 6, armor: 1, pattern: ['attack', 'guard', 'attack', 'charge', 'heavy'] },
  { name: 'The Greywood Stag', hp: 44, atk: 6, armor: 1, pattern: ['attack', 'attack', 'charge', 'heavy', 'guard'] },
  { name: 'Marshal of Rime', hp: 46, atk: 6, armor: 2, pattern: ['guard', 'attack', 'wither', 'charge', 'heavy'] },
  { name: 'The Pass-Keeper', hp: 48, atk: 7, armor: 2, pattern: ['attack', 'wither', 'guard', 'charge', 'heavy'] },
  { name: 'The Long Winter', hp: 54, atk: 7, armor: 2, pattern: ['wither', 'attack', 'charge', 'heavy', 'guard', 'attack'] },
];

export const INTENT_TEXT: Record<string, { label: string; tip: string }> = {
  attack: { label: 'Attack', tip: 'It will strike. Guard to blunt it.' },
  charge: { label: 'Gathering', tip: 'It winds up a heavy blow. A free turn to hit hard.' },
  heavy: { label: 'Heavy blow', tip: 'A crushing hit is coming. Guard!' },
  guard: { label: 'Braced', tip: 'Its armor is raised. Invoke pierces armor.' },
  wither: { label: 'Wither', tip: 'It will steal seasons from your life. Guard to deny it.' },
};
