import { Enemy, Vec2, ENEMIES, EnemyDefinition, EnemyAttack } from '@rotmg/shared';
import { Entity, normalizeVec2, vec2Sub, vec2Length } from './Entity.js';
import { Instance } from '../instances/Instance.js';
import { PlayerEntity } from './PlayerEntity.js';

export class EnemyEntity extends Entity implements Enemy {
  type: 'enemy' = 'enemy';
  definitionId: string;
  hp: number;
  maxHp: number;
  definition: EnemyDefinition;
  instance: Instance;

  // AI state
  private targetPlayer: PlayerEntity | null = null;
  private lastAttackTimes: number[] = [];
  private wanderTarget: Vec2 | null = null;
  private wanderTimer: number = 0;
  private orbitAngle: number = 0;

  // Damage tracking for soulbound qualification
  private damageByPlayer: Map<string, number> = new Map();

  constructor(definitionId: string, position: Vec2, instance: Instance) {
    const def = ENEMIES[definitionId];
    if (!def) throw new Error(`Unknown enemy definition: ${definitionId}`);

    super(position, def.radius);
    this.definitionId = definitionId;
    this.definition = def;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.instance = instance;
    this.lastAttackTimes = def.attacks.map(() => 0);
    this.orbitAngle = Math.random() * Math.PI * 2;
  }

  update(deltaTime: number): void {
    // Find nearest player
    this.updateTarget();

    // Execute behavior
    this.executeBehavior(deltaTime);

    // Try to attack
    this.tryAttack();
  }

  private updateTarget(): void {
    const players = this.instance.getPlayersNear(this.position, 15);
    if (players.length === 0) {
      this.targetPlayer = null;
      return;
    }

    // Find closest player
    let closest: PlayerEntity | null = null;
    let closestDist = Infinity;

    for (const player of players) {
      const dist = this.distanceTo(player);
      if (dist < closestDist) {
        closestDist = dist;
        closest = player;
      }
    }

    this.targetPlayer = closest;
  }

  private executeBehavior(deltaTime: number): void {
    const behavior = this.definition.behavior;

    switch (behavior.type) {
      case 'wander':
        this.doWander(deltaTime);
        break;
      case 'chase':
        this.doChase(deltaTime, behavior.range);
        break;
      case 'orbit':
        this.doOrbit(deltaTime, behavior.range, behavior.speed);
        break;
      case 'stationary':
        // Do nothing
        break;
    }
  }

  private doWander(deltaTime: number): void {
    this.wanderTimer -= deltaTime;

    if (this.wanderTimer <= 0 || !this.wanderTarget) {
      // Pick new wander target
      const range = 3;
      this.wanderTarget = {
        x: this.position.x + (Math.random() - 0.5) * range * 2,
        y: this.position.y + (Math.random() - 0.5) * range * 2,
      };
      this.wanderTimer = 2 + Math.random() * 3;
    }

    // Move toward wander target
    const newX = this.position.x + (this.wanderTarget.x > this.position.x ? 1 : -1) * this.definition.speed * deltaTime;
    const newY = this.position.y + (this.wanderTarget.y > this.position.y ? 1 : -1) * this.definition.speed * deltaTime;

    if (this.instance.map.canMoveTo(newX, newY, this.radius)) {
      this.position.x = newX;
      this.position.y = newY;
    } else {
      // Pick new target if stuck
      this.wanderTimer = 0;
    }
  }

  private doChase(deltaTime: number, range: number): void {
    if (!this.targetPlayer) {
      this.doWander(deltaTime);
      return;
    }

    const dist = this.distanceTo(this.targetPlayer);
    if (dist > range) {
      this.doWander(deltaTime);
      return;
    }

    // Chase player but keep some distance for ranged enemies
    const minDist = Math.max(2, this.definition.attacks[0]?.range * 0.5 || 2);
    if (dist > minDist) {
      const dir = normalizeVec2(vec2Sub(this.targetPlayer.position, this.position));
      const newX = this.position.x + dir.x * this.definition.speed * deltaTime;
      const newY = this.position.y + dir.y * this.definition.speed * deltaTime;

      if (this.instance.map.canMoveTo(newX, newY, this.radius)) {
        this.position.x = newX;
        this.position.y = newY;
      }
    }
  }

  private doOrbit(deltaTime: number, range: number, orbitSpeed: number): void {
    if (!this.targetPlayer) {
      this.doWander(deltaTime);
      return;
    }

    const dist = this.distanceTo(this.targetPlayer);

    // Move toward preferred orbit range
    if (dist > range + 1) {
      const dir = normalizeVec2(vec2Sub(this.targetPlayer.position, this.position));
      const newX = this.position.x + dir.x * this.definition.speed * deltaTime;
      const newY = this.position.y + dir.y * this.definition.speed * deltaTime;

      if (this.instance.map.canMoveTo(newX, newY, this.radius)) {
        this.position.x = newX;
        this.position.y = newY;
      }
    } else {
      // Orbit around player
      this.orbitAngle += orbitSpeed * deltaTime;
      const targetX = this.targetPlayer.position.x + Math.cos(this.orbitAngle) * range;
      const targetY = this.targetPlayer.position.y + Math.sin(this.orbitAngle) * range;

      const dir = normalizeVec2(vec2Sub({ x: targetX, y: targetY }, this.position));
      const newX = this.position.x + dir.x * this.definition.speed * deltaTime;
      const newY = this.position.y + dir.y * this.definition.speed * deltaTime;

      if (this.instance.map.canMoveTo(newX, newY, this.radius)) {
        this.position.x = newX;
        this.position.y = newY;
      }
    }
  }

  private tryAttack(): void {
    if (!this.targetPlayer) return;

    const now = Date.now();
    const dist = this.distanceTo(this.targetPlayer);

    for (let i = 0; i < this.definition.attacks.length; i++) {
      const attack = this.definition.attacks[i];
      const lastAttack = this.lastAttackTimes[i];
      const fireInterval = 1000 / attack.rateOfFire;

      if (now - lastAttack >= fireInterval && dist <= attack.range) {
        this.fireAttack(attack, i);
        this.lastAttackTimes[i] = now;
      }
    }
  }

  private fireAttack(attack: EnemyAttack, attackIndex: number): void {
    if (!this.targetPlayer) return;

    // Calculate aim direction
    let aimAngle: number;
    if (attack.predictive && this.targetPlayer.lastInput) {
      // Predict player position
      const playerVel = normalizeVec2(this.targetPlayer.lastInput.moveDirection);
      const playerSpeed = this.targetPlayer.getEffectiveSpeed();
      const timeToHit = this.distanceTo(this.targetPlayer) / attack.projectileSpeed;
      const predictedPos = {
        x: this.targetPlayer.position.x + playerVel.x * playerSpeed * timeToHit,
        y: this.targetPlayer.position.y + playerVel.y * playerSpeed * timeToHit,
      };
      const dir = vec2Sub(predictedPos, this.position);
      aimAngle = Math.atan2(dir.y, dir.x);
    } else {
      const dir = vec2Sub(this.targetPlayer.position, this.position);
      aimAngle = Math.atan2(dir.y, dir.x);
    }

    // Calculate damage
    const damage = attack.damage[0] + Math.random() * (attack.damage[1] - attack.damage[0]);

    // Spawn projectiles
    const arcGapRad = (attack.arcGap * Math.PI) / 180;
    const startAngle = aimAngle - (arcGapRad * (attack.numProjectiles - 1)) / 2;

    for (let i = 0; i < attack.numProjectiles; i++) {
      const angle = startAngle + arcGapRad * i;
      this.instance.spawnProjectile(
        this.id,
        'enemy',
        attack.projectileId,
        this.position,
        angle,
        attack.projectileSpeed,
        Math.floor(damage),
        false,
        attack.range / attack.projectileSpeed
      );
    }
  }

  takeDamage(damage: number, attackerId?: string): number {
    const actualDamage = Math.max(1, damage - this.definition.defense);
    this.hp = Math.max(0, this.hp - actualDamage);

    // Track damage for soulbound qualification
    if (attackerId) {
      const current = this.damageByPlayer.get(attackerId) || 0;
      this.damageByPlayer.set(attackerId, current + actualDamage);
    }

    return actualDamage;
  }

  // Get all players who dealt enough damage to qualify for soulbound loot
  // Threshold is 10% of max HP
  getQualifiedPlayers(): string[] {
    const threshold = this.maxHp * 0.10;
    const qualified: string[] = [];
    for (const [playerId, damage] of this.damageByPlayer) {
      if (damage >= threshold) {
        qualified.push(playerId);
      }
    }
    return qualified;
  }

  isDead(): boolean {
    return this.hp <= 0;
  }
}
