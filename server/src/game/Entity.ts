import { Vec2, Entity as EntityData, EntityType } from '@rotmg/shared';
import { v4 as uuid } from 'uuid';

export abstract class Entity implements EntityData {
  id: string;
  abstract type: EntityType;
  position: Vec2;
  radius: number;
  markedForRemoval: boolean = false;

  constructor(position: Vec2, radius: number, id?: string) {
    this.id = id || uuid();
    this.position = { ...position };
    this.radius = radius;
  }

  abstract update(deltaTime: number): void;

  distanceTo(other: Entity | Vec2): number {
    const pos = 'position' in other ? other.position : other;
    const dx = this.position.x - pos.x;
    const dy = this.position.y - pos.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  collidesWith(other: Entity): boolean {
    return this.distanceTo(other) < this.radius + other.radius;
  }

  moveToward(target: Vec2, speed: number, deltaTime: number): void {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      const moveX = (dx / dist) * speed * deltaTime;
      const moveY = (dy / dist) * speed * deltaTime;

      if (Math.abs(moveX) < dist) {
        this.position.x += moveX;
        this.position.y += moveY;
      } else {
        this.position.x = target.x;
        this.position.y = target.y;
      }
    }
  }

  remove(): void {
    this.markedForRemoval = true;
  }
}

export function normalizeVec2(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function vec2Length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vec2FromAngle(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
