import type {
  WorldSnapshot,
  PlayerSnapshot,
  EnemySnapshot,
  ProjectileSnapshot,
  LootSnapshot,
  PortalSnapshot,
  Vec2,
} from '@rotmg/shared';
import { ENEMIES, PROJECTILES, ITEMS } from '@rotmg/shared';

const TILE_SIZE = 32; // pixels per tile

// Loot bag colors by tier (like RotMG)
const LOOT_BAG_COLORS: Record<number, { fill: string; stroke: string }> = {
  0: { fill: '#8B4513', stroke: '#5D2E0C' },  // Brown - T0 starter
  1: { fill: '#C0C0C0', stroke: '#808080' },  // Silver/Gray - T1-T2
  2: { fill: '#FFD700', stroke: '#B8860B' },  // Gold - T3-T4
  3: { fill: '#00BFFF', stroke: '#0080AA' },  // Cyan - T5-T6
  4: { fill: '#9400D3', stroke: '#6A0DAD' },  // Purple - T7+
  5: { fill: '#FF4500', stroke: '#CC3700' },  // Orange - UT
  6: { fill: '#FFFFFF', stroke: '#CCCCCC' },  // White - ST/Special
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

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;
  private camera: Vec2 = { x: 0, y: 0 };
  private mapData: { width: number; height: number; tiles: number[] } | null = null;

  // Map cache for performance
  private mapCache: HTMLCanvasElement | null = null;
  private mapCacheCtx: CanvasRenderingContext2D | null = null;
  private mapCacheDirty: boolean = true;

  constructor(canvas: HTMLCanvasElement, minimapCanvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // Request hardware acceleration with willReadFrequently: false
    this.ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,  // Allows GPU to render without waiting for CPU
    })!;
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas.getContext('2d')!;

    // Disable image smoothing for crisp pixels
    this.ctx.imageSmoothingEnabled = false;
    this.minimapCtx.imageSmoothingEnabled = false;
  }

  setMapData(width: number, height: number, tiles: number[]): void {
    this.mapData = { width, height, tiles };
    this.mapCacheDirty = true;

    // Create/resize map cache
    if (!this.mapCache || this.mapCache.width !== width * TILE_SIZE) {
      this.mapCache = document.createElement('canvas');
      this.mapCache.width = width * TILE_SIZE;
      this.mapCache.height = height * TILE_SIZE;
      this.mapCacheCtx = this.mapCache.getContext('2d')!;
    }

    // Reset minimap cache
    this.minimapCache = null;
    this.minimapCacheCtx = null;

    this.renderMapToCache();
  }

  private renderMapToCache(): void {
    if (!this.mapData || !this.mapCacheCtx) return;

    const ctx = this.mapCacheCtx;
    const { width, height, tiles } = this.mapData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y * width + x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const isCheckerLight = (x + y) % 2 === 0;

        switch (tile) {
          case 0: // VOID
            ctx.fillStyle = '#0a0a0a';
            break;
          case 1: // FLOOR - checkerboard
            ctx.fillStyle = isCheckerLight ? '#3d3d50' : '#2e2e40';
            break;
          case 2: // WALL
            ctx.fillStyle = '#6b5344';
            break;
          case 3: // WATER
            ctx.fillStyle = isCheckerLight ? '#3355cc' : '#2244aa';
            break;
          case 4: // LAVA
            ctx.fillStyle = isCheckerLight ? '#cc3300' : '#aa2200';
            break;
          case 5: // SPAWN
            ctx.fillStyle = isCheckerLight ? '#3a4a3a' : '#2d3d2d';
            break;
          default:
            ctx.fillStyle = isCheckerLight ? '#3d3d50' : '#2e2e40';
        }

        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        // 3D wall effect
        if (tile === 2) {
          ctx.fillStyle = '#8b7355';
          ctx.fillRect(px, py, TILE_SIZE, 3);
          ctx.fillRect(px, py, 3, TILE_SIZE);
          ctx.fillStyle = '#4a3a2a';
          ctx.fillRect(px, py + TILE_SIZE - 3, TILE_SIZE, 3);
          ctx.fillRect(px + TILE_SIZE - 3, py, 3, TILE_SIZE);
        }
      }
    }

    this.mapCacheDirty = false;
  }

  render(snapshot: WorldSnapshot, playerId: string): void {
    // Find local player for camera
    const localPlayer = snapshot.players.find((p) => p.id === playerId);
    if (localPlayer) {
      this.camera = {
        x: localPlayer.position.x * TILE_SIZE - this.canvas.width / 2,
        y: localPlayer.position.y * TILE_SIZE - this.canvas.height / 2,
      };
    }

    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw cached map
    this.renderMap();

    // Draw portals
    for (const portal of snapshot.portals) {
      this.renderPortal(portal);
    }

    // Draw loot bags
    for (const loot of snapshot.loots) {
      this.renderLootBag(loot);
    }

    // Draw enemies
    for (const enemy of snapshot.enemies) {
      this.renderEnemy(enemy);
    }

    // Draw players
    for (const player of snapshot.players) {
      this.renderPlayer(player, player.id === playerId);
    }

    // Draw projectiles
    for (const projectile of snapshot.projectiles) {
      this.renderProjectile(projectile);
    }

    // Update minimap (less frequently)
    this.renderMinimap(snapshot, playerId);
  }

  private worldToScreen(pos: Vec2): Vec2 {
    return {
      x: pos.x * TILE_SIZE - this.camera.x,
      y: pos.y * TILE_SIZE - this.camera.y,
    };
  }

  private renderMap(): void {
    if (!this.mapCache || !this.mapData) return;

    // Draw only visible portion of cached map
    const sx = Math.max(0, this.camera.x);
    const sy = Math.max(0, this.camera.y);
    const sw = Math.min(this.canvas.width, this.mapCache.width - sx);
    const sh = Math.min(this.canvas.height, this.mapCache.height - sy);

    const dx = Math.max(0, -this.camera.x);
    const dy = Math.max(0, -this.camera.y);

    if (sw > 0 && sh > 0) {
      this.ctx.drawImage(this.mapCache, sx, sy, sw, sh, dx, dy, sw, sh);
    }
  }

  private renderPlayer(player: PlayerSnapshot, isLocal: boolean): void {
    const screenPos = this.worldToScreen(player.position);

    // Skip if off screen
    if (screenPos.x < -50 || screenPos.x > this.canvas.width + 50 ||
        screenPos.y < -50 || screenPos.y > this.canvas.height + 50) return;

    const color = isLocal ? '#44ff44' : '#4488ff';

    // Player body
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, 12, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Class icon
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(player.classId[0].toUpperCase(), screenPos.x, screenPos.y);

    // Name
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '12px Arial';
    this.ctx.fillText(player.name, screenPos.x, screenPos.y - 25);

    // HP bar
    const hpBarWidth = 30;
    const hpBarHeight = 4;
    const hpPercent = player.hp / player.maxHp;

    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(screenPos.x - hpBarWidth / 2, screenPos.y + 18, hpBarWidth, hpBarHeight);
    this.ctx.fillStyle = hpPercent > 0.3 ? '#44ff44' : '#ff4444';
    this.ctx.fillRect(screenPos.x - hpBarWidth / 2, screenPos.y + 18, hpBarWidth * hpPercent, hpBarHeight);
  }

  private renderEnemy(enemy: EnemySnapshot): void {
    const screenPos = this.worldToScreen(enemy.position);

    // Skip if off screen
    if (screenPos.x < -50 || screenPos.x > this.canvas.width + 50 ||
        screenPos.y < -50 || screenPos.y > this.canvas.height + 50) return;

    const def = ENEMIES[enemy.definitionId];
    const radius = (def?.radius || 0.4) * TILE_SIZE;

    // Enemy body
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = def?.color || '#ff0000';
    this.ctx.fill();
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Name
    this.ctx.fillStyle = '#ff8888';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(def?.name || 'Enemy', screenPos.x, screenPos.y - radius - 10);

    // HP bar
    const hpBarWidth = radius * 2;
    const hpPercent = enemy.hp / enemy.maxHp;

    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(screenPos.x - hpBarWidth / 2, screenPos.y + radius + 5, hpBarWidth, 4);
    this.ctx.fillStyle = '#ff4444';
    this.ctx.fillRect(screenPos.x - hpBarWidth / 2, screenPos.y + radius + 5, hpBarWidth * hpPercent, 4);
  }

  private renderProjectile(projectile: ProjectileSnapshot): void {
    const screenPos = this.worldToScreen(projectile.position);

    // Skip if off screen
    if (screenPos.x < -20 || screenPos.x > this.canvas.width + 20 ||
        screenPos.y < -20 || screenPos.y > this.canvas.height + 20) return;

    const def = PROJECTILES[projectile.definitionId];
    const size = def?.size || 6;
    const color = def?.color || (projectile.ownerType === 'player' ? '#44ff44' : '#ff4444');

    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private renderLootBag(loot: LootSnapshot): void {
    const screenPos = this.worldToScreen(loot.position);

    // Skip if off screen
    if (screenPos.x < -20 || screenPos.x > this.canvas.width + 20 ||
        screenPos.y < -20 || screenPos.y > this.canvas.height + 20) return;

    const tier = getBagTier(loot.itemId);
    const colors = LOOT_BAG_COLORS[tier] || LOOT_BAG_COLORS[0];

    // Draw bag shape (like RotMG's iconic bags)
    const size = 10;

    // Bag body - simple pentagon
    this.ctx.beginPath();
    this.ctx.moveTo(screenPos.x, screenPos.y - size);
    this.ctx.lineTo(screenPos.x + size, screenPos.y);
    this.ctx.lineTo(screenPos.x + size * 0.7, screenPos.y + size);
    this.ctx.lineTo(screenPos.x - size * 0.7, screenPos.y + size);
    this.ctx.lineTo(screenPos.x - size, screenPos.y);
    this.ctx.closePath();

    this.ctx.fillStyle = colors.fill;
    this.ctx.fill();
    this.ctx.strokeStyle = colors.stroke;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Bag tie/knot at top - simple circle
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y - size - 3, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  private renderPortal(portal: PortalSnapshot): void {
    const screenPos = this.worldToScreen(portal.position);

    // Skip if off screen
    if (screenPos.x < -30 || screenPos.x > this.canvas.width + 30 ||
        screenPos.y < -30 || screenPos.y > this.canvas.height + 30) return;

    const portalColor = portal.targetType === 'nexus' ? '#4488ff' : '#ff8844';

    // Simple portal circle
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, 18, 0, Math.PI * 2);
    this.ctx.fillStyle = portalColor;
    this.ctx.fill();
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Inner circle
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, 10, 0, Math.PI * 2);
    this.ctx.fillStyle = '#000';
    this.ctx.fill();

    // Name
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(portal.name, screenPos.x, screenPos.y - 28);
    this.ctx.font = '10px Arial';
    this.ctx.fillText('[E] to enter', screenPos.x, screenPos.y + 32);
  }

  // Minimap cache
  private minimapCache: HTMLCanvasElement | null = null;
  private minimapCacheCtx: CanvasRenderingContext2D | null = null;
  private minimapScale: number = 1;
  private lastMinimapUpdate: number = 0;
  private readonly MINIMAP_UPDATE_INTERVAL = 100; // Update minimap every 100ms

  private renderMinimap(snapshot: WorldSnapshot, playerId: string): void {
    const now = Date.now();
    if (now - this.lastMinimapUpdate < this.MINIMAP_UPDATE_INTERVAL) return;
    this.lastMinimapUpdate = now;

    const ctx = this.minimapCtx;
    const width = this.minimapCanvas.width;
    const height = this.minimapCanvas.height;

    if (!this.mapData) return;

    this.minimapScale = Math.min(width / this.mapData.width, height / this.mapData.height);

    // Create minimap cache if needed
    if (!this.minimapCache) {
      this.minimapCache = document.createElement('canvas');
      this.minimapCache.width = width;
      this.minimapCache.height = height;
      this.minimapCacheCtx = this.minimapCache.getContext('2d')!;
      this.renderMinimapBase();
    }

    // Draw cached base
    ctx.drawImage(this.minimapCache, 0, 0);

    const scale = this.minimapScale;

    // Enemies
    ctx.fillStyle = '#ff4444';
    for (const enemy of snapshot.enemies) {
      ctx.fillRect(enemy.position.x * scale - 1, enemy.position.y * scale - 1, 3, 3);
    }

    // Other players
    ctx.fillStyle = '#4488ff';
    for (const player of snapshot.players) {
      if (player.id === playerId) continue;
      ctx.fillRect(player.position.x * scale - 1, player.position.y * scale - 1, 3, 3);
    }

    // Local player
    const localPlayer = snapshot.players.find((p) => p.id === playerId);
    if (localPlayer) {
      ctx.fillStyle = '#44ff44';
      ctx.fillRect(localPlayer.position.x * scale - 2, localPlayer.position.y * scale - 2, 5, 5);
    }

    // Portals
    ctx.fillStyle = '#ffaa00';
    for (const portal of snapshot.portals) {
      ctx.fillRect(portal.position.x * scale - 2, portal.position.y * scale - 2, 4, 4);
    }

    // Loot
    ctx.fillStyle = '#ffff00';
    for (const loot of snapshot.loots) {
      ctx.fillRect(loot.position.x * scale - 1, loot.position.y * scale - 1, 2, 2);
    }
  }

  private renderMinimapBase(): void {
    if (!this.minimapCacheCtx || !this.mapData) return;

    const ctx = this.minimapCacheCtx;
    const width = this.minimapCanvas.width;
    const height = this.minimapCanvas.height;
    const scale = this.minimapScale;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw walls only (simplified)
    ctx.fillStyle = '#444466';
    for (let y = 0; y < this.mapData.height; y++) {
      for (let x = 0; x < this.mapData.width; x++) {
        if (this.mapData.tiles[y * this.mapData.width + x] === 2) {
          ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
        }
      }
    }
  }

  getPlayerScreenPosition(playerWorldPos: Vec2): Vec2 {
    return this.worldToScreen(playerWorldPos);
  }

  // Level up helix particle effect
  private helixParticles: { x: number; y: number; vx: number; vy: number; color: string; life: number; maxLife: number }[] = [];
  private helixAnimationId: number | null = null;

  playHelixParticles(): void {
    // Cancel any existing helix animation
    if (this.helixAnimationId !== null) {
      cancelAnimationFrame(this.helixAnimationId);
    }

    this.helixParticles = [];

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
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

    this.animateHelixParticles();
  }

  private animateHelixParticles(): void {
    if (this.helixParticles.length === 0) {
      this.helixAnimationId = null;
      return;
    }

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

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = alpha;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }

    this.helixAnimationId = requestAnimationFrame(() => this.animateHelixParticles());
  }
}
