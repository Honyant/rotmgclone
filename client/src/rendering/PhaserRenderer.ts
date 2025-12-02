import Phaser from 'phaser';
import type {
  WorldSnapshot,
  PlayerSnapshot,
  EnemySnapshot,
  ProjectileSnapshot,
  LootSnapshot,
  PortalSnapshot,
  Vec2,
} from '@rotmg/shared';
import { ENEMIES, ITEMS } from '@rotmg/shared';

const TILE_SIZE = 32;

const LOOT_COLORS: Record<number, number> = {
  0: 0x8b4513,
  1: 0xc0c0c0,
  2: 0xffd700,
  3: 0x00bfff,
  4: 0x9400d3,
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

// Tile colors
const TILE_COLORS: Record<number, { light: number; dark: number }> = {
  0: { light: 0x0a0a0a, dark: 0x0a0a0a },
  1: { light: 0x3d3d50, dark: 0x2e2e40 },
  2: { light: 0x6b5344, dark: 0x6b5344 },
  3: { light: 0x3355cc, dark: 0x2244aa },
  5: { light: 0x3a4a3a, dark: 0x2d3d2d },
};

class GameScene extends Phaser.Scene {
  private playerSprites: Map<string, Phaser.GameObjects.Arc> = new Map();
  private enemySprites: Map<string, Phaser.GameObjects.Arc> = new Map();
  private projectileSprites: Map<string, Phaser.GameObjects.Arc> = new Map();
  private lootSprites: Map<string, Phaser.GameObjects.Arc> = new Map();
  private portalSprites: Map<string, Phaser.GameObjects.Arc> = new Map();

  private mapTexture: Phaser.GameObjects.RenderTexture | null = null;
  private mapRendered = false;
  private mapData: { width: number; height: number; tiles: number[] } | null = null;

  private pendingSnapshot: WorldSnapshot | null = null;
  private pendingPlayerId: string | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x000000);
  }

  setMapData(width: number, height: number, tiles: number[]): void {
    this.mapData = { width, height, tiles };
    this.mapRendered = false;

    // Clear all sprites when changing maps
    this.clearAllSprites();
  }

  private clearAllSprites(): void {
    for (const sprite of this.playerSprites.values()) sprite.destroy();
    for (const sprite of this.enemySprites.values()) sprite.destroy();
    for (const sprite of this.projectileSprites.values()) sprite.destroy();
    for (const sprite of this.lootSprites.values()) sprite.destroy();
    for (const sprite of this.portalSprites.values()) sprite.destroy();

    this.playerSprites.clear();
    this.enemySprites.clear();
    this.projectileSprites.clear();
    this.lootSprites.clear();
    this.portalSprites.clear();

    if (this.mapTexture) {
      this.mapTexture.destroy();
      this.mapTexture = null;
    }
  }

  private renderMap(): void {
    if (!this.mapData || this.mapRendered) return;

    const { width, height, tiles } = this.mapData;

    // Create a RenderTexture to draw the map once
    if (this.mapTexture) {
      this.mapTexture.destroy();
    }

    this.mapTexture = this.add.renderTexture(0, 0, width * TILE_SIZE, height * TILE_SIZE);
    const graphics = this.add.graphics();

    // Draw all tiles to graphics
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y * width + x];
        const isLight = (x + y) % 2 === 0;
        const colors = TILE_COLORS[tile] || TILE_COLORS[1];
        const color = isLight ? colors.light : colors.dark;

        graphics.fillStyle(color);
        graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // Bake graphics into render texture
    this.mapTexture.draw(graphics);
    graphics.destroy();

    this.mapRendered = true;
    this.cameras.main.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
  }

  queueUpdate(snapshot: WorldSnapshot, playerId: string): void {
    this.pendingSnapshot = snapshot;
    this.pendingPlayerId = playerId;
  }

  update(): void {
    if (!this.pendingSnapshot || !this.pendingPlayerId) return;

    const snapshot = this.pendingSnapshot;
    const playerId = this.pendingPlayerId;

    // Render map if needed
    if (!this.mapRendered) {
      this.renderMap();
    }

    // Center camera on player
    const localPlayer = snapshot.players.find(p => p.id === playerId);
    if (localPlayer) {
      this.cameras.main.centerOn(
        localPlayer.position.x * TILE_SIZE,
        localPlayer.position.y * TILE_SIZE
      );
    }

    const usedPlayers = new Set<string>();
    const usedEnemies = new Set<string>();
    const usedProjectiles = new Set<string>();
    const usedLoots = new Set<string>();
    const usedPortals = new Set<string>();

    // Update portals
    for (const portal of snapshot.portals) {
      usedPortals.add(portal.id);
      let sprite = this.portalSprites.get(portal.id);
      if (!sprite) {
        const color = portal.targetType === 'nexus' ? 0x4488ff :
                     portal.targetType === 'dungeon' ? 0xff4444 : 0xff8844;
        sprite = this.add.arc(0, 0, 18, 0, 360, false, color);
        sprite.setStrokeStyle(3, 0xffffff);
        this.portalSprites.set(portal.id, sprite);
      }
      sprite.setPosition(portal.position.x * TILE_SIZE, portal.position.y * TILE_SIZE);
      // Handle visibility for blinking portals
      sprite.setVisible(portal.visible);
    }

    // Update loots
    for (const loot of snapshot.loots) {
      usedLoots.add(loot.id);
      let sprite = this.lootSprites.get(loot.id);
      if (!sprite) {
        const tier = getBagTier(loot.itemId);
        const color = LOOT_COLORS[tier] || LOOT_COLORS[0];
        sprite = this.add.arc(0, 0, 8, 0, 360, false, color);
        sprite.setStrokeStyle(2, 0x000000);
        this.lootSprites.set(loot.id, sprite);
      }
      sprite.setPosition(loot.position.x * TILE_SIZE, loot.position.y * TILE_SIZE);
    }

    // Update enemies
    for (const enemy of snapshot.enemies) {
      usedEnemies.add(enemy.id);
      let sprite = this.enemySprites.get(enemy.id);
      const def = ENEMIES[enemy.definitionId];
      const radius = (def?.radius || 0.4) * TILE_SIZE;

      if (!sprite) {
        const colorStr = def?.color || '#ff0000';
        const color = parseInt(colorStr.replace('#', ''), 16);
        sprite = this.add.arc(0, 0, radius, 0, 360, false, color);
        sprite.setStrokeStyle(2, 0x000000);
        this.enemySprites.set(enemy.id, sprite);
      }
      sprite.setPosition(enemy.position.x * TILE_SIZE, enemy.position.y * TILE_SIZE);
    }

    // Update players
    for (const player of snapshot.players) {
      usedPlayers.add(player.id);
      let sprite = this.playerSprites.get(player.id);
      const isLocal = player.id === playerId;

      if (!sprite) {
        const color = isLocal ? 0x44ff44 : 0x4488ff;
        sprite = this.add.arc(0, 0, 12, 0, 360, false, color);
        sprite.setStrokeStyle(2, 0xffffff);
        this.playerSprites.set(player.id, sprite);
      }
      sprite.setPosition(player.position.x * TILE_SIZE, player.position.y * TILE_SIZE);
    }

    // Update projectiles
    for (const proj of snapshot.projectiles) {
      usedProjectiles.add(proj.id);
      let sprite = this.projectileSprites.get(proj.id);

      if (!sprite) {
        const color = proj.ownerType === 'player' ? 0x44ff44 : 0xff4444;
        sprite = this.add.arc(0, 0, 5, 0, 360, false, color);
        this.projectileSprites.set(proj.id, sprite);
      }
      sprite.setPosition(proj.position.x * TILE_SIZE, proj.position.y * TILE_SIZE);
    }

    // Cleanup unused sprites
    this.cleanupMap(this.playerSprites, usedPlayers);
    this.cleanupMap(this.enemySprites, usedEnemies);
    this.cleanupMap(this.projectileSprites, usedProjectiles);
    this.cleanupMap(this.lootSprites, usedLoots);
    this.cleanupMap(this.portalSprites, usedPortals);
  }

  private cleanupMap(map: Map<string, Phaser.GameObjects.Arc>, usedIds: Set<string>): void {
    for (const [id, sprite] of map) {
      if (!usedIds.has(id)) {
        sprite.destroy();
        map.delete(id);
      }
    }
  }

  getPlayerScreenPosition(playerWorldPos: Vec2): Vec2 {
    const worldX = playerWorldPos.x * TILE_SIZE;
    const worldY = playerWorldPos.y * TILE_SIZE;
    const cam = this.cameras.main;
    return {
      x: worldX - cam.worldView.x,
      y: worldY - cam.worldView.y,
    };
  }
}

export class PhaserRenderer {
  private game: Phaser.Game;
  private scene: GameScene | null = null;
  private ready = false;
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;

  constructor(container: HTMLElement) {
    this.readyPromise = new Promise(resolve => {
      this.readyResolve = resolve;
    });

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.CANVAS, // Try Canvas instead of WebGL
      width: 800,
      height: 600,
      parent: container,
      backgroundColor: '#000000',
      scene: GameScene,
      banner: false,
      render: {
        antialias: false,
        pixelArt: true,
        roundPixels: true,
      },
      fps: {
        target: 60,
        forceSetTimeOut: false,
      },
      callbacks: {
        postBoot: game => {
          this.scene = game.scene.getScene('GameScene') as GameScene;
          this.ready = true;
          this.readyResolve();
        },
      },
    };

    this.game = new Phaser.Game(config);
  }

  async waitForReady(): Promise<void> {
    return this.readyPromise;
  }

  getCanvas(): HTMLCanvasElement {
    return this.game.canvas;
  }

  setMapData(width: number, height: number, tiles: number[]): void {
    if (this.ready && this.scene) {
      this.scene.setMapData(width, height, tiles);
    }
  }

  render(snapshot: WorldSnapshot, playerId: string): void {
    if (this.ready && this.scene) {
      this.scene.queueUpdate(snapshot, playerId);
    }
  }

  getPlayerScreenPosition(playerWorldPos: Vec2): Vec2 {
    if (this.ready && this.scene) {
      return this.scene.getPlayerScreenPosition(playerWorldPos);
    }
    return { x: 400, y: 300 };
  }
}
