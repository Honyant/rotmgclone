// Static game data definitions

export interface ClassDefinition {
  id: string;
  name: string;
  description: string;
  baseHp: number;
  baseMp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  baseDexterity: number;
  baseVitality: number;
  baseWisdom: number;
  hpPerLevel: number;
  mpPerLevel: number;
  attackPerLevel: number;
  defensePerLevel: number;
  speedPerLevel: number;
  dexterityPerLevel: number;
  vitalityPerLevel: number;
  wisdomPerLevel: number;
  weaponType: string;
  abilityType: string;
  armorType: string;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  type: string;
  tier: number;
  damage: [number, number]; // min, max
  rateOfFire: number; // shots per second
  range: number;
  projectileSpeed: number;
  numProjectiles: number;
  arcGap: number; // degrees between projectiles
  piercing: boolean;
  projectileId: string;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  type: string;
  tier: number;
  mpCost: number;
  cooldown: number;
  effect: AbilityEffect;
}

export type AbilityEffect =
  | { type: 'heal'; amount: number }
  | { type: 'damage'; damage: number; radius: number }
  | { type: 'buff'; stat: string; amount: number; duration: number }
  | { type: 'teleport'; range: number };

export interface ArmorDefinition {
  id: string;
  name: string;
  type: string;
  tier: number;
  defense: number;
  hpBonus: number;
  mpBonus: number;
}

export interface RingDefinition {
  id: string;
  name: string;
  tier: number;
  stats: Partial<{
    hp: number;
    mp: number;
    attack: number;
    defense: number;
    speed: number;
    dexterity: number;
    vitality: number;
    wisdom: number;
  }>;
}

export interface ProjectileDefinition {
  id: string;
  sprite: string;
  size: number;
  color: string;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  hp: number;
  defense: number;
  speed: number;
  radius: number;
  behavior: EnemyBehavior;
  attacks: EnemyAttack[];
  xpReward: number;
  lootTable: LootEntry[];
  color: string;
}

export type EnemyBehavior =
  | { type: 'wander' }
  | { type: 'chase'; range: number }
  | { type: 'orbit'; range: number; speed: number }
  | { type: 'stationary' };

export interface EnemyAttack {
  projectileId: string;
  damage: [number, number];
  rateOfFire: number;
  range: number;
  projectileSpeed: number;
  numProjectiles: number;
  arcGap: number;
  predictive: boolean;
}

export interface LootEntry {
  itemId: string;
  chance: number; // 0-1
  minQuantity: number;
  maxQuantity: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  type: 'weapon' | 'ability' | 'armor' | 'ring' | 'consumable';
  tier: number;
  soulbound: boolean;
  description: string;
  color: string;
}

// =====================
// GAME DATA
// =====================

export const CLASSES: Record<string, ClassDefinition> = {
  wizard: {
    id: 'wizard',
    name: 'Wizard',
    description: 'A powerful spellcaster with high damage but low defense',
    baseHp: 100,
    baseMp: 100,
    baseAttack: 15,
    baseDefense: 0,
    baseSpeed: 10,
    baseDexterity: 15,
    baseVitality: 10,
    baseWisdom: 15,
    hpPerLevel: 5,
    mpPerLevel: 5,
    attackPerLevel: 2,
    defensePerLevel: 0,
    speedPerLevel: 1,
    dexterityPerLevel: 2,
    vitalityPerLevel: 1,
    wisdomPerLevel: 2,
    weaponType: 'staff',
    abilityType: 'spell',
    armorType: 'robe',
  },
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    description: 'A tough melee fighter with high defense',
    baseHp: 150,
    baseMp: 50,
    baseAttack: 10,
    baseDefense: 10,
    baseSpeed: 8,
    baseDexterity: 10,
    baseVitality: 15,
    baseWisdom: 5,
    hpPerLevel: 10,
    mpPerLevel: 2,
    attackPerLevel: 1,
    defensePerLevel: 2,
    speedPerLevel: 1,
    dexterityPerLevel: 1,
    vitalityPerLevel: 2,
    wisdomPerLevel: 0,
    weaponType: 'sword',
    abilityType: 'helm',
    armorType: 'heavy',
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    description: 'A ranged fighter with good speed and range',
    baseHp: 120,
    baseMp: 75,
    baseAttack: 12,
    baseDefense: 5,
    baseSpeed: 12,
    baseDexterity: 15,
    baseVitality: 10,
    baseWisdom: 10,
    hpPerLevel: 7,
    mpPerLevel: 3,
    attackPerLevel: 2,
    defensePerLevel: 1,
    speedPerLevel: 2,
    dexterityPerLevel: 2,
    vitalityPerLevel: 1,
    wisdomPerLevel: 1,
    weaponType: 'bow',
    abilityType: 'quiver',
    armorType: 'leather',
  },
};

export const WEAPONS: Record<string, WeaponDefinition> = {
  starter_staff: {
    id: 'starter_staff',
    name: 'Starter Staff',
    type: 'staff',
    tier: 0,
    damage: [15, 25],
    rateOfFire: 2,
    range: 8,
    projectileSpeed: 12,
    numProjectiles: 1,
    arcGap: 0,
    piercing: false,
    projectileId: 'magic_bolt',
  },
  starter_sword: {
    id: 'starter_sword',
    name: 'Starter Sword',
    type: 'sword',
    tier: 0,
    damage: [20, 35],
    rateOfFire: 3,
    range: 3.5,
    projectileSpeed: 15,
    numProjectiles: 1,
    arcGap: 0,
    piercing: true,
    projectileId: 'sword_slash',
  },
  starter_bow: {
    id: 'starter_bow',
    name: 'Starter Bow',
    type: 'bow',
    tier: 0,
    damage: [12, 22],
    rateOfFire: 1.5,
    range: 7,
    projectileSpeed: 14,
    numProjectiles: 1,
    arcGap: 0,
    piercing: false,
    projectileId: 'arrow',
  },
  // T1 weapons
  fire_wand: {
    id: 'fire_wand',
    name: 'Fire Wand',
    type: 'staff',
    tier: 1,
    damage: [20, 35],
    rateOfFire: 2,
    range: 8.5,
    projectileSpeed: 13,
    numProjectiles: 1,
    arcGap: 0,
    piercing: false,
    projectileId: 'fire_bolt',
  },
  short_sword: {
    id: 'short_sword',
    name: 'Short Sword',
    type: 'sword',
    tier: 1,
    damage: [30, 50],
    rateOfFire: 3,
    range: 3.5,
    projectileSpeed: 15,
    numProjectiles: 1,
    arcGap: 0,
    piercing: true,
    projectileId: 'sword_slash',
  },
  crossbow: {
    id: 'crossbow',
    name: 'Crossbow',
    type: 'bow',
    tier: 1,
    damage: [18, 32],
    rateOfFire: 1.6,
    range: 7.5,
    projectileSpeed: 15,
    numProjectiles: 1,
    arcGap: 0,
    piercing: false,
    projectileId: 'arrow',
  },
  // T2 weapons
  fire_staff: {
    id: 'fire_staff',
    name: 'Staff of Fire',
    type: 'staff',
    tier: 2,
    damage: [30, 50],
    rateOfFire: 1.8,
    range: 9,
    projectileSpeed: 14,
    numProjectiles: 2,
    arcGap: 10,
    piercing: false,
    projectileId: 'fire_bolt',
  },
  broad_sword: {
    id: 'broad_sword',
    name: 'Broad Sword',
    type: 'sword',
    tier: 2,
    damage: [40, 65],
    rateOfFire: 2.8,
    range: 3.8,
    projectileSpeed: 15,
    numProjectiles: 1,
    arcGap: 0,
    piercing: true,
    projectileId: 'sword_slash',
  },
  double_bow: {
    id: 'double_bow',
    name: 'Double Bow',
    type: 'bow',
    tier: 2,
    damage: [15, 28],
    rateOfFire: 1.8,
    range: 8,
    projectileSpeed: 16,
    numProjectiles: 2,
    arcGap: 8,
    piercing: false,
    projectileId: 'arrow',
  },
  // T3 weapons
  staff_of_destruction: {
    id: 'staff_of_destruction',
    name: 'Staff of Destruction',
    type: 'staff',
    tier: 3,
    damage: [45, 70],
    rateOfFire: 1.6,
    range: 9.5,
    projectileSpeed: 15,
    numProjectiles: 2,
    arcGap: 8,
    piercing: false,
    projectileId: 'fire_bolt',
  },
  golden_sword: {
    id: 'golden_sword',
    name: 'Golden Sword',
    type: 'sword',
    tier: 3,
    damage: [55, 85],
    rateOfFire: 2.5,
    range: 4,
    projectileSpeed: 16,
    numProjectiles: 1,
    arcGap: 0,
    piercing: true,
    projectileId: 'sword_slash',
  },
  heavy_crossbow: {
    id: 'heavy_crossbow',
    name: 'Heavy Crossbow',
    type: 'bow',
    tier: 3,
    damage: [30, 55],
    rateOfFire: 1.5,
    range: 8.5,
    projectileSpeed: 18,
    numProjectiles: 3,
    arcGap: 6,
    piercing: false,
    projectileId: 'arrow',
  },
  // T4 Epic dungeon weapons
  doom_staff: {
    id: 'doom_staff',
    name: 'Staff of Doom',
    type: 'staff',
    tier: 4,
    damage: [70, 120],
    rateOfFire: 1.4,
    range: 10,
    projectileSpeed: 16,
    numProjectiles: 3,
    arcGap: 6,
    piercing: true,
    projectileId: 'boss_bullet',
  },
  demon_blade: {
    id: 'demon_blade',
    name: 'Demon Blade',
    type: 'sword',
    tier: 4,
    damage: [100, 160],
    rateOfFire: 2.2,
    range: 4.5,
    projectileSpeed: 18,
    numProjectiles: 1,
    arcGap: 0,
    piercing: true,
    projectileId: 'boss_bullet',
  },
  doom_bow: {
    id: 'doom_bow',
    name: 'Doom Bow',
    type: 'bow',
    tier: 4,
    damage: [150, 250],
    rateOfFire: 0.5,
    range: 12,
    projectileSpeed: 20,
    numProjectiles: 1,
    arcGap: 0,
    piercing: true,
    projectileId: 'arrow',
  },
};

export const ABILITIES: Record<string, AbilityDefinition> = {
  starter_spell: {
    id: 'starter_spell',
    name: 'Magic Nova',
    type: 'spell',
    tier: 0,
    mpCost: 30,
    cooldown: 1,
    effect: { type: 'damage', damage: 50, radius: 3 },
  },
  starter_helm: {
    id: 'starter_helm',
    name: 'Bronze Helm',
    type: 'helm',
    tier: 0,
    mpCost: 20,
    cooldown: 2,
    effect: { type: 'buff', stat: 'speed', amount: 5, duration: 3 },
  },
  starter_quiver: {
    id: 'starter_quiver',
    name: 'Basic Quiver',
    type: 'quiver',
    tier: 0,
    mpCost: 25,
    cooldown: 0.5,
    effect: { type: 'damage', damage: 80, radius: 1 },
  },
};

export const ARMORS: Record<string, ArmorDefinition> = {
  starter_robe: {
    id: 'starter_robe',
    name: 'Starter Robe',
    type: 'robe',
    tier: 0,
    defense: 2,
    hpBonus: 0,
    mpBonus: 10,
  },
  starter_heavy: {
    id: 'starter_heavy',
    name: 'Starter Plate',
    type: 'heavy',
    tier: 0,
    defense: 8,
    hpBonus: 20,
    mpBonus: 0,
  },
  starter_leather: {
    id: 'starter_leather',
    name: 'Starter Leather',
    type: 'leather',
    tier: 0,
    defense: 5,
    hpBonus: 10,
    mpBonus: 5,
  },
};

export const RINGS: Record<string, RingDefinition> = {
  hp_ring: {
    id: 'hp_ring',
    name: 'Ring of Health',
    tier: 1,
    stats: { hp: 20 },
  },
  mp_ring: {
    id: 'mp_ring',
    name: 'Ring of Magic',
    tier: 1,
    stats: { mp: 20 },
  },
  attack_ring: {
    id: 'attack_ring',
    name: 'Ring of Attack',
    tier: 1,
    stats: { attack: 3 },
  },
  defense_ring: {
    id: 'defense_ring',
    name: 'Ring of Defense',
    tier: 2,
    stats: { defense: 5 },
  },
  speed_ring: {
    id: 'speed_ring',
    name: 'Ring of Speed',
    tier: 2,
    stats: { speed: 5 },
  },
  power_ring: {
    id: 'power_ring',
    name: 'Ring of Power',
    tier: 3,
    stats: { attack: 5, hp: 20 },
  },
  omnipotence_ring: {
    id: 'omnipotence_ring',
    name: 'Ring of Omnipotence',
    tier: 4,
    stats: { hp: 80, mp: 80, attack: 8, defense: 8, speed: 8, dexterity: 8, vitality: 8, wisdom: 8 },
  },
};

export const PROJECTILES: Record<string, ProjectileDefinition> = {
  magic_bolt: {
    id: 'magic_bolt',
    sprite: 'magic_bolt',
    size: 6,
    color: '#8844ff',
  },
  fire_bolt: {
    id: 'fire_bolt',
    sprite: 'fire_bolt',
    size: 8,
    color: '#ff4400',
  },
  sword_slash: {
    id: 'sword_slash',
    sprite: 'sword_slash',
    size: 10,
    color: '#cccccc',
  },
  arrow: {
    id: 'arrow',
    sprite: 'arrow',
    size: 5,
    color: '#8b4513',
  },
  enemy_bullet: {
    id: 'enemy_bullet',
    sprite: 'enemy_bullet',
    size: 6,
    color: '#ff0000',
  },
  boss_bullet: {
    id: 'boss_bullet',
    sprite: 'boss_bullet',
    size: 10,
    color: '#ff00ff',
  },
};

export const ENEMIES: Record<string, EnemyDefinition> = {
  pirate: {
    id: 'pirate',
    name: 'Pirate',
    hp: 100,
    defense: 2,
    speed: 2,
    radius: 0.4,
    behavior: { type: 'chase', range: 8 },
    attacks: [
      {
        projectileId: 'enemy_bullet',
        damage: [10, 15],
        rateOfFire: 1,
        range: 6,
        projectileSpeed: 8,
        numProjectiles: 1,
        arcGap: 0,
        predictive: false,
      },
    ],
    xpReward: 20,
    lootTable: [
      { itemId: 'hp_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'short_sword', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'fire_wand', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'crossbow', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#8b0000',
  },
  snake: {
    id: 'snake',
    name: 'Snake',
    hp: 50,
    defense: 0,
    speed: 3,
    radius: 0.3,
    behavior: { type: 'wander' },
    attacks: [
      {
        projectileId: 'enemy_bullet',
        damage: [8, 12],
        rateOfFire: 2,
        range: 4,
        projectileSpeed: 10,
        numProjectiles: 1,
        arcGap: 0,
        predictive: false,
      },
    ],
    xpReward: 10,
    lootTable: [
      { itemId: 'hp_ring', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'mp_ring', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#228b22',
  },
  demon: {
    id: 'demon',
    name: 'Demon',
    hp: 300,
    defense: 10,
    speed: 1.5,
    radius: 0.6,
    behavior: { type: 'orbit', range: 5, speed: 2 },
    attacks: [
      {
        projectileId: 'enemy_bullet',
        damage: [25, 40],
        rateOfFire: 1.5,
        range: 8,
        projectileSpeed: 7,
        numProjectiles: 3,
        arcGap: 15,
        predictive: true,
      },
    ],
    xpReward: 100,
    lootTable: [
      { itemId: 'fire_staff', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'broad_sword', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'double_bow', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'attack_ring', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'defense_ring', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#8b008b',
  },
  cube_god: {
    id: 'cube_god',
    name: 'Cube God',
    hp: 2000,
    defense: 25,
    speed: 1,
    radius: 1.0,
    behavior: { type: 'stationary' },
    attacks: [
      {
        projectileId: 'boss_bullet',
        damage: [50, 80],
        rateOfFire: 3,
        range: 12,
        projectileSpeed: 6,
        numProjectiles: 8,
        arcGap: 45,
        predictive: false,
      },
    ],
    xpReward: 500,
    lootTable: [
      { itemId: 'staff_of_destruction', chance: 0.4, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'golden_sword', chance: 0.4, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'heavy_crossbow', chance: 0.4, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'power_ring', chance: 0.5, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#00ffff',
  },
  // Dungeon enemies
  dungeon_minion: {
    id: 'dungeon_minion',
    name: 'Dungeon Minion',
    hp: 150,
    defense: 5,
    speed: 2.5,
    radius: 0.35,
    behavior: { type: 'chase', range: 10 },
    attacks: [
      {
        projectileId: 'enemy_bullet',
        damage: [15, 25],
        rateOfFire: 1.5,
        range: 7,
        projectileSpeed: 9,
        numProjectiles: 2,
        arcGap: 10,
        predictive: true,
      },
    ],
    xpReward: 30,
    lootTable: [
      { itemId: 'hp_ring', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'mp_ring', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#555588',
  },
  dungeon_guardian: {
    id: 'dungeon_guardian',
    name: 'Dungeon Guardian',
    hp: 400,
    defense: 15,
    speed: 1.5,
    radius: 0.5,
    behavior: { type: 'orbit', range: 4, speed: 1.5 },
    attacks: [
      {
        projectileId: 'enemy_bullet',
        damage: [30, 45],
        rateOfFire: 2,
        range: 8,
        projectileSpeed: 8,
        numProjectiles: 4,
        arcGap: 20,
        predictive: false,
      },
    ],
    xpReward: 75,
    lootTable: [
      { itemId: 'fire_staff', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'broad_sword', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'double_bow', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'attack_ring', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#884488',
  },
  dungeon_boss: {
    id: 'dungeon_boss',
    name: 'Dungeon Overlord',
    hp: 5000,
    defense: 30,
    speed: 0.8,
    radius: 1.2,
    behavior: { type: 'orbit', range: 6, speed: 1 },
    attacks: [
      {
        projectileId: 'boss_bullet',
        damage: [60, 100],
        rateOfFire: 2.5,
        range: 15,
        projectileSpeed: 7,
        numProjectiles: 12,
        arcGap: 30,
        predictive: false,
      },
      {
        projectileId: 'enemy_bullet',
        damage: [40, 60],
        rateOfFire: 4,
        range: 10,
        projectileSpeed: 10,
        numProjectiles: 3,
        arcGap: 8,
        predictive: true,
      },
    ],
    xpReward: 1000,
    lootTable: [
      { itemId: 'doom_staff', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'demon_blade', chance: 1.0, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'doom_bow', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'omnipotence_ring', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'power_ring', chance: 0.5, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#ff0088',
  },
};

export const ITEMS: Record<string, ItemDefinition> = {
  // T0 Weapons (starter)
  starter_staff: { id: 'starter_staff', name: 'Starter Staff', type: 'weapon', tier: 0, soulbound: true, description: 'A basic magic staff', color: '#8844ff' },
  starter_sword: { id: 'starter_sword', name: 'Starter Sword', type: 'weapon', tier: 0, soulbound: true, description: 'A basic sword', color: '#cccccc' },
  starter_bow: { id: 'starter_bow', name: 'Starter Bow', type: 'weapon', tier: 0, soulbound: true, description: 'A basic bow', color: '#8b4513' },
  // T1 Weapons
  fire_wand: { id: 'fire_wand', name: 'Fire Wand', type: 'weapon', tier: 1, soulbound: false, description: 'A wand that shoots fire', color: '#ff6600' },
  short_sword: { id: 'short_sword', name: 'Short Sword', type: 'weapon', tier: 1, soulbound: false, description: 'A short but effective blade', color: '#aaaaaa' },
  crossbow: { id: 'crossbow', name: 'Crossbow', type: 'weapon', tier: 1, soulbound: false, description: 'A mechanical bow', color: '#996633' },
  // T2 Weapons
  fire_staff: { id: 'fire_staff', name: 'Staff of Fire', type: 'weapon', tier: 2, soulbound: false, description: 'Shoots two fireballs', color: '#ff4400' },
  broad_sword: { id: 'broad_sword', name: 'Broad Sword', type: 'weapon', tier: 2, soulbound: false, description: 'A wide powerful blade', color: '#888888' },
  double_bow: { id: 'double_bow', name: 'Double Bow', type: 'weapon', tier: 2, soulbound: false, description: 'Fires two arrows at once', color: '#664422' },
  // T3 Weapons
  staff_of_destruction: { id: 'staff_of_destruction', name: 'Staff of Destruction', type: 'weapon', tier: 3, soulbound: false, description: 'Devastating magical power', color: '#ff0066' },
  golden_sword: { id: 'golden_sword', name: 'Golden Sword', type: 'weapon', tier: 3, soulbound: false, description: 'A sword of pure gold', color: '#ffd700' },
  heavy_crossbow: { id: 'heavy_crossbow', name: 'Heavy Crossbow', type: 'weapon', tier: 3, soulbound: false, description: 'Fires 3 heavy bolts', color: '#4a3728' },
  // Abilities
  starter_spell: { id: 'starter_spell', name: 'Magic Nova', type: 'ability', tier: 0, soulbound: true, description: 'A basic spell', color: '#4488ff' },
  starter_helm: { id: 'starter_helm', name: 'Bronze Helm', type: 'ability', tier: 0, soulbound: true, description: 'A basic helm', color: '#cd7f32' },
  starter_quiver: { id: 'starter_quiver', name: 'Basic Quiver', type: 'ability', tier: 0, soulbound: true, description: 'A basic quiver', color: '#8b4513' },
  // Armors
  starter_robe: { id: 'starter_robe', name: 'Starter Robe', type: 'armor', tier: 0, soulbound: true, description: 'A basic robe', color: '#4444aa' },
  starter_heavy: { id: 'starter_heavy', name: 'Starter Plate', type: 'armor', tier: 0, soulbound: true, description: 'Basic plate armor', color: '#888888' },
  starter_leather: { id: 'starter_leather', name: 'Starter Leather', type: 'armor', tier: 0, soulbound: true, description: 'Basic leather armor', color: '#8b4513' },
  // Rings - T1
  hp_ring: { id: 'hp_ring', name: 'Ring of Health', type: 'ring', tier: 1, soulbound: false, description: '+20 HP', color: '#ff4444' },
  mp_ring: { id: 'mp_ring', name: 'Ring of Magic', type: 'ring', tier: 1, soulbound: false, description: '+20 MP', color: '#4444ff' },
  attack_ring: { id: 'attack_ring', name: 'Ring of Attack', type: 'ring', tier: 1, soulbound: false, description: '+3 Attack', color: '#ff8844' },
  // Rings - T2
  defense_ring: { id: 'defense_ring', name: 'Ring of Defense', type: 'ring', tier: 2, soulbound: false, description: '+5 Defense', color: '#44ff44' },
  speed_ring: { id: 'speed_ring', name: 'Ring of Speed', type: 'ring', tier: 2, soulbound: false, description: '+5 Speed', color: '#44ffff' },
  // Rings - T3
  power_ring: { id: 'power_ring', name: 'Ring of Power', type: 'ring', tier: 3, soulbound: false, description: '+5 Attack, +20 HP', color: '#ff00ff' },
  // T4 Epic dungeon drops
  doom_staff: { id: 'doom_staff', name: 'Staff of Doom', type: 'weapon', tier: 4, soulbound: true, description: 'Fires devastating dark bolts', color: '#440066' },
  demon_blade: { id: 'demon_blade', name: 'Demon Blade', type: 'weapon', tier: 4, soulbound: true, description: 'A sword forged in hellfire', color: '#ff2200' },
  doom_bow: { id: 'doom_bow', name: 'Doom Bow', type: 'weapon', tier: 4, soulbound: true, description: 'Fires a single devastating arrow', color: '#222222' },
  omnipotence_ring: { id: 'omnipotence_ring', name: 'Ring of Omnipotence', type: 'ring', tier: 4, soulbound: true, description: '+8 All Stats', color: '#ffdd00' },
};

// Helper functions
export function getStarterEquipment(classId: string): (string | null)[] {
  const cls = CLASSES[classId];
  if (!cls) return [null, null, null, null];

  const weaponMap: Record<string, string> = {
    staff: 'starter_staff',
    sword: 'starter_sword',
    bow: 'starter_bow',
  };

  const abilityMap: Record<string, string> = {
    spell: 'starter_spell',
    helm: 'starter_helm',
    quiver: 'starter_quiver',
  };

  const armorMap: Record<string, string> = {
    robe: 'starter_robe',
    heavy: 'starter_heavy',
    leather: 'starter_leather',
  };

  return [
    weaponMap[cls.weaponType] || null,
    abilityMap[cls.abilityType] || null,
    armorMap[cls.armorType] || null,
    null,
  ];
}

export function getExpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export const MAX_LEVEL = 20;
export const TILE_SIZE = 1; // 1 unit = 1 tile
export const PLAYER_RADIUS = 0.35;
export const PICKUP_RANGE = 1;
export const PORTAL_INTERACT_RANGE = 1.5;
export const AOI_RADIUS = 15; // Area of interest radius in tiles
