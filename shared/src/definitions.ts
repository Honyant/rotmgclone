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

export interface EnemyPhase {
  hpPercent: number; // HP threshold to enter this phase (100 = start, lower = later phases)
  attackIndices: number[]; // Which attacks are active in this phase
  attackDuration: number; // Seconds of attacking
  restDuration: number; // Seconds of rest (no attacks)
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
  phases?: EnemyPhase[]; // Optional phase system for bosses
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
    defensePerLevel: 0,
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
    defensePerLevel: 0,
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
  // T5 Cube Dimension weapons (best in game)
  cube_staff: {
    id: 'cube_staff',
    name: 'Staff of the Cube',
    type: 'staff',
    tier: 5,
    damage: [90, 150],
    rateOfFire: 1.6,
    range: 11,
    projectileSpeed: 18,
    numProjectiles: 4,
    arcGap: 5,
    piercing: true,
    projectileId: 'cube_bullet',
  },
  cube_blade: {
    id: 'cube_blade',
    name: 'Cube Blade',
    type: 'sword',
    tier: 5,
    damage: [130, 200],
    rateOfFire: 2.5,
    range: 5,
    projectileSpeed: 20,
    numProjectiles: 2,
    arcGap: 4,
    piercing: true,
    projectileId: 'cube_bullet',
  },
  cube_bow: {
    id: 'cube_bow',
    name: 'Bow of the Infinite',
    type: 'bow',
    tier: 5,
    damage: [80, 130],
    rateOfFire: 1.2,
    range: 13,
    projectileSpeed: 22,
    numProjectiles: 4,
    arcGap: 5,
    piercing: false,
    projectileId: 'cube_laser',
  },
  // Renamed T3 weapons for clarity
  t3_staff: {
    id: 't3_staff',
    name: 'Arcane Staff',
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
  t3_sword: {
    id: 't3_sword',
    name: 'Mithril Sword',
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
  t3_bow: {
    id: 't3_bow',
    name: 'Elvish Bow',
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
  // T0 - Starter armors
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
  // T1 - Basic armors
  t1_robe: {
    id: 't1_robe',
    name: 'Apprentice Robe',
    type: 'robe',
    tier: 1,
    defense: 4,
    hpBonus: 10,
    mpBonus: 20,
  },
  t1_heavy: {
    id: 't1_heavy',
    name: 'Iron Plate',
    type: 'heavy',
    tier: 1,
    defense: 12,
    hpBonus: 40,
    mpBonus: 0,
  },
  t1_leather: {
    id: 't1_leather',
    name: 'Studded Leather',
    type: 'leather',
    tier: 1,
    defense: 8,
    hpBonus: 20,
    mpBonus: 10,
  },
  // T2 - Intermediate armors
  t2_robe: {
    id: 't2_robe',
    name: 'Mage Robe',
    type: 'robe',
    tier: 2,
    defense: 7,
    hpBonus: 20,
    mpBonus: 35,
  },
  t2_heavy: {
    id: 't2_heavy',
    name: 'Steel Plate',
    type: 'heavy',
    tier: 2,
    defense: 16,
    hpBonus: 60,
    mpBonus: 0,
  },
  t2_leather: {
    id: 't2_leather',
    name: 'Reinforced Leather',
    type: 'leather',
    tier: 2,
    defense: 11,
    hpBonus: 35,
    mpBonus: 15,
  },
  // T3 - Advanced armors
  t3_robe: {
    id: 't3_robe',
    name: 'Archmage Robe',
    type: 'robe',
    tier: 3,
    defense: 10,
    hpBonus: 35,
    mpBonus: 55,
  },
  t3_heavy: {
    id: 't3_heavy',
    name: 'Mithril Plate',
    type: 'heavy',
    tier: 3,
    defense: 22,
    hpBonus: 90,
    mpBonus: 0,
  },
  t3_leather: {
    id: 't3_leather',
    name: 'Dragon Hide',
    type: 'leather',
    tier: 3,
    defense: 15,
    hpBonus: 55,
    mpBonus: 25,
  },
  // T4 - Epic armors (dungeon drops)
  t4_robe: {
    id: 't4_robe',
    name: 'Robe of the Void',
    type: 'robe',
    tier: 4,
    defense: 14,
    hpBonus: 50,
    mpBonus: 80,
  },
  t4_heavy: {
    id: 't4_heavy',
    name: 'Demon Plate',
    type: 'heavy',
    tier: 4,
    defense: 28,
    hpBonus: 120,
    mpBonus: 0,
  },
  t4_leather: {
    id: 't4_leather',
    name: 'Abyssal Leather',
    type: 'leather',
    tier: 4,
    defense: 20,
    hpBonus: 80,
    mpBonus: 40,
  },
  // T5 - Legendary armors (Cube Dimension)
  t5_robe: {
    id: 't5_robe',
    name: 'Robe of the Infinite',
    type: 'robe',
    tier: 5,
    defense: 18,
    hpBonus: 70,
    mpBonus: 110,
  },
  t5_heavy: {
    id: 't5_heavy',
    name: 'Cube Plate',
    type: 'heavy',
    tier: 5,
    defense: 35,
    hpBonus: 160,
    mpBonus: 20,
  },
  t5_leather: {
    id: 't5_leather',
    name: 'Dimensional Leather',
    type: 'leather',
    tier: 5,
    defense: 26,
    hpBonus: 110,
    mpBonus: 55,
  },
};

export const RINGS: Record<string, RingDefinition> = {
  // T1 - Basic stat rings
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
  // T2 - Intermediate rings
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
  dexterity_ring: {
    id: 'dexterity_ring',
    name: 'Ring of Dexterity',
    tier: 2,
    stats: { dexterity: 5 },
  },
  vitality_ring: {
    id: 'vitality_ring',
    name: 'Ring of Vitality',
    tier: 2,
    stats: { vitality: 5 },
  },
  wisdom_ring: {
    id: 'wisdom_ring',
    name: 'Ring of Wisdom',
    tier: 2,
    stats: { wisdom: 5 },
  },
  // T3 - Combined stat rings
  power_ring: {
    id: 'power_ring',
    name: 'Ring of Power',
    tier: 3,
    stats: { attack: 5, hp: 20 },
  },
  fortitude_ring: {
    id: 'fortitude_ring',
    name: 'Ring of Fortitude',
    tier: 3,
    stats: { defense: 6, vitality: 6, hp: 40 },
  },
  swiftness_ring: {
    id: 'swiftness_ring',
    name: 'Ring of Swiftness',
    tier: 3,
    stats: { speed: 6, dexterity: 6 },
  },
  arcana_ring: {
    id: 'arcana_ring',
    name: 'Ring of Arcana',
    tier: 3,
    stats: { mp: 60, wisdom: 6, attack: 3 },
  },
  // T4 - Epic rings
  omnipotence_ring: {
    id: 'omnipotence_ring',
    name: 'Ring of Omnipotence',
    tier: 4,
    stats: { hp: 80, mp: 80, attack: 8, defense: 8, speed: 8, dexterity: 8, vitality: 8, wisdom: 8 },
  },
  // T5 - Cube Dimension special ring
  cube_ring: {
    id: 'cube_ring',
    name: 'Ring of the Cube',
    tier: 5,
    stats: { hp: 120, mp: 100, attack: 10, defense: 10, speed: 10, dexterity: 10, vitality: 10, wisdom: 10 },
  },
  // Admin ring - ridiculous stats
  admin_crown: {
    id: 'admin_crown',
    name: 'Admin Crown',
    tier: 99,
    stats: { hp: 1000000, mp: 100000, attack: 1000, defense: 1000, speed: 50, dexterity: 100, vitality: 1000, wisdom: 1000 },
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
  // Cube Dimension projectiles
  cube_bullet: {
    id: 'cube_bullet',
    sprite: 'cube_bullet',
    size: 7,
    color: '#00ffff',
  },
  cube_laser: {
    id: 'cube_laser',
    sprite: 'cube_laser',
    size: 4,
    color: '#00ff88',
  },
  cube_nova: {
    id: 'cube_nova',
    sprite: 'cube_nova',
    size: 8,
    color: '#88ffff',
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
      { itemId: 't1_robe', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't1_heavy', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't1_leather', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
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
      { itemId: 'hp_ring', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'mp_ring', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't1_robe', chance: 0.05, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't1_heavy', chance: 0.05, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't1_leather', chance: 0.05, minQuantity: 1, maxQuantity: 1 },
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
      // T2 weapons
      { itemId: 'fire_staff', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'broad_sword', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'double_bow', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      // T2 armors
      { itemId: 't2_robe', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't2_heavy', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't2_leather', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      // T2 rings
      { itemId: 'defense_ring', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'speed_ring', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'dexterity_ring', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'vitality_ring', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'wisdom_ring', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      // T1 attack ring (higher chance)
      { itemId: 'attack_ring', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
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
      // T3 weapons
      { itemId: 'staff_of_destruction', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'golden_sword', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'heavy_crossbow', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't3_staff', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't3_sword', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't3_bow', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      // T3 armors
      { itemId: 't3_robe', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't3_heavy', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't3_leather', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      // T3 rings
      { itemId: 'power_ring', chance: 0.35, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'fortitude_ring', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'swiftness_ring', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'arcana_ring', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
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
      // T1 weapons (rare)
      { itemId: 'fire_wand', chance: 0.08, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'short_sword', chance: 0.08, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'crossbow', chance: 0.08, minQuantity: 1, maxQuantity: 1 },
      // T1 armors
      { itemId: 't1_robe', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't1_heavy', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't1_leather', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      // T1 rings
      { itemId: 'hp_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'mp_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'attack_ring', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
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
      // T2 weapons
      { itemId: 'fire_staff', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'broad_sword', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'double_bow', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      // T2 armors
      { itemId: 't2_robe', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't2_heavy', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't2_leather', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
      // T2 rings
      { itemId: 'attack_ring', chance: 0.18, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'defense_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'speed_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'dexterity_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'vitality_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'wisdom_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
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
      // T4 weapons (soulbound)
      { itemId: 'doom_staff', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'demon_blade', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'doom_bow', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      // T4 armors (soulbound)
      { itemId: 't4_robe', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't4_heavy', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't4_leather', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      // T4 ring (soulbound)
      { itemId: 'omnipotence_ring', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      // T3 rings (higher chance)
      { itemId: 'power_ring', chance: 0.4, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'fortitude_ring', chance: 0.35, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'swiftness_ring', chance: 0.35, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'arcana_ring', chance: 0.35, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#ff0088',
  },
  // =====================
  // CUBE DIMENSION ENEMIES
  // =====================
  cube_minion: {
    id: 'cube_minion',
    name: 'Cube Minion',
    hp: 200,
    defense: 8,
    speed: 3,
    radius: 0.35,
    behavior: { type: 'chase', range: 12 },
    attacks: [
      {
        projectileId: 'cube_bullet',
        damage: [20, 35],
        rateOfFire: 2,
        range: 8,
        projectileSpeed: 10,
        numProjectiles: 4,
        arcGap: 90, // Cross pattern
        predictive: false,
      },
    ],
    xpReward: 40,
    lootTable: [
      // T2 weapons (rare)
      { itemId: 'fire_staff', chance: 0.08, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'broad_sword', chance: 0.08, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'double_bow', chance: 0.08, minQuantity: 1, maxQuantity: 1 },
      // T2 armors
      { itemId: 't2_robe', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't2_heavy', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't2_leather', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      // T2 rings
      { itemId: 'dexterity_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'vitality_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'speed_ring', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#00cccc',
  },
  cube_drone: {
    id: 'cube_drone',
    name: 'Cube Drone',
    hp: 100,
    defense: 3,
    speed: 4,
    radius: 0.25,
    behavior: { type: 'orbit', range: 6, speed: 3 },
    attacks: [
      {
        projectileId: 'cube_bullet',
        damage: [15, 25],
        rateOfFire: 3,
        range: 6,
        projectileSpeed: 12,
        numProjectiles: 2,
        arcGap: 180,
        predictive: true,
      },
    ],
    xpReward: 25,
    lootTable: [
      // T1 armors
      { itemId: 't1_robe', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't1_heavy', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't1_leather', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      // T1/T2 rings
      { itemId: 'mp_ring', chance: 0.2, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'hp_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'wisdom_ring', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#44dddd',
  },
  cube_sentinel: {
    id: 'cube_sentinel',
    name: 'Cube Sentinel',
    hp: 600,
    defense: 20,
    speed: 1.2,
    radius: 0.6,
    behavior: { type: 'orbit', range: 5, speed: 1.5 },
    attacks: [
      {
        projectileId: 'cube_bullet',
        damage: [40, 60],
        rateOfFire: 2,
        range: 10,
        projectileSpeed: 8,
        numProjectiles: 8,
        arcGap: 45, // Full circle burst
        predictive: false,
      },
      {
        projectileId: 'cube_laser',
        damage: [60, 80],
        rateOfFire: 0.8,
        range: 12,
        projectileSpeed: 15,
        numProjectiles: 1,
        arcGap: 0,
        predictive: true,
      },
    ],
    xpReward: 100,
    lootTable: [
      // T3 weapons
      { itemId: 't3_staff', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't3_sword', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't3_bow', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'staff_of_destruction', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'golden_sword', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'heavy_crossbow', chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      // T3 armors
      { itemId: 't3_robe', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't3_heavy', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't3_leather', chance: 0.12, minQuantity: 1, maxQuantity: 1 },
      // T3 rings
      { itemId: 'power_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'fortitude_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'swiftness_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'arcana_ring', chance: 0.15, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#00aaaa',
  },
  cube_overlord: {
    id: 'cube_overlord',
    name: 'Cube Overlord',
    hp: 6000,
    defense: 25,
    speed: 0.5,
    radius: 1.5,
    behavior: { type: 'stationary' },
    attacks: [
      // Attack 0: Spread bullets - 12 bullets in a ring
      {
        projectileId: 'cube_bullet',
        damage: [50, 80],
        rateOfFire: 3,
        range: 16,
        projectileSpeed: 5,
        numProjectiles: 12,
        arcGap: 30, // Full 360 coverage
        predictive: false,
      },
      // Attack 1: Targeted laser bursts
      {
        projectileId: 'cube_laser',
        damage: [60, 90],
        rateOfFire: 2,
        range: 14,
        projectileSpeed: 12,
        numProjectiles: 4,
        arcGap: 8,
        predictive: true,
      },
      // Attack 2: Inner ring defense - fast close bullets
      {
        projectileId: 'cube_nova',
        damage: [40, 60],
        rateOfFire: 4,
        range: 8,
        projectileSpeed: 10,
        numProjectiles: 16,
        arcGap: 22.5,
        predictive: false,
      },
    ],
    phases: [
      // Phase 1 (100-66% HP): Just spread bullets, gentle intro
      { hpPercent: 100, attackIndices: [0], attackDuration: 3, restDuration: 2 },
      // Phase 2 (66-33% HP): Add lasers, more intense
      { hpPercent: 66, attackIndices: [0, 1], attackDuration: 4, restDuration: 2 },
      // Phase 3 (33-0% HP): All attacks, no rest - always firing
      { hpPercent: 33, attackIndices: [0, 1, 2], attackDuration: 9999, restDuration: 0 },
    ],
    xpReward: 2000,
    lootTable: [
      { itemId: 'cube_staff', chance: 0.35, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'cube_blade', chance: 0.35, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'cube_bow', chance: 0.35, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'cube_ring', chance: 0.3, minQuantity: 1, maxQuantity: 1 },
      { itemId: 'omnipotence_ring', chance: 0.4, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't5_robe', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't5_heavy', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
      { itemId: 't5_leather', chance: 0.25, minQuantity: 1, maxQuantity: 1 },
    ],
    color: '#00ffff',
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
  t3_staff: { id: 't3_staff', name: 'Arcane Staff', type: 'weapon', tier: 3, soulbound: false, description: 'Powerful arcane magic', color: '#9944ff' },
  t3_sword: { id: 't3_sword', name: 'Mithril Sword', type: 'weapon', tier: 3, soulbound: false, description: 'Forged from rare mithril', color: '#c0c0c0' },
  t3_bow: { id: 't3_bow', name: 'Elvish Bow', type: 'weapon', tier: 3, soulbound: false, description: 'Crafted by elven artisans', color: '#228b22' },
  // T4 Epic dungeon weapons
  doom_staff: { id: 'doom_staff', name: 'Staff of Doom', type: 'weapon', tier: 4, soulbound: true, description: 'Fires devastating dark bolts', color: '#440066' },
  demon_blade: { id: 'demon_blade', name: 'Demon Blade', type: 'weapon', tier: 4, soulbound: true, description: 'A sword forged in hellfire', color: '#ff2200' },
  doom_bow: { id: 'doom_bow', name: 'Doom Bow', type: 'weapon', tier: 4, soulbound: true, description: 'Fires a single devastating arrow', color: '#222222' },
  // T5 Cube Dimension weapons
  cube_staff: { id: 'cube_staff', name: 'Staff of the Cube', type: 'weapon', tier: 5, soulbound: true, description: 'Harnesses dimensional energy', color: '#00ffff' },
  cube_blade: { id: 'cube_blade', name: 'Cube Blade', type: 'weapon', tier: 5, soulbound: true, description: 'Slices through dimensions', color: '#00dddd' },
  cube_bow: { id: 'cube_bow', name: 'Bow of the Infinite', type: 'weapon', tier: 5, soulbound: true, description: 'Fires lasers from another dimension', color: '#00ff88' },
  // Abilities
  starter_spell: { id: 'starter_spell', name: 'Magic Nova', type: 'ability', tier: 0, soulbound: true, description: 'A basic spell', color: '#4488ff' },
  starter_helm: { id: 'starter_helm', name: 'Bronze Helm', type: 'ability', tier: 0, soulbound: true, description: 'A basic helm', color: '#cd7f32' },
  starter_quiver: { id: 'starter_quiver', name: 'Basic Quiver', type: 'ability', tier: 0, soulbound: true, description: 'A basic quiver', color: '#8b4513' },
  // T0 Armors
  starter_robe: { id: 'starter_robe', name: 'Starter Robe', type: 'armor', tier: 0, soulbound: true, description: 'A basic robe', color: '#4444aa' },
  starter_heavy: { id: 'starter_heavy', name: 'Starter Plate', type: 'armor', tier: 0, soulbound: true, description: 'Basic plate armor', color: '#888888' },
  starter_leather: { id: 'starter_leather', name: 'Starter Leather', type: 'armor', tier: 0, soulbound: true, description: 'Basic leather armor', color: '#8b4513' },
  // T1 Armors
  t1_robe: { id: 't1_robe', name: 'Apprentice Robe', type: 'armor', tier: 1, soulbound: false, description: 'A decent robe for mages', color: '#5555bb' },
  t1_heavy: { id: 't1_heavy', name: 'Iron Plate', type: 'armor', tier: 1, soulbound: false, description: 'Solid iron protection', color: '#999999' },
  t1_leather: { id: 't1_leather', name: 'Studded Leather', type: 'armor', tier: 1, soulbound: false, description: 'Leather with metal studs', color: '#996644' },
  // T2 Armors
  t2_robe: { id: 't2_robe', name: 'Mage Robe', type: 'armor', tier: 2, soulbound: false, description: 'Enchanted for magic users', color: '#6666cc' },
  t2_heavy: { id: 't2_heavy', name: 'Steel Plate', type: 'armor', tier: 2, soulbound: false, description: 'Forged steel armor', color: '#aaaaaa' },
  t2_leather: { id: 't2_leather', name: 'Reinforced Leather', type: 'armor', tier: 2, soulbound: false, description: 'Hardened leather armor', color: '#aa7755' },
  // T3 Armors
  t3_robe: { id: 't3_robe', name: 'Archmage Robe', type: 'armor', tier: 3, soulbound: false, description: 'Worn by powerful mages', color: '#7777dd' },
  t3_heavy: { id: 't3_heavy', name: 'Mithril Plate', type: 'armor', tier: 3, soulbound: false, description: 'Legendary mithril armor', color: '#c0c0c0' },
  t3_leather: { id: 't3_leather', name: 'Dragon Hide', type: 'armor', tier: 3, soulbound: false, description: 'Made from dragon scales', color: '#cc8866' },
  // T4 Armors
  t4_robe: { id: 't4_robe', name: 'Robe of the Void', type: 'armor', tier: 4, soulbound: true, description: 'Woven from dark energy', color: '#220044' },
  t4_heavy: { id: 't4_heavy', name: 'Demon Plate', type: 'armor', tier: 4, soulbound: true, description: 'Forged in demon fire', color: '#880000' },
  t4_leather: { id: 't4_leather', name: 'Abyssal Leather', type: 'armor', tier: 4, soulbound: true, description: 'From the depths of the abyss', color: '#442266' },
  // T5 Armors
  t5_robe: { id: 't5_robe', name: 'Robe of the Infinite', type: 'armor', tier: 5, soulbound: true, description: 'Transcends space and time', color: '#0088ff' },
  t5_heavy: { id: 't5_heavy', name: 'Cube Plate', type: 'armor', tier: 5, soulbound: true, description: 'Dimensional alloy armor', color: '#00cccc' },
  t5_leather: { id: 't5_leather', name: 'Dimensional Leather', type: 'armor', tier: 5, soulbound: true, description: 'Phases through attacks', color: '#00aa88' },
  // T1 Rings
  hp_ring: { id: 'hp_ring', name: 'Ring of Health', type: 'ring', tier: 1, soulbound: false, description: '+20 HP', color: '#ff4444' },
  mp_ring: { id: 'mp_ring', name: 'Ring of Magic', type: 'ring', tier: 1, soulbound: false, description: '+20 MP', color: '#4444ff' },
  attack_ring: { id: 'attack_ring', name: 'Ring of Attack', type: 'ring', tier: 1, soulbound: false, description: '+3 Attack', color: '#ff8844' },
  // T2 Rings
  defense_ring: { id: 'defense_ring', name: 'Ring of Defense', type: 'ring', tier: 2, soulbound: false, description: '+5 Defense', color: '#44ff44' },
  speed_ring: { id: 'speed_ring', name: 'Ring of Speed', type: 'ring', tier: 2, soulbound: false, description: '+5 Speed', color: '#44ffff' },
  dexterity_ring: { id: 'dexterity_ring', name: 'Ring of Dexterity', type: 'ring', tier: 2, soulbound: false, description: '+5 Dexterity', color: '#ffff44' },
  vitality_ring: { id: 'vitality_ring', name: 'Ring of Vitality', type: 'ring', tier: 2, soulbound: false, description: '+5 Vitality', color: '#ff44ff' },
  wisdom_ring: { id: 'wisdom_ring', name: 'Ring of Wisdom', type: 'ring', tier: 2, soulbound: false, description: '+5 Wisdom', color: '#44aaff' },
  // T3 Rings
  power_ring: { id: 'power_ring', name: 'Ring of Power', type: 'ring', tier: 3, soulbound: false, description: '+5 Attack, +20 HP', color: '#ff00ff' },
  fortitude_ring: { id: 'fortitude_ring', name: 'Ring of Fortitude', type: 'ring', tier: 3, soulbound: false, description: '+6 Defense, +6 Vitality, +40 HP', color: '#00ff00' },
  swiftness_ring: { id: 'swiftness_ring', name: 'Ring of Swiftness', type: 'ring', tier: 3, soulbound: false, description: '+6 Speed, +6 Dexterity', color: '#00ffff' },
  arcana_ring: { id: 'arcana_ring', name: 'Ring of Arcana', type: 'ring', tier: 3, soulbound: false, description: '+60 MP, +6 Wisdom, +3 Attack', color: '#8800ff' },
  // T4 Rings
  omnipotence_ring: { id: 'omnipotence_ring', name: 'Ring of Omnipotence', type: 'ring', tier: 4, soulbound: true, description: '+8 All Stats', color: '#ffdd00' },
  // T5 Rings
  cube_ring: { id: 'cube_ring', name: 'Ring of the Cube', type: 'ring', tier: 5, soulbound: true, description: '+10 All Stats, Best in game', color: '#00ffff' },
  // Admin item
  admin_crown: { id: 'admin_crown', name: 'Admin Crown', type: 'ring', tier: 99, soulbound: true, description: 'Absolute power', color: '#ffd700' },
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
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

export const MAX_LEVEL = 20;
export const TILE_SIZE = 1; // 1 unit = 1 tile
export const PLAYER_RADIUS = 0.35;
export const PICKUP_RANGE = 1;
export const PORTAL_INTERACT_RANGE = 1.5;
export const AOI_RADIUS = 15; // Area of interest radius in tiles

// Vault constants
export const VAULT_SIZE = 8; // Number of vault slots
export const VAULT_CHEST_INTERACT_RANGE = 1.5; // Range to interact with vault chest

// =====================
// DUNGEON DEFINITIONS
// =====================

export interface DungeonDefinition {
  id: string;
  name: string;
  portalName: string;
  portalColor: string;
  mapSize: number;
  roomCount: [number, number]; // min, max
  bossId: string;
  minionIds: string[];
  guardianIds: string[];
  floorColor: string;
  wallColor: string;
}

export const DUNGEONS: Record<string, DungeonDefinition> = {
  demon_lair: {
    id: 'demon_lair',
    name: 'Demon Lair',
    portalName: 'Demon Lair',
    portalColor: '#8b008b',
    mapSize: 150,
    roomCount: [12, 18],
    bossId: 'dungeon_boss',
    minionIds: ['dungeon_minion'],
    guardianIds: ['dungeon_guardian'],
    floorColor: '#333333',
    wallColor: '#1a1a1a',
  },
  cube_dimension: {
    id: 'cube_dimension',
    name: 'Cube Dimension',
    portalName: 'Cube Dimension',
    portalColor: '#00ffff',
    mapSize: 200,
    roomCount: [15, 22],
    bossId: 'cube_overlord',
    minionIds: ['cube_minion', 'cube_drone'],
    guardianIds: ['cube_sentinel'],
    floorColor: '#112233',
    wallColor: '#001122',
  },
};

// Helper to get dungeon that spawns from a given enemy
export function getDungeonForEnemy(enemyId: string): string | null {
  switch (enemyId) {
    case 'demon': return 'demon_lair';
    case 'cube_god': return 'cube_dimension';
    default: return null;
  }
}

// Drop chance for dungeons
export const DUNGEON_DROP_CHANCE: Record<string, number> = {
  demon: 0.1,
  cube_god: 0.15,
};
