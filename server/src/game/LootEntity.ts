import { Loot, Vec2 } from '@rotmg/shared';
import { Entity } from './Entity.js';

export class LootEntity extends Entity implements Loot {
  type: 'loot' = 'loot';
  itemId: string;
  items: string[]; // Support multiple items in a bag
  despawnTime: number;
  ownerId: string | null; // Player who owns soulbound bag (only they can see/pickup)
  soulbound: boolean; // If true, only ownerId can see and pickup this bag

  constructor(itemId: string, position: Vec2, lifetime: number = 60, ownerId: string | null = null, soulbound: boolean = false) {
    super(position, 0.3);
    this.itemId = itemId;
    this.items = [itemId];
    this.despawnTime = Date.now() + lifetime * 1000;
    this.ownerId = ownerId;
    this.soulbound = soulbound;
  }

  addItem(itemId: string): boolean {
    if (this.items.length >= 8) return false; // Max 8 items per bag
    this.items.push(itemId);
    // Reset despawn timer when items are added
    this.despawnTime = Date.now() + 60 * 1000;
    return true;
  }

  removeItem(index: number): string | null {
    if (index < 0 || index >= this.items.length) return null;
    const item = this.items.splice(index, 1)[0];
    // Update itemId to first item or mark for removal if empty
    if (this.items.length === 0) {
      this.remove();
    } else {
      this.itemId = this.items[0];
    }
    return item;
  }

  update(deltaTime: number): void {
    if (Date.now() >= this.despawnTime) {
      this.remove();
    }
  }
}
