import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import {
  ClientMessage,
  ServerMessage,
  PlayerInput,
  Character,
  WEAPONS,
  CLASSES,
  ARMORS,
  ABILITIES,
  ITEMS,
  Vec2,
} from '@rotmg/shared';
import { GameLoop } from '../game/GameLoop.js';
import { Instance } from '../instances/Instance.js';
import { GameMap, DungeonMapResult } from '../game/GameMap.js';
import { PlayerEntity } from '../game/PlayerEntity.js';
import { PortalEntity } from '../game/PortalEntity.js';
import { GameDatabase } from '../persistence/Database.js';

interface ClientSession {
  ws: WebSocket;
  accountId: string | null;
  playerId: string | null;
  characterId: string | null;
  instanceId: string | null;
  lastInputTime: number;
  inputCount: number;
}

export class GameServer {
  private wss: WebSocketServer;
  private gameLoop: GameLoop;
  private database: GameDatabase;
  private clients: Map<WebSocket, ClientSession> = new Map();
  private playerToClient: Map<string, WebSocket> = new Map();
  private nexusInstance: Instance;
  private realmInstance: Instance;

  constructor(port: number, database: GameDatabase) {
    this.database = database;
    this.gameLoop = new GameLoop(20); // 20 ticks per second

    // Create instances
    this.nexusInstance = new Instance('nexus', GameMap.createNexusMap(), 'nexus-main');
    this.nexusInstance.setGameServer(this);
    this.gameLoop.addInstance(this.nexusInstance);

    this.realmInstance = new Instance('realm', GameMap.createRealmMap(), 'realm-main');
    this.realmInstance.setGameServer(this);
    this.gameLoop.addInstance(this.realmInstance);

    // Add portals between instances
    // Nexus portal to Realm
    const realmPortal = new PortalEntity(
      { x: 15, y: 10 },
      'realm-main',
      'realm',
      'Realm Portal'
    );
    this.nexusInstance.addPortal(realmPortal);

    // Realm portal back to Nexus
    const nexusPortal = new PortalEntity(
      { x: 7, y: 7 },
      'nexus-main',
      'nexus',
      'Nexus Portal'
    );
    this.realmInstance.addPortal(nexusPortal);

    // WebSocket server
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    console.log(`Game server listening on port ${port}`);
  }

  private handleConnection(ws: WebSocket): void {
    const session: ClientSession = {
      ws,
      accountId: null,
      playerId: null,
      characterId: null,
      instanceId: null,
      lastInputTime: Date.now(),
      inputCount: 0,
    };
    this.clients.set(ws, session);

    ws.on('message', (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.handleMessage(ws, session, message);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(session);
      this.clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private handleMessage(ws: WebSocket, session: ClientSession, message: ClientMessage): void {
    // Rate limiting
    const now = Date.now();
    if (now - session.lastInputTime < 10) {
      session.inputCount++;
      if (session.inputCount > 100) {
        this.send(ws, { type: 'error', data: { message: 'Rate limited' } });
        return;
      }
    } else {
      session.lastInputTime = now;
      session.inputCount = 0;
    }

    switch (message.type) {
      case 'auth':
        this.handleAuth(ws, session, message.data.token);
        break;

      case 'createCharacter':
        this.handleCreateCharacter(ws, session, message.data);
        break;

      case 'selectCharacter':
        this.handleSelectCharacter(ws, session, message.data.characterId);
        break;

      case 'input':
        this.handleInput(session, message.data);
        break;

      case 'shoot':
        this.handleShoot(session, message.data.aimAngle);
        break;

      case 'useAbility':
        this.handleUseAbility(session);
        break;

      case 'pickupLoot':
        this.handlePickupLoot(session, message.data.lootId);
        break;

      case 'enterPortal':
        this.handleEnterPortal(session, message.data.portalId);
        break;

      case 'chat':
        this.handleChat(session, message.data.message);
        break;

      case 'swapItems':
        this.handleSwapItems(session, message.data.from, message.data.to);
        break;

      case 'returnToNexus':
        this.handleReturnToNexus(session);
        break;

      case 'dropItem':
        this.handleDropItem(session, message.data.slot);
        break;
    }
  }

  private async handleAuth(ws: WebSocket, session: ClientSession, token: string): Promise<void> {
    // Token format: "username:password" for simplicity (use JWT in production)
    const [username, password] = token.split(':');

    if (!username || !password) {
      this.send(ws, { type: 'authResult', data: { success: false, error: 'Invalid token format' } });
      return;
    }

    // Try to login
    let account = await this.database.validateLogin(username, password);

    // If login fails, try to create account
    if (!account) {
      account = await this.database.createAccount(username, password);
      if (!account) {
        // Account exists but password is wrong
        this.send(ws, { type: 'authResult', data: { success: false, error: 'Invalid credentials' } });
        return;
      }
    }

    session.accountId = account.id;
    this.send(ws, { type: 'authResult', data: { success: true, accountId: account.id } });

    // Send character list
    const characters = this.database.getAliveCharactersByAccount(account.id);
    this.send(ws, {
      type: 'characterList',
      data: {
        characters: characters.map((c) => ({
          id: c.id,
          name: c.name,
          classId: c.classId,
          level: c.level,
          alive: c.alive,
        })),
        maxCharacters: 3,
      },
    });
  }

  private handleCreateCharacter(
    ws: WebSocket,
    session: ClientSession,
    data: { classId: string; name: string }
  ): void {
    if (!session.accountId) {
      this.send(ws, { type: 'error', data: { message: 'Not authenticated' } });
      return;
    }

    if (!CLASSES[data.classId]) {
      this.send(ws, { type: 'error', data: { message: 'Invalid class' } });
      return;
    }

    const character = this.database.createCharacter(session.accountId, data.name, data.classId);
    if (!character) {
      this.send(ws, { type: 'error', data: { message: 'Failed to create character' } });
      return;
    }

    // Refresh character list
    const characters = this.database.getAliveCharactersByAccount(session.accountId);
    this.send(ws, {
      type: 'characterList',
      data: {
        characters: characters.map((c) => ({
          id: c.id,
          name: c.name,
          classId: c.classId,
          level: c.level,
          alive: c.alive,
        })),
        maxCharacters: 3,
      },
    });
  }

  private handleSelectCharacter(ws: WebSocket, session: ClientSession, characterId: string): void {
    if (!session.accountId) {
      this.send(ws, { type: 'error', data: { message: 'Not authenticated' } });
      return;
    }

    const character = this.database.getCharacter(characterId);
    if (!character || character.accountId !== session.accountId || !character.alive) {
      this.send(ws, { type: 'error', data: { message: 'Invalid character' } });
      return;
    }

    // Create player entity
    const player = new PlayerEntity(character, session.accountId);
    session.playerId = player.id;
    session.characterId = characterId;
    session.instanceId = this.nexusInstance.id;

    this.playerToClient.set(player.id, ws);
    this.nexusInstance.addPlayer(player);

    // Send instance change event with map data
    const mapData = this.nexusInstance.map.toData();
    this.send(ws, {
      type: 'instanceChange',
      data: {
        instanceId: this.nexusInstance.id,
        instanceType: 'nexus',
        spawnPosition: player.position,
        playerId: player.id,
        mapWidth: mapData.width,
        mapHeight: mapData.height,
        mapTiles: mapData.tiles,
      },
    });
  }

  private handleInput(session: ClientSession, input: PlayerInput): void {
    if (!session.playerId || !session.instanceId) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    // Validate input
    const moveDir = input.moveDirection;
    const len = Math.sqrt(moveDir.x * moveDir.x + moveDir.y * moveDir.y);
    if (len > 1.1) {
      // Allow small margin for floating point
      moveDir.x /= len;
      moveDir.y /= len;
    }

    player.processInput({
      moveDirection: moveDir,
      aimAngle: input.aimAngle,
      shooting: input.shooting,
    });

    // Handle shooting if requested
    if (input.shooting) {
      this.handleShoot(session, input.aimAngle);
    }
  }

  private handleShoot(session: ClientSession, aimAngle: number): void {
    if (!session.playerId || !session.instanceId) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    const player = instance.getPlayer(session.playerId);
    if (!player || !player.canShoot()) return;

    const weapon = player.getWeapon();
    if (!weapon) return;

    player.lastShootTime = Date.now();

    // Calculate damage
    const baseDamage = weapon.damage[0] + Math.random() * (weapon.damage[1] - weapon.damage[0]);
    const damage = player.calculateDamage(baseDamage);

    // Spawn projectiles
    const arcGapRad = (weapon.arcGap * Math.PI) / 180;
    const startAngle = aimAngle - (arcGapRad * (weapon.numProjectiles - 1)) / 2;

    for (let i = 0; i < weapon.numProjectiles; i++) {
      const angle = startAngle + arcGapRad * i;
      instance.spawnProjectile(
        player.id,
        'player',
        weapon.projectileId,
        { ...player.position },
        angle,
        weapon.projectileSpeed,
        Math.floor(damage),
        weapon.piercing,
        weapon.range / weapon.projectileSpeed
      );
    }
  }

  private handleUseAbility(session: ClientSession): void {
    if (!session.playerId || !session.instanceId) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    // Get ability from equipment slot 1
    const abilityId = player.equipment[1];
    if (!abilityId) return;

    const ability = ABILITIES[abilityId];
    if (!ability) return;

    // Check cooldown
    const now = Date.now();
    if (now - player.lastAbilityTime < ability.cooldown * 1000) return;

    // Check MP
    if (player.mp < ability.mpCost) return;

    // Consume MP and set cooldown
    player.mp -= ability.mpCost;
    player.lastAbilityTime = now;

    // Execute ability effect
    instance.executeAbility(player, ability);
  }

  private handlePickupLoot(session: ClientSession, lootId: string): void {
    if (!session.playerId || !session.instanceId) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    instance.tryPickupLoot(player, lootId);
  }

  private handleEnterPortal(session: ClientSession, portalId: string): void {
    if (!session.playerId || !session.instanceId) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    const portal = instance.tryEnterPortal(player, portalId);
    if (!portal) return;

    // Transfer player to new instance
    const targetInstance = this.gameLoop.getInstance(portal.targetInstance);
    if (!targetInstance) return;

    this.transferPlayerToInstance(session, player, instance, targetInstance);
  }

  private handleReturnToNexus(session: ClientSession): void {
    if (!session.playerId || !session.instanceId) return;

    // Already in nexus
    if (session.instanceId === this.nexusInstance.id) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    this.transferPlayerToInstance(session, player, instance, this.nexusInstance);
  }

  private handleDropItem(session: ClientSession, slot: number): void {
    if (!session.playerId || !session.instanceId) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    // Get item from slot (0-3 = equipment, 4-11 = inventory)
    let itemId: string | null = null;
    if (slot >= 0 && slot < 4) {
      itemId = player.equipment[slot];
      if (itemId) player.equipment[slot] = null;
    } else if (slot >= 4 && slot < 12) {
      const invIndex = slot - 4;
      itemId = player.inventory[invIndex];
      if (itemId) player.inventory[invIndex] = null;
    }

    if (!itemId) return;

    // Try to drop into existing nearby loot bag, or create new one
    instance.dropItem(player, itemId);
  }

  private transferPlayerToInstance(
    session: ClientSession,
    player: PlayerEntity,
    fromInstance: Instance,
    toInstance: Instance
  ): void {
    // Remove from current instance
    fromInstance.removePlayer(session.playerId!);

    // Add to target instance
    toInstance.addPlayer(player);
    session.instanceId = toInstance.id;

    // Send instance change with map data
    const mapData = toInstance.map.toData();
    this.send(session.ws, {
      type: 'instanceChange',
      data: {
        instanceId: toInstance.id,
        instanceType: toInstance.type,
        spawnPosition: player.position,
        playerId: player.id,
        mapWidth: mapData.width,
        mapHeight: mapData.height,
        mapTiles: mapData.tiles,
      },
    });
  }

  private handleChat(session: ClientSession, message: string): void {
    if (!session.playerId || !session.instanceId) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    // Sanitize and limit message
    const sanitized = message.slice(0, 200).trim();
    if (!sanitized) return;

    // Broadcast to nearby players
    for (const [client, clientSession] of this.clients) {
      if (clientSession.instanceId === session.instanceId) {
        this.send(client, {
          type: 'chat',
          data: {
            sender: player.name,
            message: sanitized,
            timestamp: Date.now(),
          },
        });
      }
    }
  }

  private handleSwapItems(session: ClientSession, fromSlot: number, toSlot: number): void {
    if (!session.playerId || !session.instanceId) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    // Slot mapping: 0-3 = equipment, 4-11 = inventory
    const getSlot = (slot: number): { array: (string | null)[]; index: number } | null => {
      if (slot >= 0 && slot < 4) {
        return { array: player.equipment, index: slot };
      } else if (slot >= 4 && slot < 12) {
        return { array: player.inventory, index: slot - 4 };
      }
      return null;
    };

    const from = getSlot(fromSlot);
    const to = getSlot(toSlot);

    if (!from || !to) return;

    // Validate equipment compatibility if moving to equipment slot
    if (toSlot < 4 && from.array[from.index]) {
      const itemId = from.array[from.index]!;
      const item = ITEMS[itemId];
      if (!item) return;

      // Check slot type compatibility
      const slotTypes = ['weapon', 'ability', 'armor', 'ring'];
      if (item.type !== slotTypes[toSlot]) {
        // Can't put wrong item type in equipment slot
        return;
      }

      // Check class compatibility for weapons/abilities/armor
      if (toSlot < 3) {
        const cls = CLASSES[player.classId];
        if (!cls) return;

        if (toSlot === 0) {
          // Weapon slot - check weapon type
          const weapon = WEAPONS[itemId];
          if (weapon && weapon.type !== cls.weaponType) return;
        } else if (toSlot === 2) {
          // Armor slot - check armor type
          const armor = ARMORS[itemId];
          if (armor && armor.type !== cls.armorType) return;
        }
      }
    }

    // Perform the swap
    const temp = from.array[from.index];
    from.array[from.index] = to.array[to.index];
    to.array[to.index] = temp;
  }

  private handleDisconnect(session: ClientSession): void {
    if (session.playerId && session.instanceId) {
      const instance = this.gameLoop.getInstance(session.instanceId);
      if (instance) {
        const player = instance.removePlayer(session.playerId);
        if (player && session.characterId) {
          // Save character state
          this.database.saveCharacter(player.toCharacterData());
        }
      }
      this.playerToClient.delete(session.playerId);
    }
  }

  handlePlayerDeath(player: PlayerEntity): void {
    // Mark character as dead in database
    this.database.killCharacter(player.characterId);

    // Remove player from client tracking
    const ws = this.playerToClient.get(player.id);
    if (ws) {
      const session = this.clients.get(ws);
      if (session) {
        session.playerId = null;
        session.characterId = null;
        session.instanceId = null;

        // Send updated character list
        if (session.accountId) {
          const characters = this.database.getAliveCharactersByAccount(session.accountId);
          this.send(ws, {
            type: 'characterList',
            data: {
              characters: characters.map((c) => ({
                id: c.id,
                name: c.name,
                classId: c.classId,
                level: c.level,
                alive: c.alive,
              })),
              maxCharacters: 3,
            },
          });
        }
      }
      this.playerToClient.delete(player.id);
    }
  }

  sendToPlayer(playerId: string, message: ServerMessage): void {
    const ws = this.playerToClient.get(playerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  start(): void {
    this.gameLoop.start();
  }

  stop(): void {
    this.gameLoop.stop();
    this.wss.close();
  }

  // Create a dungeon instance and spawn a portal to it at the given position
  spawnDungeonPortal(sourceInstance: Instance, position: Vec2): void {
    // Create new dungeon
    const dungeonId = `dungeon-${uuid()}`;
    const dungeonResult = GameMap.createDungeonMap();
    const dungeonInstance = new Instance('dungeon', dungeonResult.map, dungeonId);
    dungeonInstance.setGameServer(this);
    this.gameLoop.addInstance(dungeonInstance);

    // Store boss room center for return portal spawning
    dungeonInstance.setBossRoomCenter(dungeonResult.bossRoomCenter);
    dungeonInstance.setSourceInstanceId(sourceInstance.id);

    // Spawn all enemies at once (dungeons don't respawn)
    dungeonInstance.spawnInitialEnemies();

    // Create portal to dungeon in realm (expires in 2 minutes)
    const dungeonPortal = new PortalEntity(
      position,
      dungeonId,
      'dungeon',
      'Demon Lair',
      120 // 2 minutes lifetime
    );
    sourceInstance.addPortal(dungeonPortal);

    console.log(`Spawned dungeon portal at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) -> ${dungeonId}`);
  }

  // Called when dungeon boss is killed - spawn return portal
  onDungeonBossKilled(dungeonInstance: Instance, bossPosition: Vec2): void {
    // Get source instance (realm)
    const sourceInstanceId = dungeonInstance.getSourceInstanceId();
    if (!sourceInstanceId) {
      // Fallback: spawn portal to nexus
      const returnPortal = new PortalEntity(
        bossPosition,
        'nexus-main',
        'nexus',
        'Return Portal'
      );
      dungeonInstance.addPortal(returnPortal);
      return;
    }

    // Spawn permanent return portal to realm at boss room
    const returnPortal = new PortalEntity(
      bossPosition,
      sourceInstanceId,
      sourceInstanceId === 'nexus-main' ? 'nexus' : 'realm',
      'Return Portal'
    );
    dungeonInstance.addPortal(returnPortal);

    console.log(`Boss killed! Spawned return portal in ${dungeonInstance.id}`);
  }

  // Clean up empty dungeon instances
  cleanupDungeon(dungeonId: string): void {
    const instance = this.gameLoop.getInstance(dungeonId);
    if (instance && instance.type === 'dungeon' && instance.getPlayerCount() === 0) {
      this.gameLoop.removeInstance(dungeonId);
      console.log(`Cleaned up empty dungeon: ${dungeonId}`);
    }
  }
}
