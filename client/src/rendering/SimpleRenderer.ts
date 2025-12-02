import type {
  WorldSnapshot,
  Vec2,
  AbilityEffectEvent,
} from '@rotmg/shared';
import { ENEMIES, ITEMS } from '@rotmg/shared';

const TILE_SIZE = 32;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const LOOT_COLORS: Record<number, string> = {
  0: '#8B4513',
  1: '#C0C0C0',
  2: '#FFD700',
  3: '#00BFFF',
  4: '#9400D3',
};

function getBagTier(itemId: string): number {
  const item = ITEMS[itemId];
  if (!item) return 0;
  if (item.tier >= 7) return 4;
  if (item.tier >= 5) return 3;
  if (item.tier >= 3) return 2;
  if (item.tier >= 1) return 1;
  return 0;
}

const TILE_COLORS: Record<number, { light: string; dark: string }> = {
  0: { light: '#0a0a0a', dark: '#0a0a0a' },
  1: { light: '#3d3d50', dark: '#2e2e40' },
  2: { light: '#6b5344', dark: '#6b5344' },
  3: { light: '#3355cc', dark: '#2244aa' },
  5: { light: '#3a4a3a', dark: '#2d3d2d' },
  6: { light: '#5a2a3a', dark: '#4a1a2a' }, // Boss floor - dark crimson
};

// Interpolated position tracking
interface InterpolatedEntity {
  currentPos: Vec2;
  targetPos: Vec2;
  lastUpdate: number;
}

export class SimpleRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Minimap
  private minimapCanvas: HTMLCanvasElement | null = null;
  private minimapCtx: CanvasRenderingContext2D | null = null;
  private minimapCache: HTMLCanvasElement | null = null;
  private minimapScale: number = 1;

  // Offscreen canvas for the map (rendered once)
  private mapCanvas: HTMLCanvasElement | null = null;
  private mapTiles: number[] = [];
  private mapWidth = 0;
  private mapHeight = 0;

  private cameraX = 0;
  private cameraY = 0;
  private cameraRotation = 0;

  // Interpolation state
  private entityPositions: Map<string, InterpolatedEntity> = new Map();
  private lastSnapshot: WorldSnapshot | null = null;
  private lastPlayerId: string | null = null;

  // Client-side prediction for local player
  private predictedPos: Vec2 | null = null;
  private lastMoveDir: Vec2 = { x: 0, y: 0 };
  private playerSpeed: number = 5; // Base speed, updated from snapshot

  // Interpolation settings
  private readonly LERP_SPEED = 15; // How fast to interpolate (higher = snappier)
  private readonly RECONCILE_SPEED = 10; // How fast to reconcile prediction with server

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.canvas.style.cursor = 'crosshair';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;

    // Get minimap canvas
    this.minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement;
    if (this.minimapCanvas) {
      this.minimapCtx = this.minimapCanvas.getContext('2d');
    }
  }

  async waitForReady(): Promise<void> {
    // No async setup needed
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  setCameraRotation(rotation: number): void {
    this.cameraRotation = rotation;
  }

  setMapData(width: number, height: number, tiles: number[]): void {
    this.mapWidth = width;
    this.mapHeight = height;
    this.mapTiles = tiles;

    // Clear interpolation state on map change
    this.entityPositions.clear();
    this.predictedPos = null;

    // Reset minimap cache
    this.minimapCache = null;

    // Create offscreen canvas for the map
    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = width * TILE_SIZE;
    this.mapCanvas.height = height * TILE_SIZE;

    const ctx = this.mapCanvas.getContext('2d');
    if (!ctx) return;

    // Render entire map to offscreen canvas once
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y * width + x];
        const isLight = (x + y) % 2 === 0;
        const colors = TILE_COLORS[tile] || TILE_COLORS[1];
        ctx.fillStyle = isLight ? colors.light : colors.dark;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // Render minimap base
    this.renderMinimapBase(tiles);
  }

  private renderMinimapBase(tiles: number[]): void {
    if (!this.minimapCanvas) return;

    const width = this.minimapCanvas.width;
    const height = this.minimapCanvas.height;
    this.minimapScale = Math.min(width / this.mapWidth, height / this.mapHeight);

    // Create minimap cache
    this.minimapCache = document.createElement('canvas');
    this.minimapCache.width = width;
    this.minimapCache.height = height;
    const ctx = this.minimapCache.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw walkable areas and walls
    const scale = this.minimapScale;
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tile = tiles[y * this.mapWidth + x];
        if (tile === 2) {
          // Wall
          ctx.fillStyle = '#444466';
          ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
        } else if (tile === 6) {
          // Boss floor - crimson tint on minimap
          ctx.fillStyle = '#4a2a3a';
          ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
        } else if (tile === 1 || tile === 5) {
          // Floor or spawn
          ctx.fillStyle = '#2a2a3e';
          ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
        }
      }
    }
  }

  // Called when we receive a new snapshot from the server
  updateSnapshot(snapshot: WorldSnapshot, playerId: string): void {
    this.lastSnapshot = snapshot;
    this.lastPlayerId = playerId;
    const now = performance.now();

    // Update target positions for all entities
    const seenIds = new Set<string>();

    for (const player of snapshot.players) {
      seenIds.add(player.id);

      // For local player, update speed and reconcile prediction
      if (player.id === playerId) {
        // Calculate speed from player stats (same formula as server)
        this.playerSpeed = 4 + player.speed * 0.1;

        // Initialize prediction if needed
        if (!this.predictedPos) {
          this.predictedPos = { ...player.position };
        }
        // Server position is stored in entity target for reconciliation
      }

      this.updateEntityTarget(player.id, player.position, now);
    }

    for (const enemy of snapshot.enemies) {
      seenIds.add(enemy.id);
      this.updateEntityTarget(enemy.id, enemy.position, now);
    }

    for (const proj of snapshot.projectiles) {
      seenIds.add(proj.id);
      // Projectiles move predictably - set current to target immediately
      // and we'll extrapolate based on velocity
      const entity = this.entityPositions.get(proj.id);
      if (!entity) {
        this.entityPositions.set(proj.id, {
          currentPos: { ...proj.position },
          targetPos: { ...proj.position },
          lastUpdate: now,
        });
      } else {
        entity.currentPos = { ...proj.position };
        entity.targetPos = { ...proj.position };
        entity.lastUpdate = now;
      }
    }

    for (const portal of snapshot.portals) {
      seenIds.add(portal.id);
      // Portals don't move
      if (!this.entityPositions.has(portal.id)) {
        this.entityPositions.set(portal.id, {
          currentPos: { ...portal.position },
          targetPos: { ...portal.position },
          lastUpdate: now,
        });
      }
    }

    for (const loot of snapshot.loots) {
      seenIds.add(loot.id);
      // Loot doesn't move
      if (!this.entityPositions.has(loot.id)) {
        this.entityPositions.set(loot.id, {
          currentPos: { ...loot.position },
          targetPos: { ...loot.position },
          lastUpdate: now,
        });
      }
    }

    // Remove entities that no longer exist
    for (const id of this.entityPositions.keys()) {
      if (!seenIds.has(id)) {
        this.entityPositions.delete(id);
      }
    }
  }

  private updateEntityTarget(id: string, newPos: Vec2, now: number): void {
    const entity = this.entityPositions.get(id);
    if (!entity) {
      // New entity - start at target position
      this.entityPositions.set(id, {
        currentPos: { ...newPos },
        targetPos: { ...newPos },
        lastUpdate: now,
      });
    } else {
      // Existing entity - update target
      entity.targetPos = { ...newPos };
      entity.lastUpdate = now;
    }
  }

  private getInterpolatedPos(id: string, deltaTime: number): Vec2 | null {
    const entity = this.entityPositions.get(id);
    if (!entity) return null;

    // Lerp current position toward target
    const t = Math.min(1, deltaTime * this.LERP_SPEED);
    entity.currentPos.x += (entity.targetPos.x - entity.currentPos.x) * t;
    entity.currentPos.y += (entity.targetPos.y - entity.currentPos.y) * t;

    return entity.currentPos;
  }

  // Check if a tile is walkable (for client-side prediction)
  private isWalkable(x: number, y: number): boolean {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) {
      return false;
    }
    const tile = this.mapTiles[tileY * this.mapWidth + tileX];
    return tile !== 0 && tile !== 2; // 0 = void, 2 = wall
  }

  // Apply local movement to predicted position
  applyLocalMovement(moveDir: Vec2, deltaTime: number): void {
    if (!this.predictedPos) return;

    this.lastMoveDir = moveDir;

    // Normalize direction
    const len = Math.sqrt(moveDir.x * moveDir.x + moveDir.y * moveDir.y);
    if (len < 0.01) return;

    const nx = moveDir.x / len;
    const ny = moveDir.y / len;

    // Calculate new position
    const newX = this.predictedPos.x + nx * this.playerSpeed * deltaTime;
    const newY = this.predictedPos.y + ny * this.playerSpeed * deltaTime;

    // Simple collision checking (same as server)
    const radius = 0.4; // Player radius
    if (this.isWalkable(newX - radius, newY - radius) &&
        this.isWalkable(newX + radius, newY - radius) &&
        this.isWalkable(newX - radius, newY + radius) &&
        this.isWalkable(newX + radius, newY + radius)) {
      this.predictedPos.x = newX;
      this.predictedPos.y = newY;
    } else {
      // Try sliding along walls
      if (this.isWalkable(newX - radius, this.predictedPos.y - radius) &&
          this.isWalkable(newX + radius, this.predictedPos.y - radius) &&
          this.isWalkable(newX - radius, this.predictedPos.y + radius) &&
          this.isWalkable(newX + radius, this.predictedPos.y + radius)) {
        this.predictedPos.x = newX;
      } else if (this.isWalkable(this.predictedPos.x - radius, newY - radius) &&
                 this.isWalkable(this.predictedPos.x + radius, newY - radius) &&
                 this.isWalkable(this.predictedPos.x - radius, newY + radius) &&
                 this.isWalkable(this.predictedPos.x + radius, newY + radius)) {
        this.predictedPos.y = newY;
      }
    }
  }

  // Called every frame to render with interpolation
  render(deltaTime: number): void {
    if (!this.lastSnapshot || !this.lastPlayerId) return;

    const ctx = this.ctx;
    const snapshot = this.lastSnapshot;
    const playerId = this.lastPlayerId;

    // Reconcile prediction with server position
    const serverEntity = this.entityPositions.get(playerId);
    if (this.predictedPos && serverEntity) {
      // Smoothly pull predicted position toward server position
      const t = Math.min(1, deltaTime * this.RECONCILE_SPEED);
      this.predictedPos.x += (serverEntity.targetPos.x - this.predictedPos.x) * t;
      this.predictedPos.y += (serverEntity.targetPos.y - this.predictedPos.y) * t;
    }

    // Update other entities interpolation
    for (const [id, entity] of this.entityPositions) {
      if (id !== playerId) {
        this.getInterpolatedPos(id, deltaTime);
      }
    }

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Find local player for camera - use predicted position for instant response
    let playerWorldX = 0;
    let playerWorldY = 0;
    if (this.predictedPos) {
      playerWorldX = this.predictedPos.x * TILE_SIZE;
      playerWorldY = this.predictedPos.y * TILE_SIZE;
    }

    // Save context state before rotation
    ctx.save();

    // Apply rotation around canvas center (player position)
    ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.rotate(-this.cameraRotation);
    ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);

    // Now set camera offset based on player world position
    this.cameraX = playerWorldX - CANVAS_WIDTH / 2;
    this.cameraY = playerWorldY - CANVAS_HEIGHT / 2;

    // Draw map from offscreen canvas (need to draw larger area when rotated)
    if (this.mapCanvas) {
      // When rotated, we need to draw a larger area to cover corners
      const diagonal = Math.sqrt(CANVAS_WIDTH * CANVAS_WIDTH + CANVAS_HEIGHT * CANVAS_HEIGHT);
      const extraPadding = (diagonal - Math.min(CANVAS_WIDTH, CANVAS_HEIGHT)) / 2;

      const srcX = Math.max(0, this.cameraX - extraPadding);
      const srcY = Math.max(0, this.cameraY - extraPadding);
      const destX = -this.cameraX + srcX;
      const destY = -this.cameraY + srcY;

      const maxSrcX = this.mapWidth * TILE_SIZE;
      const maxSrcY = this.mapHeight * TILE_SIZE;

      const drawWidth = Math.min(CANVAS_WIDTH + extraPadding * 2, maxSrcX - srcX);
      const drawHeight = Math.min(CANVAS_HEIGHT + extraPadding * 2, maxSrcY - srcY);

      if (drawWidth > 0 && drawHeight > 0) {
        ctx.drawImage(
          this.mapCanvas,
          srcX, srcY, drawWidth, drawHeight,
          destX, destY, drawWidth, drawHeight
        );
      }
    }

    // Draw portals (static, with blinking support)
    for (const portal of snapshot.portals) {
      // Skip invisible portals (blinking effect)
      if (!portal.visible) continue;

      const pos = this.getInterpolatedPos(portal.id, deltaTime) || portal.position;
      const screenX = pos.x * TILE_SIZE - this.cameraX;
      const screenY = pos.y * TILE_SIZE - this.cameraY;

      ctx.beginPath();
      ctx.arc(screenX, screenY, 18, 0, Math.PI * 2);
      ctx.fillStyle = portal.targetType === 'nexus' ? '#4488ff' :
                     portal.targetType === 'dungeon' ? '#ff4444' : '#ff8844';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Draw loots (static)
    for (const loot of snapshot.loots) {
      const pos = this.getInterpolatedPos(loot.id, deltaTime) || loot.position;
      const screenX = pos.x * TILE_SIZE - this.cameraX;
      const screenY = pos.y * TILE_SIZE - this.cameraY;

      const tier = getBagTier(loot.itemId);
      ctx.beginPath();
      ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
      ctx.fillStyle = LOOT_COLORS[tier] || LOOT_COLORS[0];
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw enemies (interpolated)
    for (const enemy of snapshot.enemies) {
      const pos = this.getInterpolatedPos(enemy.id, deltaTime) || enemy.position;
      const screenX = pos.x * TILE_SIZE - this.cameraX;
      const screenY = pos.y * TILE_SIZE - this.cameraY;

      const def = ENEMIES[enemy.definitionId];
      const radius = (def?.radius || 0.4) * TILE_SIZE;
      const color = def?.color || '#ff0000';

      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Health bar for enemies (counter-rotate to stay upright)
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(this.cameraRotation);
      this.drawHealthBar(ctx, 0, -radius - 8, enemy.hp, enemy.maxHp, 30);
      ctx.restore();
    }

    // Draw players (local player uses predicted position, others interpolated)
    for (const player of snapshot.players) {
      const isLocal = player.id === playerId;
      // Use predicted position for local player for instant response
      const pos = isLocal && this.predictedPos
        ? this.predictedPos
        : (this.getInterpolatedPos(player.id, deltaTime) || player.position);
      const screenX = pos.x * TILE_SIZE - this.cameraX;
      const screenY = pos.y * TILE_SIZE - this.cameraY;

      ctx.beginPath();
      ctx.arc(screenX, screenY, 12, 0, Math.PI * 2);
      ctx.fillStyle = isLocal ? '#44ff44' : '#4488ff';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Health bar and name (counter-rotate to stay upright)
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(this.cameraRotation);
      this.drawHealthBar(ctx, 0, -20, player.hp, player.maxHp, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, 0, -28);
      ctx.restore();
    }

    // Draw projectiles (extrapolated based on velocity)
    for (const proj of snapshot.projectiles) {
      const entity = this.entityPositions.get(proj.id);
      let screenX: number, screenY: number;

      if (entity) {
        // Extrapolate position based on velocity
        const timeSinceUpdate = (performance.now() - entity.lastUpdate) / 1000;
        const extrapolatedX = entity.currentPos.x + proj.velocity.x * timeSinceUpdate;
        const extrapolatedY = entity.currentPos.y + proj.velocity.y * timeSinceUpdate;
        screenX = extrapolatedX * TILE_SIZE - this.cameraX;
        screenY = extrapolatedY * TILE_SIZE - this.cameraY;
      } else {
        screenX = proj.position.x * TILE_SIZE - this.cameraX;
        screenY = proj.position.y * TILE_SIZE - this.cameraY;
      }

      ctx.beginPath();
      ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
      ctx.fillStyle = proj.ownerType === 'player' ? '#44ff44' : '#ff4444';
      ctx.fill();
    }

    // Restore context state (un-rotate)
    ctx.restore();

    // Draw helix particles (screen-space, after un-rotating)
    this.updateHelixParticles();

    // Draw ability effect particles (screen-space)
    this.updateAbilityParticles();

    // Draw buff indicator glow around local player if buffed
    if (this.hasActiveBuff(playerId)) {
      this.drawBuffGlow();
    }

    // Render minimap (not rotated)
    this.renderMinimap(snapshot, playerId);
  }

  private renderMinimap(snapshot: WorldSnapshot, playerId: string): void {
    if (!this.minimapCtx || !this.minimapCanvas || !this.minimapCache) return;

    const ctx = this.minimapCtx;
    const width = this.minimapCanvas.width;
    const height = this.minimapCanvas.height;
    const scale = this.minimapScale;

    // Draw cached base
    ctx.drawImage(this.minimapCache, 0, 0);

    // Draw enemies
    ctx.fillStyle = '#ff4444';
    for (const enemy of snapshot.enemies) {
      ctx.fillRect(enemy.position.x * scale - 1, enemy.position.y * scale - 1, 3, 3);
    }

    // Draw other players
    ctx.fillStyle = '#4488ff';
    for (const player of snapshot.players) {
      if (player.id === playerId) continue;
      ctx.fillRect(player.position.x * scale - 1, player.position.y * scale - 1, 3, 3);
    }

    // Draw local player (larger)
    const localPlayer = snapshot.players.find(p => p.id === playerId);
    if (localPlayer) {
      ctx.fillStyle = '#44ff44';
      ctx.fillRect(localPlayer.position.x * scale - 2, localPlayer.position.y * scale - 2, 5, 5);
    }

    // Draw portals
    ctx.fillStyle = '#ffaa00';
    for (const portal of snapshot.portals) {
      if (portal.visible) {
        ctx.fillRect(portal.position.x * scale - 2, portal.position.y * scale - 2, 4, 4);
      }
    }

    // Draw loot
    ctx.fillStyle = '#ffff00';
    for (const loot of snapshot.loots) {
      ctx.fillRect(loot.position.x * scale - 1, loot.position.y * scale - 1, 2, 2);
    }
  }

  private drawHealthBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    hp: number,
    maxHp: number,
    width: number
  ): void {
    const height = 4;
    const hpRatio = Math.max(0, Math.min(1, hp / maxHp));

    // Background (dark)
    ctx.fillStyle = '#333';
    ctx.fillRect(x - width / 2, y, width, height);

    // Health (green to red based on health)
    const r = Math.floor(255 * (1 - hpRatio));
    const g = Math.floor(255 * hpRatio);
    ctx.fillStyle = `rgb(${r}, ${g}, 0)`;
    ctx.fillRect(x - width / 2, y, width * hpRatio, height);

    // Border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - width / 2, y, width, height);
  }

  getPlayerScreenPosition(playerWorldPos: Vec2): Vec2 {
    // With client-side prediction, camera follows predicted position
    // Player is always at center of screen (before rotation)
    // Return canvas center since that's where the local player is rendered
    return {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
    };
  }

  // Get the predicted world position for the local player
  getPredictedPosition(): Vec2 | null {
    return this.predictedPos;
  }

  // Level up helix particle effect
  private helixParticles: { x: number; y: number; vx: number; vy: number; color: string; life: number; maxLife: number }[] = [];

  // Ability effect particles (spell explosions, etc)
  private abilityParticles: { x: number; y: number; vx: number; vy: number; color: string; life: number; maxLife: number; size: number }[] = [];

  // Active buff indicator (shows glow around player when buffed)
  private activeBuffs: Map<string, { stat: string; endTime: number }> = new Map();

  playHelixParticles(): void {
    this.helixParticles = [];

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const numParticles = 60;
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#FF85A2', '#A29BFE'];

    // Create two intertwined helixes
    for (let i = 0; i < numParticles; i++) {
      const t = i / numParticles * Math.PI * 4; // 2 full rotations
      const delay = i * 30; // Staggered spawn

      // First helix strand
      setTimeout(() => {
        this.helixParticles.push({
          x: centerX + Math.cos(t) * 40,
          y: centerY + 80 - i * 3,
          vx: Math.cos(t) * 2,
          vy: -3 - Math.random() * 2,
          color: colors[i % colors.length],
          life: 60,
          maxLife: 60,
        });
      }, delay);

      // Second helix strand (offset by PI)
      setTimeout(() => {
        this.helixParticles.push({
          x: centerX + Math.cos(t + Math.PI) * 40,
          y: centerY + 80 - i * 3,
          vx: Math.cos(t + Math.PI) * 2,
          vy: -3 - Math.random() * 2,
          color: colors[(i + 4) % colors.length],
          life: 60,
          maxLife: 60,
        });
      }, delay);
    }
  }

  // Called from main render loop to update and draw helix particles
  private updateHelixParticles(): void {
    if (this.helixParticles.length === 0) return;

    const ctx = this.ctx;

    // Update and draw particles
    for (let i = this.helixParticles.length - 1; i >= 0; i--) {
      const p = this.helixParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy += 0.05; // gravity
      p.life--;

      if (p.life <= 0) {
        this.helixParticles.splice(i, 1);
        continue;
      }

      const alpha = p.life / p.maxLife;
      const size = 4 + (1 - alpha) * 6;

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Play ability effect based on event
  playAbilityEffect(event: AbilityEffectEvent): void {
    switch (event.effectType) {
      case 'damage':
        this.playSpellExplosion(event.position, event.radius || 3);
        break;
      case 'buff':
        this.playBuffEffect(event.playerId, event.stat || '', event.duration || 5);
        break;
      case 'heal':
        this.playHealEffect(event.position);
        break;
      case 'teleport':
        this.playTeleportEffect(event.position);
        break;
    }
  }

  // Wizard spell bomb explosion
  private playSpellExplosion(position: Vec2, radius: number): void {
    const screenX = position.x * TILE_SIZE - this.cameraX;
    const screenY = position.y * TILE_SIZE - this.cameraY;
    const screenRadius = radius * TILE_SIZE;

    const numParticles = 40;
    const colors = ['#FF6B6B', '#FF8E53', '#FFCD56', '#FF4757', '#FFA502'];

    for (let i = 0; i < numParticles; i++) {
      const angle = (Math.PI * 2 * i) / numParticles + Math.random() * 0.3;
      const speed = 2 + Math.random() * 4;
      const dist = Math.random() * screenRadius * 0.5;

      this.abilityParticles.push({
        x: screenX + Math.cos(angle) * dist,
        y: screenY + Math.sin(angle) * dist,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 30 + Math.random() * 20,
        maxLife: 50,
        size: 3 + Math.random() * 4,
      });
    }

    // Add expanding ring effect
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      this.abilityParticles.push({
        x: screenX,
        y: screenY,
        vx: Math.cos(angle) * 6,
        vy: Math.sin(angle) * 6,
        color: '#FFFFFF',
        life: 15,
        maxLife: 15,
        size: 4,
      });
    }
  }

  // Warrior buff effect (glow indicator)
  private playBuffEffect(playerId: string, stat: string, duration: number): void {
    // Store buff info to render indicator
    this.activeBuffs.set(playerId, {
      stat,
      endTime: Date.now() + duration * 1000,
    });

    // Create buff activation particles at player position (center of screen for local player)
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    // Upward spiraling particles
    const colors = stat === 'speed' ? ['#4ECDC4', '#45B7D1', '#96CEB4'] : ['#FFD700', '#FFA500', '#FF6B6B'];

    for (let i = 0; i < 25; i++) {
      const angle = (Math.PI * 2 * i) / 25;
      setTimeout(() => {
        this.abilityParticles.push({
          x: centerX + Math.cos(angle) * 20,
          y: centerY + 10,
          vx: Math.cos(angle) * 1.5,
          vy: -4 - Math.random() * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 40,
          maxLife: 40,
          size: 3 + Math.random() * 2,
        });
      }, i * 20);
    }
  }

  // Heal effect
  private playHealEffect(position: Vec2): void {
    const screenX = position.x * TILE_SIZE - this.cameraX;
    const screenY = position.y * TILE_SIZE - this.cameraY;

    const colors = ['#44FF44', '#88FF88', '#AAFFAA', '#FFFFFF'];

    for (let i = 0; i < 20; i++) {
      this.abilityParticles.push({
        x: screenX + (Math.random() - 0.5) * 30,
        y: screenY + 10,
        vx: (Math.random() - 0.5) * 2,
        vy: -3 - Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 30 + Math.random() * 20,
        maxLife: 50,
        size: 2 + Math.random() * 3,
      });
    }
  }

  // Teleport effect (blink)
  private playTeleportEffect(position: Vec2): void {
    const screenX = position.x * TILE_SIZE - this.cameraX;
    const screenY = position.y * TILE_SIZE - this.cameraY;

    const colors = ['#9400D3', '#8A2BE2', '#7B68EE', '#FFFFFF'];

    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;

      this.abilityParticles.push({
        x: screenX,
        y: screenY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 20 + Math.random() * 15,
        maxLife: 35,
        size: 2 + Math.random() * 4,
      });
    }
  }

  // Update and draw ability particles - called from render loop
  private updateAbilityParticles(): void {
    if (this.abilityParticles.length === 0) return;

    const ctx = this.ctx;

    for (let i = this.abilityParticles.length - 1; i >= 0; i--) {
      const p = this.abilityParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life--;

      if (p.life <= 0) {
        this.abilityParticles.splice(i, 1);
        continue;
      }

      const alpha = p.life / p.maxLife;
      const size = p.size * (0.5 + alpha * 0.5);

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Check if player has active buff (for rendering glow)
  hasActiveBuff(playerId: string): boolean {
    const buff = this.activeBuffs.get(playerId);
    if (!buff) return false;

    if (Date.now() > buff.endTime) {
      this.activeBuffs.delete(playerId);
      return false;
    }
    return true;
  }

  // Draw pulsing glow around player center when buff is active
  private drawBuffGlow(): void {
    const ctx = this.ctx;
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    // Pulsing effect based on time
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
    const radius = 20 + pulse * 10;

    // Create radial gradient for glow
    const gradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, radius);
    gradient.addColorStop(0, `rgba(255, 215, 0, ${0.4 * pulse})`);
    gradient.addColorStop(0.5, `rgba(255, 165, 0, ${0.2 * pulse})`);
    gradient.addColorStop(1, 'rgba(255, 165, 0, 0)');

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Add golden ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, 16 + pulse * 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 215, 0, ${0.6 + 0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
