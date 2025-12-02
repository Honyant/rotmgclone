import { MapData, TileType, SpawnRegion, Vec2 } from '@rotmg/shared';

export class GameMap {
  width: number;
  height: number;
  tiles: TileType[];
  spawnRegions: SpawnRegion[];

  constructor(data: MapData) {
    this.width = data.width;
    this.height = data.height;
    this.tiles = [...data.tiles];
    this.spawnRegions = [...data.spawnRegions];
  }

  getTile(x: number, y: number): TileType {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) {
      return TileType.WALL;
    }
    return this.tiles[ty * this.width + tx];
  }

  setTile(x: number, y: number, tile: TileType): void {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx >= 0 && tx < this.width && ty >= 0 && ty < this.height) {
      this.tiles[ty * this.width + tx] = tile;
    }
  }

  isWalkable(x: number, y: number): boolean {
    const tile = this.getTile(x, y);
    return tile === TileType.FLOOR || tile === TileType.SPAWN || tile === TileType.BOSS_FLOOR;
  }

  canMoveTo(x: number, y: number, radius: number): boolean {
    // Check corners and center for collision
    const checkPoints = [
      { x, y },
      { x: x - radius, y: y - radius },
      { x: x + radius, y: y - radius },
      { x: x - radius, y: y + radius },
      { x: x + radius, y: y + radius },
    ];

    for (const point of checkPoints) {
      if (!this.isWalkable(point.x, point.y)) {
        return false;
      }
    }

    return true;
  }

  findSpawnPosition(): Vec2 {
    // First, collect all SPAWN tiles
    const spawnTiles: Vec2[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.getTile(x, y) === TileType.SPAWN) {
          spawnTiles.push({ x: x + 0.5, y: y + 0.5 });
        }
      }
    }

    // If we found spawn tiles, pick a random one
    if (spawnTiles.length > 0) {
      return spawnTiles[Math.floor(Math.random() * spawnTiles.length)];
    }

    // Fallback: find any regular floor tile (not BOSS_FLOOR)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.getTile(x, y) === TileType.FLOOR) {
          return { x: x + 0.5, y: y + 0.5 };
        }
      }
    }

    return { x: this.width / 2, y: this.height / 2 };
  }

  findRandomPositionInRegion(region: SpawnRegion): Vec2 | null {
    for (let attempts = 0; attempts < 20; attempts++) {
      const x = region.x + Math.random() * region.width;
      const y = region.y + Math.random() * region.height;
      // Only spawn on FLOOR or BOSS_FLOOR tiles, not SPAWN tiles (player spawn area)
      const tile = this.getTile(x, y);
      if (tile === TileType.FLOOR || tile === TileType.BOSS_FLOOR) {
        return { x, y };
      }
    }
    return null;
  }

  toData(): MapData {
    return {
      width: this.width,
      height: this.height,
      tiles: [...this.tiles],
      spawnRegions: [...this.spawnRegions],
    };
  }

  // Static factory methods for generating maps
  static createNexusMap(): GameMap {
    const width = 30;
    const height = 30;
    const tiles: TileType[] = new Array(width * height).fill(TileType.FLOOR);

    // Add walls around the edge
    for (let x = 0; x < width; x++) {
      tiles[x] = TileType.WALL;
      tiles[(height - 1) * width + x] = TileType.WALL;
    }
    for (let y = 0; y < height; y++) {
      tiles[y * width] = TileType.WALL;
      tiles[y * width + width - 1] = TileType.WALL;
    }

    // Add spawn area in center
    for (let y = 13; y < 17; y++) {
      for (let x = 13; x < 17; x++) {
        tiles[y * width + x] = TileType.SPAWN;
      }
    }

    return new GameMap({
      width,
      height,
      tiles,
      spawnRegions: [],
    });
  }

  static createRealmMap(): GameMap {
    const width = 100;
    const height = 100;
    const tiles: TileType[] = new Array(width * height).fill(TileType.FLOOR);

    // Add walls around the edge
    for (let x = 0; x < width; x++) {
      tiles[x] = TileType.WALL;
      tiles[(height - 1) * width + x] = TileType.WALL;
    }
    for (let y = 0; y < height; y++) {
      tiles[y * width] = TileType.WALL;
      tiles[y * width + width - 1] = TileType.WALL;
    }

    // Add some random walls/obstacles
    for (let i = 0; i < 200; i++) {
      const x = Math.floor(5 + Math.random() * (width - 10));
      const y = Math.floor(5 + Math.random() * (height - 10));
      const size = Math.floor(1 + Math.random() * 3);

      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          if (x + dx < width - 1 && y + dy < height - 1) {
            tiles[(y + dy) * width + (x + dx)] = TileType.WALL;
          }
        }
      }
    }

    // Add spawn area near entrance
    for (let y = 5; y < 10; y++) {
      for (let x = 5; x < 10; x++) {
        tiles[y * width + x] = TileType.SPAWN;
      }
    }

    // Define spawn regions
    const spawnRegions: SpawnRegion[] = [
      // Low-level enemies near spawn
      {
        x: 10,
        y: 10,
        width: 30,
        height: 30,
        enemyTypes: ['snake', 'pirate'],
        maxEnemies: 15,
        spawnRate: 0.5,
      },
      // Mid-level area
      {
        x: 40,
        y: 40,
        width: 30,
        height: 30,
        enemyTypes: ['pirate', 'demon'],
        maxEnemies: 10,
        spawnRate: 0.3,
      },
      // Boss area (far corner)
      {
        x: 70,
        y: 70,
        width: 25,
        height: 25,
        enemyTypes: ['demon', 'cube_god'],
        maxEnemies: 5,
        spawnRate: 0.1,
      },
    ];

    return new GameMap({
      width,
      height,
      tiles,
      spawnRegions,
    });
  }

  static createDungeonMap(): DungeonMapResult {
    const width = 150;
    const height = 150;
    const tiles: TileType[] = new Array(width * height).fill(TileType.WALL);

    interface Room {
      x: number;
      y: number;
      w: number;
      h: number;
      type: 'start' | 'normal' | 'boss';
      connections: number[];
    }

    const rooms: Room[] = [];

    // Create starting room in the center-left
    const startRoom: Room = {
      x: 5,
      y: Math.floor(height / 2) - 4,
      w: 8,
      h: 8,
      type: 'start',
      connections: [],
    };
    rooms.push(startRoom);

    // Generate rooms using branching algorithm
    const minRooms = 12;
    const maxRooms = 18;
    const targetRooms = minRooms + Math.floor(Math.random() * (maxRooms - minRooms + 1));

    // Directions: right, down, up (prefer forward progression)
    const directions = [
      { dx: 1, dy: 0, weight: 0.6 },  // right (main direction)
      { dx: 0, dy: 1, weight: 0.2 },  // down
      { dx: 0, dy: -1, weight: 0.2 }, // up
    ];

    let attempts = 0;
    while (rooms.length < targetRooms && attempts < 200) {
      attempts++;

      // Pick a random existing room to branch from
      const sourceIdx = Math.floor(Math.random() * rooms.length);
      const source = rooms[sourceIdx];

      // Pick a direction weighted toward right
      const rand = Math.random();
      let dir = directions[0];
      let cumWeight = 0;
      for (const d of directions) {
        cumWeight += d.weight;
        if (rand < cumWeight) {
          dir = d;
          break;
        }
      }

      // Calculate new room position
      const roomW = 8 + Math.floor(Math.random() * 6);
      const roomH = 8 + Math.floor(Math.random() * 6);
      const gap = 6 + Math.floor(Math.random() * 6); // corridor length

      let newX: number, newY: number;
      if (dir.dx !== 0) {
        // Horizontal direction
        newX = dir.dx > 0 ? source.x + source.w + gap : source.x - roomW - gap;
        newY = source.y + Math.floor(source.h / 2) - Math.floor(roomH / 2) +
               Math.floor((Math.random() - 0.5) * 4);
      } else {
        // Vertical direction
        newX = source.x + Math.floor(source.w / 2) - Math.floor(roomW / 2) +
               Math.floor((Math.random() - 0.5) * 4);
        newY = dir.dy > 0 ? source.y + source.h + gap : source.y - roomH - gap;
      }

      // Check bounds
      if (newX < 2 || newX + roomW >= width - 2 || newY < 2 || newY + roomH >= height - 2) {
        continue;
      }

      // Check overlap with existing rooms
      let overlaps = false;
      for (const room of rooms) {
        if (
          newX < room.x + room.w + 2 &&
          newX + roomW + 2 > room.x &&
          newY < room.y + room.h + 2 &&
          newY + roomH + 2 > room.y
        ) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        const newRoom: Room = {
          x: newX,
          y: newY,
          w: roomW,
          h: roomH,
          type: 'normal',
          connections: [sourceIdx],
        };
        source.connections.push(rooms.length);
        rooms.push(newRoom);
      }
    }

    // Find the rightmost room and make it the boss room
    let bossRoomIdx = 0;
    let maxX = 0;
    for (let i = 1; i < rooms.length; i++) {
      if (rooms[i].x > maxX) {
        maxX = rooms[i].x;
        bossRoomIdx = i;
      }
    }
    rooms[bossRoomIdx].type = 'boss';
    // Make boss room bigger
    rooms[bossRoomIdx].w = Math.max(rooms[bossRoomIdx].w, 12);
    rooms[bossRoomIdx].h = Math.max(rooms[bossRoomIdx].h, 12);

    // Carve out all rooms
    for (const room of rooms) {
      const tileType = room.type === 'boss' ? TileType.BOSS_FLOOR : TileType.FLOOR;
      for (let dy = 0; dy < room.h; dy++) {
        for (let dx = 0; dx < room.w; dx++) {
          const tx = room.x + dx;
          const ty = room.y + dy;
          if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
            tiles[ty * width + tx] = tileType;
          }
        }
      }
    }

    // Connect rooms with corridors
    const connected = new Set<string>();
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      for (const targetIdx of room.connections) {
        const key = [Math.min(i, targetIdx), Math.max(i, targetIdx)].join('-');
        if (connected.has(key)) continue;
        connected.add(key);

        const target = rooms[targetIdx];
        const srcCenterX = Math.floor(room.x + room.w / 2);
        const srcCenterY = Math.floor(room.y + room.h / 2);
        const tgtCenterX = Math.floor(target.x + target.w / 2);
        const tgtCenterY = Math.floor(target.y + target.h / 2);

        // Carve L-shaped corridor (2 tiles wide)
        const corridorWidth = 2;

        // Horizontal segment
        const minX = Math.min(srcCenterX, tgtCenterX);
        const maxX = Math.max(srcCenterX, tgtCenterX);
        for (let x = minX; x <= maxX; x++) {
          for (let w = 0; w < corridorWidth; w++) {
            const y = srcCenterY + w;
            if (y >= 0 && y < height) {
              tiles[y * width + x] = TileType.FLOOR;
            }
          }
        }

        // Vertical segment
        const minY = Math.min(srcCenterY, tgtCenterY);
        const maxY = Math.max(srcCenterY, tgtCenterY);
        for (let y = minY; y <= maxY; y++) {
          for (let w = 0; w < corridorWidth; w++) {
            const x = tgtCenterX + w;
            if (x >= 0 && x < width) {
              tiles[y * width + x] = TileType.FLOOR;
            }
          }
        }
      }
    }

    // Set spawn in start room
    const spawnRoom = rooms[0];
    for (let dy = 1; dy < spawnRoom.h - 1; dy++) {
      for (let dx = 1; dx < spawnRoom.w - 1; dx++) {
        tiles[(spawnRoom.y + dy) * width + (spawnRoom.x + dx)] = TileType.SPAWN;
      }
    }

    // Create spawn regions for each room (except start)
    const spawnRegions: SpawnRegion[] = [];
    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      if (room.type === 'boss') {
        // Boss room - spawn boss and guardians
        spawnRegions.push({
          x: room.x,
          y: room.y,
          width: room.w,
          height: room.h,
          enemyTypes: ['dungeon_boss'],
          maxEnemies: 1,
          spawnRate: 0.01, // Slow respawn
        });
        spawnRegions.push({
          x: room.x,
          y: room.y,
          width: room.w,
          height: room.h,
          enemyTypes: ['dungeon_guardian'],
          maxEnemies: 3,
          spawnRate: 0.1,
        });
      } else {
        // Normal room - spawn minions and occasional guardians
        spawnRegions.push({
          x: room.x,
          y: room.y,
          width: room.w,
          height: room.h,
          enemyTypes: ['dungeon_minion', 'dungeon_guardian'],
          maxEnemies: 4 + Math.floor(Math.random() * 3),
          spawnRate: 0.3,
        });
      }
    }

    // Calculate boss room center for portal placement
    const bossRoom = rooms[bossRoomIdx];
    const bossRoomCenter: Vec2 = {
      x: bossRoom.x + Math.floor(bossRoom.w / 2) + 0.5,
      y: bossRoom.y + Math.floor(bossRoom.h / 2) + 0.5,
    };

    return {
      map: new GameMap({
        width,
        height,
        tiles,
        spawnRegions,
      }),
      bossRoomCenter,
    };
  }
}

export interface DungeonMapResult {
  map: GameMap;
  bossRoomCenter: Vec2;
}
