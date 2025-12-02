import { Vec2 } from '@rotmg/shared';
import { Entity } from './Entity.js';

/**
 * Spatial hash grid for efficient collision detection.
 * Divides the world into cells and only checks entities in same/adjacent cells.
 */
export class SpatialHash<T extends Entity> {
  private cellSize: number;
  private cells: Map<string, Set<T>> = new Map();
  private entityCells: Map<string, string> = new Map(); // entity id -> cell key

  constructor(cellSize: number = 4) {
    this.cellSize = cellSize;
  }

  private getKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  insert(entity: T): void {
    const key = this.getKey(entity.position.x, entity.position.y);

    // Get or create cell
    let cell = this.cells.get(key);
    if (!cell) {
      cell = new Set();
      this.cells.set(key, cell);
    }

    cell.add(entity);
    this.entityCells.set(entity.id, key);
  }

  remove(entity: T): void {
    const key = this.entityCells.get(entity.id);
    if (key) {
      const cell = this.cells.get(key);
      if (cell) {
        cell.delete(entity);
        if (cell.size === 0) {
          this.cells.delete(key);
        }
      }
      this.entityCells.delete(entity.id);
    }
  }

  update(entity: T): void {
    const oldKey = this.entityCells.get(entity.id);
    const newKey = this.getKey(entity.position.x, entity.position.y);

    if (oldKey !== newKey) {
      // Remove from old cell
      if (oldKey) {
        const oldCell = this.cells.get(oldKey);
        if (oldCell) {
          oldCell.delete(entity);
          if (oldCell.size === 0) {
            this.cells.delete(oldKey);
          }
        }
      }

      // Add to new cell
      let newCell = this.cells.get(newKey);
      if (!newCell) {
        newCell = new Set();
        this.cells.set(newKey, newCell);
      }
      newCell.add(entity);
      this.entityCells.set(entity.id, newKey);
    }
  }

  /**
   * Get all entities in the same cell and adjacent cells
   */
  getNearby(pos: Vec2): T[] {
    const cx = Math.floor(pos.x / this.cellSize);
    const cy = Math.floor(pos.y / this.cellSize);
    const result: T[] = [];

    // Check 3x3 grid of cells around position
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (const entity of cell) {
            result.push(entity);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get all entities within a radius (uses spatial hash for broad phase)
   */
  getInRadius(pos: Vec2, radius: number): T[] {
    const result: T[] = [];
    const radiusSq = radius * radius;

    // Calculate which cells to check based on radius
    const minCx = Math.floor((pos.x - radius) / this.cellSize);
    const maxCx = Math.floor((pos.x + radius) / this.cellSize);
    const minCy = Math.floor((pos.y - radius) / this.cellSize);
    const maxCy = Math.floor((pos.y + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = `${cx},${cy}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (const entity of cell) {
            const dx = entity.position.x - pos.x;
            const dy = entity.position.y - pos.y;
            if (dx * dx + dy * dy <= radiusSq) {
              result.push(entity);
            }
          }
        }
      }
    }

    return result;
  }

  clear(): void {
    this.cells.clear();
    this.entityCells.clear();
  }
}
