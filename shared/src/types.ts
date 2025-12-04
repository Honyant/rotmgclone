// Entity Types
export type EntityType = 'player' | 'enemy' | 'projectile' | 'loot' | 'portal' | 'vault_chest';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  position: Vec2;
  radius: number;
}

export interface Player extends Entity {
  type: 'player';
  name: string;
  classId: string;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  dexterity: number;
  vitality: number;
  wisdom: number;
  equipment: (string | null)[]; // [weapon, ability, armor, ring]
  inventory: (string | null)[]; // 8 slots
  lastHitTime: number;
}

export interface Enemy extends Entity {
  type: 'enemy';
  definitionId: string;
  hp: number;
  maxHp: number;
}

export interface Projectile extends Entity {
  type: 'projectile';
  ownerId: string;
  ownerType: 'player' | 'enemy';
  definitionId: string;
  velocity: Vec2;
  damage: number;
  piercing: boolean;
  lifetime: number;
  spawnTime: number;
  hitEntities: Set<string>;
}

export interface Loot extends Entity {
  type: 'loot';
  itemId: string;
  despawnTime: number;
}

export interface Portal extends Entity {
  type: 'portal';
  targetInstance: string;
  targetType: 'nexus' | 'realm' | 'dungeon' | 'vault';
  name: string;
}

export interface VaultChest extends Entity {
  type: 'vault_chest';
}

// Network Messages
export type ClientMessage =
  | { type: 'input'; data: PlayerInput }
  | { type: 'shoot'; data: ShootInput }
  | { type: 'useAbility' }
  | { type: 'interact' }
  | { type: 'pickupLoot'; data: { lootId: string } }
  | { type: 'dropItem'; data: { slot: number } }
  | { type: 'swapItems'; data: { from: number; to: number } }
  | { type: 'enterPortal'; data: { portalId: string } }
  | { type: 'returnToNexus' }
  | { type: 'auth'; data: { username: string; password: string } }
  | { type: 'authToken'; data: { token: string } }
  | { type: 'logout'; data: { token: string } }
  | { type: 'register'; data: { username: string; password: string } }
  | { type: 'createCharacter'; data: { classId: string } }
  | { type: 'selectCharacter'; data: { characterId: string } }
  | { type: 'chat'; data: { message: string } }
  | { type: 'interactVaultChest' }
  | { type: 'vaultTransfer'; data: { fromVault: boolean; fromSlot: number; toSlot: number } }
  | { type: 'closeVault' };

export type ServerMessage =
  | { type: 'snapshot'; data: WorldSnapshot }
  | { type: 'damage'; data: DamageEvent }
  | { type: 'death'; data: DeathEvent }
  | { type: 'lootSpawn'; data: LootSpawnEvent }
  | { type: 'levelUp'; data: LevelUpEvent }
  | { type: 'abilityEffect'; data: AbilityEffectEvent }
  | { type: 'authResult'; data: AuthResult }
  | { type: 'registerResult'; data: RegisterResult }
  | { type: 'characterList'; data: CharacterListData }
  | { type: 'instanceChange'; data: InstanceChangeEvent }
  | { type: 'chat'; data: ChatEvent }
  | { type: 'error'; data: { message: string } }
  | { type: 'vaultOpen'; data: VaultOpenEvent }
  | { type: 'vaultUpdate'; data: VaultUpdateEvent };

export interface PlayerInput {
  moveDirection: Vec2; // normalized or zero
  aimAngle: number;
  shooting: boolean;
}

export interface ShootInput {
  aimAngle: number;
}

export interface WorldSnapshot {
  tick: number;
  timestamp: number;
  instanceId: string;
  instanceType: 'nexus' | 'realm' | 'dungeon' | 'vault';
  players: PlayerSnapshot[];
  enemies: EnemySnapshot[];
  projectiles: ProjectileSnapshot[];
  loots: LootSnapshot[];
  portals: PortalSnapshot[];
  vaultChests: VaultChestSnapshot[];
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  classId: string;
  position: Vec2;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  exp: number;
  attack: number;
  defense: number;
  speed: number;
  dexterity: number;
  vitality: number;
  wisdom: number;
  equipment: (string | null)[];
  inventory: (string | null)[];
}

export interface EnemySnapshot {
  id: string;
  definitionId: string;
  position: Vec2;
  hp: number;
  maxHp: number;
}

export interface ProjectileSnapshot {
  id: string;
  definitionId: string;
  position: Vec2;
  velocity: Vec2;
  ownerType: 'player' | 'enemy';
}

export interface LootSnapshot {
  id: string;
  itemId: string;
  items: string[];
  position: Vec2;
  soulbound: boolean;
}

export interface PortalSnapshot {
  id: string;
  position: Vec2;
  targetType: 'nexus' | 'realm' | 'dungeon' | 'vault';
  name: string;
  visible: boolean;
}

export interface VaultChestSnapshot {
  id: string;
  position: Vec2;
}

export interface DamageEvent {
  targetId: string;
  damage: number;
  newHp: number;
}

export interface PlayerDeathStats {
  characterName: string;
  className: string;
  level: number;
  totalXp: number;
  enemiesKilled: number;
  damageDealt: number;
  damageTaken: number;
  shotsFired: number;
  abilitiesUsed: number;
  dungeonsClearedCount: number;
  timePlayed: number; // seconds
  killedBy: string;
}

export interface DeathEvent {
  entityId: string;
  entityType: 'player' | 'enemy';
  killerName?: string;
  stats?: PlayerDeathStats; // Only for player deaths
}

export interface LootSpawnEvent {
  loot: LootSnapshot;
}

export interface LevelUpEvent {
  playerId: string;
  newLevel: number;
}

export interface AbilityEffectEvent {
  playerId: string;
  effectType: 'damage' | 'buff' | 'heal' | 'teleport';
  position: Vec2;
  radius?: number; // for damage abilities
  stat?: string; // for buff abilities
  duration?: number; // for buff abilities
}

export interface AuthResult {
  success: boolean;
  accountId?: string;
  token?: string;
  error?: string;
}

export interface RegisterResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface CharacterListData {
  characters: CharacterData[];
  maxCharacters: number;
}

export interface CharacterData {
  id: string;
  name: string;
  classId: string;
  level: number;
  alive: boolean;
}

export interface InstanceChangeEvent {
  instanceId: string;
  instanceType: 'nexus' | 'realm' | 'dungeon' | 'vault';
  spawnPosition: Vec2;
  playerId: string;
  mapWidth: number;
  mapHeight: number;
  mapTiles: number[];
}

export interface VaultOpenEvent {
  vaultItems: (string | null)[];
}

export interface VaultUpdateEvent {
  vaultItems: (string | null)[];
}

export interface ChatEvent {
  sender: string;
  message: string;
  timestamp: number;
}

// Map Types
export enum TileType {
  VOID = 0,
  FLOOR = 1,
  WALL = 2,
  WATER = 3,
  LAVA = 4,
  SPAWN = 5,
  BOSS_FLOOR = 6,
}

export interface MapData {
  width: number;
  height: number;
  tiles: TileType[];
  spawnRegions: SpawnRegion[];
}

export interface SpawnRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  enemyTypes: string[];
  maxEnemies: number;
  spawnRate: number; // enemies per second
}

// Account/Character persistence
export interface Account {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
  vaultItems: (string | null)[];
}

export interface Character {
  id: string;
  accountId: string;
  name: string;
  classId: string;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  dexterity: number;
  vitality: number;
  wisdom: number;
  equipment: (string | null)[];
  inventory: (string | null)[];
  alive: boolean;
  createdAt: number;
  deathTime?: number;
}
