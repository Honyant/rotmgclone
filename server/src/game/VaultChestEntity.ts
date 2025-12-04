import { Vec2, VaultChest } from '@rotmg/shared';
import { Entity } from './Entity.js';

export class VaultChestEntity extends Entity implements VaultChest {
  readonly type = 'vault_chest' as const;

  constructor(position: Vec2, id?: string) {
    super(position, 0.5, id);
  }

  update(_deltaTime: number): void {
    // Vault chests are static - no update needed
  }
}
