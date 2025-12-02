import { Projectile, Vec2 } from '@rotmg/shared';
import { Entity, vec2FromAngle } from './Entity.js';

export class ProjectileEntity extends Entity implements Projectile {
  type: 'projectile' = 'projectile';
  ownerId: string;
  ownerType: 'player' | 'enemy';
  definitionId: string;
  velocity: Vec2;
  damage: number;
  piercing: boolean;
  lifetime: number;
  spawnTime: number;
  hitEntities: Set<string> = new Set();

  constructor(
    ownerId: string,
    ownerType: 'player' | 'enemy',
    definitionId: string,
    position: Vec2,
    angle: number,
    speed: number,
    damage: number,
    piercing: boolean,
    lifetime: number
  ) {
    super(position, 0.15); // Small hitbox for projectiles
    this.ownerId = ownerId;
    this.ownerType = ownerType;
    this.definitionId = definitionId;
    this.velocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    };
    this.damage = damage;
    this.piercing = piercing;
    this.lifetime = lifetime;
    this.spawnTime = Date.now();
  }

  update(deltaTime: number): void {
    // Move projectile
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;

    // Check lifetime
    const age = (Date.now() - this.spawnTime) / 1000;
    if (age >= this.lifetime) {
      this.remove();
    }
  }

  hasHit(entityId: string): boolean {
    return this.hitEntities.has(entityId);
  }

  recordHit(entityId: string): void {
    this.hitEntities.add(entityId);
    if (!this.piercing) {
      this.remove();
    }
  }
}
