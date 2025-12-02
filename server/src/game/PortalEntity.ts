import { Portal, Vec2 } from '@rotmg/shared';
import { Entity } from './Entity.js';

export class PortalEntity extends Entity implements Portal {
  type: 'portal' = 'portal';
  targetInstance: string;
  targetType: 'nexus' | 'realm' | 'dungeon';
  name: string;

  // Expiration support for dungeon portals
  expiresAt: number | null = null;
  visible: boolean = true;

  constructor(
    position: Vec2,
    targetInstance: string,
    targetType: 'nexus' | 'realm' | 'dungeon',
    name: string,
    lifetime?: number // in seconds
  ) {
    super(position, 0.5);
    this.targetInstance = targetInstance;
    this.targetType = targetType;
    this.name = name;

    if (lifetime !== undefined) {
      this.expiresAt = Date.now() + lifetime * 1000;
    }
  }

  update(deltaTime: number): void {
    if (this.expiresAt !== null) {
      const now = Date.now();
      const timeLeft = this.expiresAt - now;

      if (timeLeft <= 0) {
        this.remove();
        return;
      }

      // Blinking effect - blink faster as expiration approaches
      // Last 30 seconds: start blinking
      // Last 10 seconds: fast blinking
      // Last 3 seconds: very fast blinking
      if (timeLeft < 3000) {
        // Very fast blinking (every 100ms)
        this.visible = Math.floor(now / 100) % 2 === 0;
      } else if (timeLeft < 10000) {
        // Fast blinking (every 250ms)
        this.visible = Math.floor(now / 250) % 2 === 0;
      } else if (timeLeft < 30000) {
        // Slow blinking (every 500ms)
        this.visible = Math.floor(now / 500) % 2 === 0;
      } else {
        this.visible = true;
      }
    }
  }
}
