import { v4 as uuid } from 'uuid';
import {
  Vec2,
  WorldSnapshot,
  PlayerSnapshot,
  EnemySnapshot,
  ProjectileSnapshot,
  LootSnapshot,
  PortalSnapshot,
  DamageEvent,
  DeathEvent,
  LootSpawnEvent,
  LevelUpEvent,
  AbilityEffectEvent,
  AOI_RADIUS,
  ENEMIES,
  ITEMS,
  PICKUP_RANGE,
  PORTAL_INTERACT_RANGE,
  AbilityDefinition,
} from '@rotmg/shared';
import { GameMap } from '../game/GameMap.js';
import { PlayerEntity } from '../game/PlayerEntity.js';
import { EnemyEntity } from '../game/EnemyEntity.js';
import { ProjectileEntity } from '../game/ProjectileEntity.js';
import { LootEntity } from '../game/LootEntity.js';
import { PortalEntity } from '../game/PortalEntity.js';
import { Entity } from '../game/Entity.js';
import { GameServer } from '../network/GameServer.js';

export type InstanceType = 'nexus' | 'realm' | 'dungeon';

export class Instance {
  id: string;
  type: InstanceType;
  map: GameMap;
  private players: Map<string, PlayerEntity> = new Map();
  private enemies: Map<string, EnemyEntity> = new Map();
  private projectiles: Map<string, ProjectileEntity> = new Map();
  private loots: Map<string, LootEntity> = new Map();
  private portals: Map<string, PortalEntity> = new Map();
  private gameServer: GameServer | null = null;
  private spawnTimers: Map<number, number> = new Map();
  private safeZone: boolean;

  // Dungeon-specific properties
  private bossRoomCenter: Vec2 | null = null;
  private sourceInstanceId: string | null = null;
  private bossKilled: boolean = false;
  private initialSpawnDone: boolean = false;
  private fixedSpawnPosition: Vec2 | null = null; // Cached spawn position for dungeons

  constructor(type: InstanceType, map: GameMap, id?: string) {
    this.id = id || uuid();
    this.type = type;
    this.map = map;
    this.safeZone = type === 'nexus';

    // Initialize spawn timers for each region
    map.spawnRegions.forEach((_, index) => {
      this.spawnTimers.set(index, 0);
    });
  }

  setGameServer(server: GameServer): void {
    this.gameServer = server;
  }

  update(deltaTime: number, tick: number): void {
    // Update all entities
    for (const player of this.players.values()) {
      player.update(deltaTime);

      // Auto-heal in safe zones (nexus)
      if (this.safeZone) {
        this.healPlayer(player, deltaTime);
      }
    }

    for (const enemy of this.enemies.values()) {
      enemy.update(deltaTime);
    }

    for (const projectile of this.projectiles.values()) {
      projectile.update(deltaTime);

      // Check wall collision
      if (!this.map.isWalkable(projectile.position.x, projectile.position.y)) {
        projectile.remove();
      }
    }

    for (const loot of this.loots.values()) {
      loot.update(deltaTime);
    }

    for (const portal of this.portals.values()) {
      portal.update(deltaTime);
    }

    // Resolve combat (only in non-safe zones)
    if (!this.safeZone) {
      this.resolveCombat();
      this.updateSpawns(deltaTime);
    }

    // Remove marked entities
    this.cleanupEntities();

    // Send snapshots to players
    if (tick % 2 === 0) {
      // Send at half tick rate to save bandwidth
      this.sendSnapshots(tick);
    }
  }

  private healPlayer(player: PlayerEntity, deltaTime: number): void {
    // Heal 20% HP and MP per second in nexus
    const hpRegen = player.maxHp * 0.2 * deltaTime;
    const mpRegen = player.maxMp * 0.2 * deltaTime;

    if (player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + hpRegen);
    }
    if (player.mp < player.maxMp) {
      player.mp = Math.min(player.maxMp, player.mp + mpRegen);
    }
  }

  private resolveCombat(): void {
    // Check player projectiles hitting enemies
    for (const projectile of this.projectiles.values()) {
      if (projectile.markedForRemoval) continue;

      if (projectile.ownerType === 'player') {
        for (const enemy of this.enemies.values()) {
          if (enemy.markedForRemoval) continue;
          if (projectile.hasHit(enemy.id)) continue;

          if (projectile.collidesWith(enemy)) {
            const damage = enemy.takeDamage(projectile.damage, projectile.ownerId);
            projectile.recordHit(enemy.id);

            // Send damage event
            this.broadcastToNearby(enemy.position, {
              type: 'damage',
              data: { targetId: enemy.id, damage, newHp: enemy.hp },
            });

            // Check if enemy died
            if (enemy.isDead()) {
              this.handleEnemyDeath(enemy, projectile.ownerId);
            }
          }
        }
      } else {
        // Enemy projectiles hitting players
        for (const player of this.players.values()) {
          if (player.markedForRemoval) continue;
          if (projectile.hasHit(player.id)) continue;

          if (projectile.collidesWith(player)) {
            const damage = player.takeDamage(projectile.damage);
            projectile.recordHit(player.id);

            // Send damage event
            this.sendToPlayer(player.id, {
              type: 'damage',
              data: { targetId: player.id, damage, newHp: player.hp },
            });

            // Check if player died
            if (player.isDead()) {
              this.handlePlayerDeath(player);
            }
          }
        }
      }
    }
  }

  private handleEnemyDeath(enemy: EnemyEntity, killerId: string): void {
    enemy.remove();

    // Award XP to killer
    const killer = this.players.get(killerId);
    if (killer) {
      const leveledUp = killer.addExp(enemy.definition.xpReward);
      if (leveledUp) {
        this.sendToPlayer(killer.id, {
          type: 'levelUp',
          data: { playerId: killer.id, newLevel: killer.level },
        });
      }
    }

    // Get players who dealt enough damage to qualify for soulbound loot
    const qualifiedPlayers = enemy.getQualifiedPlayers();

    // Drop loot
    for (const entry of enemy.definition.lootTable) {
      if (Math.random() < entry.chance) {
        const itemDef = ITEMS[entry.itemId];
        const isSoulbound = itemDef?.soulbound ?? false;

        if (isSoulbound) {
          // For soulbound items, each qualified player gets their own bag
          for (const playerId of qualifiedPlayers) {
            const loot = new LootEntity(
              entry.itemId,
              { ...enemy.position },
              60,
              playerId,
              true
            );
            this.loots.set(loot.id, loot);

            this.sendToPlayer(playerId, {
              type: 'lootSpawn',
              data: { loot: this.lootToSnapshot(loot) },
            });
          }
        } else {
          // Non-soulbound items go in a public bag
          const loot = new LootEntity(
            entry.itemId,
            { ...enemy.position },
            60,
            null,
            false
          );
          this.loots.set(loot.id, loot);

          this.broadcastToNearby(enemy.position, {
            type: 'lootSpawn',
            data: { loot: this.lootToSnapshot(loot) },
          });
        }
      }
    }

    // Check for special enemy types
    if (this.gameServer) {
      // Demons have 10% chance to drop dungeon portal (only in realm)
      if (enemy.definitionId === 'demon' && this.type === 'realm') {
        if (Math.random() < 0.1) {
          this.gameServer.spawnDungeonPortal(this, { ...enemy.position });
        }
      }

      // Dungeon boss death spawns return portal
      if (enemy.definitionId === 'dungeon_boss' && this.type === 'dungeon' && !this.bossKilled) {
        this.bossKilled = true;
        this.gameServer.onDungeonBossKilled(this, { ...enemy.position });
      }
    }

    // Send death event
    this.broadcastToNearby(enemy.position, {
      type: 'death',
      data: { entityId: enemy.id, entityType: 'enemy' },
    });
  }

  private handlePlayerDeath(player: PlayerEntity): void {
    player.remove();

    // Broadcast death
    this.broadcastToNearby(player.position, {
      type: 'death',
      data: { entityId: player.id, entityType: 'player', killerName: 'Enemy' },
    });

    // Notify game server to handle character death
    if (this.gameServer) {
      this.gameServer.handlePlayerDeath(player);
    }
  }

  private updateSpawns(deltaTime: number): void {
    // Dungeons don't respawn enemies after initial spawn
    if (this.type === 'dungeon' && this.initialSpawnDone) {
      return;
    }

    for (let i = 0; i < this.map.spawnRegions.length; i++) {
      const region = this.map.spawnRegions[i];
      let timer = this.spawnTimers.get(i) || 0;
      timer += deltaTime;

      // Count enemies in region
      let enemiesInRegion = 0;
      for (const enemy of this.enemies.values()) {
        if (
          enemy.position.x >= region.x &&
          enemy.position.x < region.x + region.width &&
          enemy.position.y >= region.y &&
          enemy.position.y < region.y + region.height
        ) {
          enemiesInRegion++;
        }
      }

      // Spawn if under max and timer elapsed
      const spawnInterval = 1 / region.spawnRate;
      if (timer >= spawnInterval && enemiesInRegion < region.maxEnemies) {
        const pos = this.map.findRandomPositionInRegion(region);
        if (pos) {
          const enemyType = region.enemyTypes[Math.floor(Math.random() * region.enemyTypes.length)];
          this.spawnEnemy(enemyType, pos);
        }
        timer = 0;
      }

      this.spawnTimers.set(i, timer);
    }
  }

  private cleanupEntities(): void {
    for (const [id, entity] of this.projectiles) {
      if (entity.markedForRemoval) {
        this.projectiles.delete(id);
      }
    }

    for (const [id, entity] of this.enemies) {
      if (entity.markedForRemoval) {
        this.enemies.delete(id);
      }
    }

    for (const [id, entity] of this.loots) {
      if (entity.markedForRemoval) {
        this.loots.delete(id);
      }
    }

    for (const [id, entity] of this.players) {
      if (entity.markedForRemoval) {
        this.players.delete(id);
      }
    }

    for (const [id, entity] of this.portals) {
      if (entity.markedForRemoval) {
        this.portals.delete(id);
      }
    }
  }

  private sendSnapshots(tick: number): void {
    const timestamp = Date.now();

    for (const player of this.players.values()) {
      const snapshot = this.createSnapshotForPlayer(player, tick, timestamp);
      this.sendToPlayer(player.id, { type: 'snapshot', data: snapshot });
    }
  }

  private createSnapshotForPlayer(player: PlayerEntity, tick: number, timestamp: number): WorldSnapshot {
    const pos = player.position;

    // Get entities in AOI
    const nearbyPlayers: PlayerSnapshot[] = [];
    const nearbyEnemies: EnemySnapshot[] = [];
    const nearbyProjectiles: ProjectileSnapshot[] = [];
    const nearbyLoots: LootSnapshot[] = [];
    const nearbyPortals: PortalSnapshot[] = [];

    for (const p of this.players.values()) {
      if (this.inAOI(pos, p.position)) {
        nearbyPlayers.push(this.playerToSnapshot(p));
      }
    }

    for (const e of this.enemies.values()) {
      if (this.inAOI(pos, e.position)) {
        nearbyEnemies.push(this.enemyToSnapshot(e));
      }
    }

    for (const pr of this.projectiles.values()) {
      if (this.inAOI(pos, pr.position)) {
        nearbyProjectiles.push(this.projectileToSnapshot(pr));
      }
    }

    for (const l of this.loots.values()) {
      if (this.inAOI(pos, l.position)) {
        // Filter out soulbound bags that don't belong to this player
        if (l.soulbound && l.ownerId !== player.id) {
          continue;
        }
        nearbyLoots.push(this.lootToSnapshot(l));
      }
    }

    for (const portal of this.portals.values()) {
      if (this.inAOI(pos, portal.position)) {
        nearbyPortals.push(this.portalToSnapshot(portal));
      }
    }

    return {
      tick,
      timestamp,
      instanceId: this.id,
      instanceType: this.type,
      players: nearbyPlayers,
      enemies: nearbyEnemies,
      projectiles: nearbyProjectiles,
      loots: nearbyLoots,
      portals: nearbyPortals,
    };
  }

  private inAOI(center: Vec2, pos: Vec2): boolean {
    const dx = center.x - pos.x;
    const dy = center.y - pos.y;
    return dx * dx + dy * dy <= AOI_RADIUS * AOI_RADIUS;
  }

  // Entity snapshot converters
  private playerToSnapshot(p: PlayerEntity): PlayerSnapshot {
    return {
      id: p.id,
      name: p.name,
      classId: p.classId,
      position: { ...p.position },
      hp: p.hp,
      maxHp: p.maxHp,
      mp: p.mp,
      maxMp: p.maxMp,
      level: p.level,
      exp: p.exp,
      attack: p.attack,
      defense: p.defense,
      speed: p.speed,
      dexterity: p.dexterity,
      vitality: p.vitality,
      wisdom: p.wisdom,
      equipment: [...p.equipment],
      inventory: [...p.inventory],
    };
  }

  private enemyToSnapshot(e: EnemyEntity): EnemySnapshot {
    return {
      id: e.id,
      definitionId: e.definitionId,
      position: { ...e.position },
      hp: e.hp,
      maxHp: e.maxHp,
    };
  }

  private projectileToSnapshot(p: ProjectileEntity): ProjectileSnapshot {
    return {
      id: p.id,
      definitionId: p.definitionId,
      position: { ...p.position },
      velocity: { ...p.velocity },
      ownerType: p.ownerType,
    };
  }

  private lootToSnapshot(l: LootEntity): LootSnapshot {
    return {
      id: l.id,
      itemId: l.itemId,
      items: [...l.items],
      position: { ...l.position },
      soulbound: l.soulbound,
    };
  }

  private portalToSnapshot(p: PortalEntity): PortalSnapshot {
    return {
      id: p.id,
      position: { ...p.position },
      targetType: p.targetType,
      name: p.name,
      visible: p.visible,
    };
  }

  // Public methods for entity management
  addPlayer(player: PlayerEntity): void {
    player.instance = this;
    // Use fixed spawn position for dungeons so all players spawn at the same place
    if (this.type === 'dungeon') {
      if (!this.fixedSpawnPosition) {
        this.fixedSpawnPosition = this.map.findSpawnPosition();
      }
      player.position = { ...this.fixedSpawnPosition };
    } else {
      player.position = this.map.findSpawnPosition();
    }
    this.players.set(player.id, player);
  }

  removePlayer(playerId: string): PlayerEntity | undefined {
    const player = this.players.get(playerId);
    if (player) {
      player.instance = null;
      this.players.delete(playerId);
    }
    return player;
  }

  getPlayer(playerId: string): PlayerEntity | undefined {
    return this.players.get(playerId);
  }

  getPlayersNear(pos: Vec2, radius: number): PlayerEntity[] {
    const result: PlayerEntity[] = [];
    for (const player of this.players.values()) {
      const dx = player.position.x - pos.x;
      const dy = player.position.y - pos.y;
      if (dx * dx + dy * dy <= radius * radius) {
        result.push(player);
      }
    }
    return result;
  }

  spawnEnemy(definitionId: string, position: Vec2): EnemyEntity {
    const enemy = new EnemyEntity(definitionId, position, this);
    this.enemies.set(enemy.id, enemy);
    return enemy;
  }

  spawnProjectile(
    ownerId: string,
    ownerType: 'player' | 'enemy',
    definitionId: string,
    position: Vec2,
    angle: number,
    speed: number,
    damage: number,
    piercing: boolean,
    lifetime: number
  ): ProjectileEntity {
    const projectile = new ProjectileEntity(
      ownerId,
      ownerType,
      definitionId,
      position,
      angle,
      speed,
      damage,
      piercing,
      lifetime
    );
    this.projectiles.set(projectile.id, projectile);
    return projectile;
  }

  addPortal(portal: PortalEntity): void {
    this.portals.set(portal.id, portal);
  }

  getPortal(portalId: string): PortalEntity | undefined {
    return this.portals.get(portalId);
  }

  getLoot(lootId: string): LootEntity | undefined {
    return this.loots.get(lootId);
  }

  removeLoot(lootId: string): void {
    this.loots.delete(lootId);
  }

  tryPickupLoot(player: PlayerEntity, lootId: string): boolean {
    const loot = this.loots.get(lootId);
    if (!loot) return false;

    // Soulbound bags can only be picked up by the owner
    if (loot.soulbound && loot.ownerId !== player.id) return false;

    const dist = player.distanceTo(loot);
    if (dist > PICKUP_RANGE) return false;

    // Pick up the first item in the bag
    if (loot.items.length > 0 && player.addToInventory(loot.items[0])) {
      loot.removeItem(0);
      // If bag is now empty, it will self-remove via markedForRemoval
      return true;
    }
    return false;
  }

  dropItem(player: PlayerEntity, itemId: string): void {
    const DROP_MERGE_RANGE = 0.5;
    const itemDef = ITEMS[itemId];
    const isSoulbound = itemDef?.soulbound ?? false;

    // Check if there's an existing loot bag from this player nearby
    // Soulbound items can only go into soulbound bags owned by this player
    for (const loot of this.loots.values()) {
      if (loot.ownerId === player.id && loot.soulbound === isSoulbound) {
        const dx = loot.position.x - player.position.x;
        const dy = loot.position.y - player.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < DROP_MERGE_RANGE && loot.addItem(itemId)) {
          // Successfully added to existing bag
          return;
        }
      }
    }

    // Create new loot bag at player position
    const loot = new LootEntity(itemId, { ...player.position }, 60, player.id, isSoulbound);
    this.loots.set(loot.id, loot);

    // Soulbound bags only visible to owner
    if (isSoulbound) {
      this.sendToPlayer(player.id, {
        type: 'lootSpawn',
        data: { loot: this.lootToSnapshot(loot) },
      });
    } else {
      this.broadcastToNearby(player.position, {
        type: 'lootSpawn',
        data: { loot: this.lootToSnapshot(loot) },
      });
    }
  }

  tryEnterPortal(player: PlayerEntity, portalId: string): PortalEntity | null {
    const portal = this.portals.get(portalId);
    if (!portal) return null;

    const dist = player.distanceTo(portal);
    if (dist > PORTAL_INTERACT_RANGE) return null;

    return portal;
  }

  // Networking helpers
  private sendToPlayer(playerId: string, message: any): void {
    if (this.gameServer) {
      this.gameServer.sendToPlayer(playerId, message);
    }
  }

  private broadcastToNearby(pos: Vec2, message: any): void {
    for (const player of this.players.values()) {
      if (this.inAOI(pos, player.position)) {
        this.sendToPlayer(player.id, message);
      }
    }
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  // Dungeon-specific methods
  setBossRoomCenter(center: Vec2): void {
    this.bossRoomCenter = center;
  }

  getBossRoomCenter(): Vec2 | null {
    return this.bossRoomCenter;
  }

  setSourceInstanceId(id: string): void {
    this.sourceInstanceId = id;
  }

  getSourceInstanceId(): string | null {
    return this.sourceInstanceId;
  }

  isBossKilled(): boolean {
    return this.bossKilled;
  }

  // Spawn all enemies at once for dungeons (no respawning)
  spawnInitialEnemies(): void {
    if (this.initialSpawnDone) return;

    for (const region of this.map.spawnRegions) {
      // Spawn up to maxEnemies for each region
      for (let i = 0; i < region.maxEnemies; i++) {
        const pos = this.map.findRandomPositionInRegion(region);
        if (pos) {
          const enemyType = region.enemyTypes[Math.floor(Math.random() * region.enemyTypes.length)];
          this.spawnEnemy(enemyType, pos);
        }
      }
    }

    this.initialSpawnDone = true;
  }

  // Execute ability effects
  executeAbility(player: PlayerEntity, ability: AbilityDefinition): void {
    const effect = ability.effect;

    switch (effect.type) {
      case 'damage': {
        // Wizard spell bomb - AOE damage at player position
        const radius = effect.radius;
        const damage = effect.damage;

        // Broadcast ability effect for visual
        this.broadcastToNearby(player.position, {
          type: 'abilityEffect',
          data: {
            playerId: player.id,
            effectType: 'damage',
            position: { ...player.position },
            radius,
          },
        });

        // Find all enemies within radius
        for (const enemy of this.enemies.values()) {
          if (enemy.markedForRemoval) continue;

          const dx = enemy.position.x - player.position.x;
          const dy = enemy.position.y - player.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= radius) {
            const actualDamage = enemy.takeDamage(damage, player.id);

            // Send damage event
            this.broadcastToNearby(enemy.position, {
              type: 'damage',
              data: { targetId: enemy.id, damage: actualDamage, newHp: enemy.hp },
            });

            // Check if enemy died
            if (enemy.isDead()) {
              this.handleEnemyDeath(enemy, player.id);
            }
          }
        }
        break;
      }

      case 'buff': {
        // Warrior helm - Apply buff to player
        player.addBuff(effect.stat, effect.amount, effect.duration);

        // Broadcast ability effect for visual
        this.broadcastToNearby(player.position, {
          type: 'abilityEffect',
          data: {
            playerId: player.id,
            effectType: 'buff',
            position: { ...player.position },
            stat: effect.stat,
            duration: effect.duration,
          },
        });
        break;
      }

      case 'heal': {
        // Heal ability - restore HP
        player.hp = Math.min(player.maxHp, player.hp + effect.amount);

        // Broadcast ability effect for visual
        this.broadcastToNearby(player.position, {
          type: 'abilityEffect',
          data: {
            playerId: player.id,
            effectType: 'heal',
            position: { ...player.position },
          },
        });
        break;
      }

      case 'teleport': {
        // Teleport ability - move player toward aim direction
        if (player.lastInput) {
          const aimAngle = player.lastInput.aimAngle;
          const range = effect.range;
          const targetX = player.position.x + Math.cos(aimAngle) * range;
          const targetY = player.position.y + Math.sin(aimAngle) * range;

          // Check if target position is valid
          if (this.map.canMoveTo(targetX, targetY, player.radius)) {
            player.position.x = targetX;
            player.position.y = targetY;

            // Broadcast ability effect for visual
            this.broadcastToNearby(player.position, {
              type: 'abilityEffect',
              data: {
                playerId: player.id,
                effectType: 'teleport',
                position: { ...player.position },
              },
            });
          }
        }
        break;
      }
    }
  }
}
