import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { v4 as uuid } from 'uuid';
import { encode, decode } from '@msgpack/msgpack';
import { existsSync, readFileSync, watchFile } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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
  DUNGEONS,
  getDungeonForEnemy,
  DUNGEON_DROP_CHANCE,
  ENEMIES,
  VAULT_SIZE,
  VAULT_CHEST_INTERACT_RANGE,
} from '@rotmg/shared';
import { GameLoop } from '../game/GameLoop.js';
import { Instance } from '../instances/Instance.js';
import { GameMap, DungeonMapResult } from '../game/GameMap.js';
import { PlayerEntity } from '../game/PlayerEntity.js';
import { PortalEntity } from '../game/PortalEntity.js';
import { VaultChestEntity } from '../game/VaultChestEntity.js';
import { GameDatabase } from '../persistence/Database.js';

interface ClientSession {
  ws: WebSocket;
  accountId: string | null;
  playerId: string | null;
  characterId: string | null;
  instanceId: string | null;
  lastInputTime: number;
  inputCount: number;
  authAttempts: number;
  lastAuthAttempt: number;
  vaultOpen: boolean;
  vaultItems: (string | null)[];
}

export class GameServer {
  private wss: WebSocketServer;
  private gameLoop: GameLoop;
  private database: GameDatabase;
  private clients: Map<WebSocket, ClientSession> = new Map();
  private playerToClient: Map<string, WebSocket> = new Map();
  private nexusInstance: Instance;
  private realmInstance: Instance;
  private adminUsernames: Set<string> = new Set();
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private vaultInstances: Map<string, Instance> = new Map(); // keyed by accountId

  constructor(port: number, database: GameDatabase) {
    this.database = database;
    this.gameLoop = new GameLoop(20); // 20 ticks per second

    // Load admin list
    this.loadAdminList();

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

    // Vault portal in Nexus (special - creates personal instances)
    const vaultPortal = new PortalEntity(
      { x: 10, y: 10 },
      'vault', // Special marker - actual instance created on entry
      'vault',
      'Vault'
    );
    this.nexusInstance.addPortal(vaultPortal);

    // WebSocket server with origin validation
    this.wss = new WebSocketServer({
      port,
      verifyClient: (info: { origin: string; secure: boolean; req: IncomingMessage }) => {
        // Allow connections from localhost (dev) and production domain
        const origin = info.origin || info.req.headers.origin;
        const allowedOrigins = [
          'http://localhost:3000',
          'https://server.theanthonywang.com',
          'http://server.theanthonywang.com'
        ];

        // Allow if no origin (direct WebSocket connection) or if origin is whitelisted
        return !origin || allowedOrigins.includes(origin);
      }
    });

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
      authAttempts: 0,
      lastAuthAttempt: 0,
      vaultOpen: false,
      vaultItems: [],
    };
    this.clients.set(ws, session);

    ws.on('message', (data) => {
      try {
        // Support both binary (MessagePack) and JSON for backwards compatibility
        let message: ClientMessage;
        if (data instanceof Buffer || data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
          message = decode(data instanceof Buffer ? data : new Uint8Array(data as ArrayBuffer)) as ClientMessage;
        } else {
          const parsed = JSON.parse(data.toString());
          // Validate message has required 'type' property and isn't trying prototype pollution
          if (!parsed || typeof parsed !== 'object' || !parsed.type || parsed.__proto__ || parsed.constructor) {
            console.warn('Invalid message format or potential prototype pollution attempt');
            return;
          }
          message = parsed as ClientMessage;
        }
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
        this.handleAuth(ws, session, message.data.username, message.data.password);
        break;

      case 'authToken':
        this.handleAuthToken(ws, session, message.data.token);
        break;

      case 'logout':
        this.handleLogout(ws, session, message.data.token);
        break;

      case 'register':
        this.handleRegister(ws, session, message.data.username, message.data.password);
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

      case 'interactVaultChest':
        this.handleInteractVaultChest(session);
        break;

      case 'vaultTransfer':
        this.handleVaultTransfer(session, message.data.fromVault, message.data.fromSlot, message.data.toSlot);
        break;

      case 'closeVault':
        this.handleCloseVault(session);
        break;
    }
  }

  private validateCredentials(username: string, password: string): { valid: boolean; error?: string } {
    // Username validation
    if (!username || username.length < 3 || username.length > 20) {
      return { valid: false, error: 'Username must be 3-20 characters' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }

    // Password validation
    if (!password || password.length < 6 || password.length > 100) {
      return { valid: false, error: 'Password must be 6-100 characters' };
    }

    return { valid: true };
  }

  private loadAdminList(): void {
    try {
      const adminFilePath = join(process.cwd(), 'data', 'admins.txt');
      if (existsSync(adminFilePath)) {
        const content = readFileSync(adminFilePath, 'utf-8');
        this.adminUsernames.clear();
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            this.adminUsernames.add(trimmed.toLowerCase());
          }
        }
        console.log(`Loaded ${this.adminUsernames.size} admin(s): ${Array.from(this.adminUsernames).join(', ')}`);

        // Watch for changes to the admin file
        watchFile(adminFilePath, () => {
          console.log('Admin file changed, reloading...');
          this.loadAdminList();
        });
      } else {
        console.log('No admins.txt file found, no admins configured');
      }
    } catch (e) {
      console.error('Failed to load admin list:', e);
    }
  }

  private isAdmin(username: string): boolean {
    return this.adminUsernames.has(username.toLowerCase());
  }

  private handleAdminCommand(session: ClientSession, player: PlayerEntity, command: string): boolean {
    // Check if user is admin
    const account = this.database.getAccount(session.accountId!);
    if (!account || !this.isAdmin(account.username)) {
      return false;
    }

    const args = command.slice(1).split(' '); // Remove leading /
    const cmd = args[0].toLowerCase();

    switch (cmd) {
      case 'give': {
        // /give <item_id>
        const itemId = args[1];
        if (!itemId) {
          this.sendChatToPlayer(player, 'System', 'Usage: /give <item_id>');
          return true;
        }
        if (!ITEMS[itemId]) {
          this.sendChatToPlayer(player, 'System', `Unknown item: ${itemId}`);
          return true;
        }
        if (player.addToInventory(itemId)) {
          this.sendChatToPlayer(player, 'System', `Given: ${ITEMS[itemId].name}`);
        } else {
          this.sendChatToPlayer(player, 'System', 'Inventory full!');
        }
        return true;
      }

      case 'items': {
        // /items - List all available items
        const itemTypes = ['weapon', 'ability', 'armor', 'ring'];
        const filter = args[1]?.toLowerCase();
        let items = Object.keys(ITEMS);
        if (filter && itemTypes.includes(filter)) {
          items = items.filter(id => ITEMS[id].type === filter);
        }
        this.sendChatToPlayer(player, 'System', `Items (${items.length}): ${items.slice(0, 20).join(', ')}${items.length > 20 ? '...' : ''}`);
        return true;
      }

      case 'heal': {
        // /heal - Restore HP/MP to max
        player.hp = player.getEffectiveMaxHp();
        player.mp = player.getEffectiveMaxMp();
        this.sendChatToPlayer(player, 'System', 'Fully healed!');
        return true;
      }

      case 'level': {
        // /level <level> - Set player level
        const level = parseInt(args[1]) || 20;
        while (player.level < level && player.level < 20) {
          player.addExp(99999);
        }
        this.sendChatToPlayer(player, 'System', `Level set to ${player.level}`);
        return true;
      }

      case 'spawn': {
        // /spawn <enemy_id> - Spawn an enemy at player position
        const enemyId = args[1];
        if (!enemyId || !ENEMIES[enemyId]) {
          this.sendChatToPlayer(player, 'System', `Usage: /spawn <enemy_id>. Available: ${Object.keys(ENEMIES).slice(0, 10).join(', ')}...`);
          return true;
        }
        const instance = this.gameLoop.getInstance(session.instanceId!);
        if (instance) {
          instance.spawnEnemy(enemyId, { ...player.position });
          this.sendChatToPlayer(player, 'System', `Spawned ${ENEMIES[enemyId].name}`);
        }
        return true;
      }

      case 'tp': {
        // /tp <x> <y> - Teleport to coordinates
        const x = parseFloat(args[1]);
        const y = parseFloat(args[2]);
        if (isNaN(x) || isNaN(y)) {
          this.sendChatToPlayer(player, 'System', 'Usage: /tp <x> <y>');
          return true;
        }
        player.position.x = x;
        player.position.y = y;
        this.sendChatToPlayer(player, 'System', `Teleported to (${x}, ${y})`);
        return true;
      }

      case 'help': {
        this.sendChatToPlayer(player, 'System', 'Admin commands: /give, /items, /heal, /level, /spawn, /tp, /help');
        return true;
      }

      default:
        return false;
    }
  }

  private sendChatToPlayer(player: PlayerEntity, sender: string, message: string): void {
    const ws = this.playerToClient.get(player.id);
    if (ws) {
      this.send(ws, {
        type: 'chat',
        data: { sender, message, timestamp: Date.now() },
      });
    }
  }

  private checkAuthRateLimit(session: ClientSession): boolean {
    const now = Date.now();
    // Reset counter after 1 minute
    if (now - session.lastAuthAttempt > 60000) {
      session.authAttempts = 0;
    }
    session.lastAuthAttempt = now;
    session.authAttempts++;

    // Max 5 auth attempts per minute
    return session.authAttempts <= 5;
  }

  private async handleAuth(ws: WebSocket, session: ClientSession, username: string, password: string): Promise<void> {
    // Rate limiting
    if (!this.checkAuthRateLimit(session)) {
      this.send(ws, { type: 'authResult', data: { success: false, error: 'Too many login attempts. Try again later.' } });
      return;
    }

    // Basic validation (no min password length to support legacy accounts)
    if (!username || username.length < 3 || username.length > 20) {
      this.send(ws, { type: 'authResult', data: { success: false, error: 'Invalid username or password' } });
      return;
    }
    if (!password || password.length > 100) {
      this.send(ws, { type: 'authResult', data: { success: false, error: 'Invalid username or password' } });
      return;
    }

    // Try to login
    const account = await this.database.validateLogin(username, password);

    if (!account) {
      this.send(ws, { type: 'authResult', data: { success: false, error: 'Invalid username or password' } });
      return;
    }

    // Create session token
    const token = this.database.createSession(account.id);
    if (!token) {
      this.send(ws, { type: 'authResult', data: { success: false, error: 'Failed to create session' } });
      return;
    }

    session.accountId = account.id;
    this.send(ws, { type: 'authResult', data: { success: true, accountId: account.id, token } });

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
        maxCharacters: 2,
      },
    });
  }

  private async handleAuthToken(ws: WebSocket, session: ClientSession, token: string): Promise<void> {
    // Rate limiting
    if (!this.checkAuthRateLimit(session)) {
      this.send(ws, { type: 'authResult', data: { success: false, error: 'Too many login attempts. Try again later.' } });
      return;
    }

    // Validate token
    const account = this.database.validateSession(token);

    if (!account) {
      this.send(ws, { type: 'authResult', data: { success: false, error: 'Invalid or expired session' } });
      return;
    }

    session.accountId = account.id;
    this.send(ws, { type: 'authResult', data: { success: true, accountId: account.id, token } });

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
        maxCharacters: 2,
      },
    });
  }

  private handleLogout(ws: WebSocket, session: ClientSession, token: string): void {
    // Revoke the session token on the server
    this.database.revokeSession(token);
    console.log('Session revoked');
  }

  private async handleRegister(ws: WebSocket, session: ClientSession, username: string, password: string): Promise<void> {
    // Rate limiting
    if (!this.checkAuthRateLimit(session)) {
      this.send(ws, { type: 'registerResult', data: { success: false, error: 'Too many attempts. Try again later.' } });
      return;
    }

    // Validate credentials
    const validation = this.validateCredentials(username, password);
    if (!validation.valid) {
      this.send(ws, { type: 'registerResult', data: { success: false, error: validation.error } });
      return;
    }

    // Try to create account
    const account = await this.database.createAccount(username, password);

    if (!account) {
      this.send(ws, { type: 'registerResult', data: { success: false, error: 'Username already taken' } });
      return;
    }

    this.send(ws, { type: 'registerResult', data: { success: true, message: 'Account created! Please login.' } });
  }

  private async handleCreateCharacter(
    ws: WebSocket,
    session: ClientSession,
    data: { classId: string }
  ): Promise<void> {
    if (!session.accountId) {
      this.send(ws, { type: 'error', data: { message: 'Not authenticated' } });
      return;
    }

    if (!CLASSES[data.classId]) {
      this.send(ws, { type: 'error', data: { message: 'Invalid class' } });
      return;
    }

    // Check character limit
    const existingCharacters = this.database.getAliveCharactersByAccount(session.accountId);
    if (existingCharacters.length >= 2) {
      this.send(ws, { type: 'error', data: { message: 'Maximum 2 characters allowed' } });
      return;
    }

    // Get account to use username as character name
    const account = await this.database.getAccount(session.accountId);
    if (!account) {
      this.send(ws, { type: 'error', data: { message: 'Account not found' } });
      return;
    }

    const character = this.database.createCharacter(session.accountId, account.username, data.classId);
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
        maxCharacters: 2,
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
    player.shotsFired++;

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
    player.abilitiesUsed++;

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
    if (!session.playerId || !session.instanceId || !session.accountId) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    const portal = instance.tryEnterPortal(player, portalId);
    if (!portal) return;

    // Handle vault portal specially - create personal instance
    if (portal.targetType === 'vault') {
      const vaultInstance = this.getOrCreateVaultInstance(session.accountId);
      this.transferPlayerToInstance(session, player, instance, vaultInstance);
      return;
    }

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

    // Cap HP/MP if armor or ring was dropped
    if (slot === 2 || slot === 3) {
      const effectiveMaxHp = player.getEffectiveMaxHp();
      const effectiveMaxMp = player.getEffectiveMaxMp();
      if (player.hp > effectiveMaxHp) {
        player.hp = effectiveMaxHp;
      }
      if (player.mp > effectiveMaxMp) {
        player.mp = effectiveMaxMp;
      }
    }

    // Try to drop into existing nearby loot bag, or create new one
    instance.dropItem(player, itemId);
  }

  private getOrCreateVaultInstance(accountId: string): Instance {
    // Check if vault instance already exists for this account
    let vaultInstance = this.vaultInstances.get(accountId);
    if (vaultInstance) {
      return vaultInstance;
    }

    // Create new vault instance
    const vaultMapResult = GameMap.createVaultMap();
    const vaultId = `vault-${accountId}`;
    vaultInstance = new Instance('vault', vaultMapResult.map, vaultId);
    vaultInstance.setGameServer(this);

    // Add vault chest
    const vaultChest = new VaultChestEntity(vaultMapResult.chestPosition, 'vault-chest');
    vaultInstance.addVaultChest(vaultChest);

    // Add return portal to nexus
    const returnPortal = new PortalEntity(
      { x: 7.5, y: 12.5 },
      'nexus-main',
      'nexus',
      'Nexus Portal'
    );
    vaultInstance.addPortal(returnPortal);

    // Register instance
    this.gameLoop.addInstance(vaultInstance);
    this.vaultInstances.set(accountId, vaultInstance);

    console.log(`Created vault instance for account ${accountId}`);
    return vaultInstance;
  }

  private handleInteractVaultChest(session: ClientSession): void {
    if (!session.playerId || !session.instanceId || !session.accountId) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    // Security: Only allow vault interaction in vault instance
    if (instance.type !== 'vault') {
      console.warn(`Player ${session.playerId} tried to interact with vault outside vault instance`);
      return;
    }

    // Security: Verify this is the player's own vault
    if (instance.id !== `vault-${session.accountId}`) {
      console.warn(`Player ${session.playerId} tried to access another player's vault`);
      return;
    }

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    // Check distance to vault chest
    const vaultChest = instance.getFirstVaultChest();
    if (!vaultChest) return;

    const dist = player.distanceTo(vaultChest);
    if (dist > VAULT_CHEST_INTERACT_RANGE) return;

    // Load vault items from database
    let vaultItems = this.database.getVaultItems(session.accountId);

    // Initialize vault if empty (ensure VAULT_SIZE slots)
    if (vaultItems.length < VAULT_SIZE) {
      vaultItems = Array(VAULT_SIZE).fill(null);
      this.database.saveVaultItems(session.accountId, vaultItems);
    }

    // Store vault items in session for transfer operations
    session.vaultItems = [...vaultItems];
    session.vaultOpen = true;

    // Send vault contents to client
    this.send(session.ws, {
      type: 'vaultOpen',
      data: { vaultItems: session.vaultItems },
    });
  }

  private handleVaultTransfer(session: ClientSession, fromVault: boolean, fromSlot: number, toSlot: number): void {
    if (!session.playerId || !session.instanceId || !session.accountId) return;
    if (!session.vaultOpen) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    // Security: Only allow in vault instance
    if (instance.type !== 'vault') return;

    // Security: Verify own vault
    if (instance.id !== `vault-${session.accountId}`) return;

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    // Validate slot ranges
    // Vault slots: 0-7 (VAULT_SIZE)
    // Inventory slots: 0-7 (8 slots)
    if (fromVault) {
      if (fromSlot < 0 || fromSlot >= VAULT_SIZE) return;
      if (toSlot < 0 || toSlot >= 8) return;
    } else {
      if (fromSlot < 0 || fromSlot >= 8) return;
      if (toSlot < 0 || toSlot >= VAULT_SIZE) return;
    }

    // Perform atomic transfer
    if (fromVault) {
      // Vault -> Inventory
      const vaultItem = session.vaultItems[fromSlot];
      const invItem = player.inventory[toSlot];

      // Swap items (both can be null)
      session.vaultItems[fromSlot] = invItem;
      player.inventory[toSlot] = vaultItem;
    } else {
      // Inventory -> Vault
      const invItem = player.inventory[fromSlot];
      const vaultItem = session.vaultItems[toSlot];

      // Swap items (both can be null)
      player.inventory[fromSlot] = vaultItem;
      session.vaultItems[toSlot] = invItem;
    }

    // Save vault to database immediately for security
    this.database.saveVaultItems(session.accountId, session.vaultItems);

    // Send updated vault contents to client
    this.send(session.ws, {
      type: 'vaultUpdate',
      data: { vaultItems: session.vaultItems },
    });
  }

  private handleCloseVault(session: ClientSession): void {
    if (!session.accountId) return;

    if (session.vaultOpen && session.vaultItems.length > 0) {
      // Save vault items before closing
      this.database.saveVaultItems(session.accountId, session.vaultItems);
    }

    session.vaultOpen = false;
    session.vaultItems = [];
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

  private sanitizeHtml(text: string): string {
    // Remove HTML tags and escape special characters
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  private handleChat(session: ClientSession, message: string): void {
    if (!session.playerId || !session.instanceId) return;

    const instance = this.gameLoop.getInstance(session.instanceId);
    if (!instance) return;

    const player = instance.getPlayer(session.playerId);
    if (!player) return;

    // Sanitize for XSS and limit message length
    const trimmed = message.trim();
    if (!trimmed || trimmed.length > 200) return;

    // Check for admin commands (starts with /)
    if (trimmed.startsWith('/')) {
      if (this.handleAdminCommand(session, player, trimmed)) {
        return; // Command handled, don't broadcast
      }
      // Not an admin or invalid command - fall through to broadcast as normal chat
    }

    const sanitized = this.sanitizeHtml(trimmed);

    // Broadcast to nearby players
    for (const [client, clientSession] of this.clients) {
      if (clientSession.instanceId === session.instanceId) {
        this.send(client, {
          type: 'chat',
          data: {
            sender: this.sanitizeHtml(player.name),
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

    // Prevent swapping same slot with itself (potential duplication exploit)
    if (fromSlot === toSlot) return;

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

    const cls = CLASSES[player.classId];
    if (!cls) return;

    const slotTypes = ['weapon', 'ability', 'armor', 'ring'];

    // Helper to validate if an item can go into a specific equipment slot
    const isValidForEquipmentSlot = (itemId: string | null, equipSlot: number): boolean => {
      if (itemId === null) return true; // null is always valid (clearing slot)

      const item = ITEMS[itemId];
      if (!item) return false; // Unknown items are not valid

      // Check slot type compatibility
      if (item.type !== slotTypes[equipSlot]) return false;

      // Check class compatibility for weapons/abilities/armor
      if (equipSlot === 0) {
        // Weapon slot - check weapon type
        const weapon = WEAPONS[itemId];
        if (weapon && weapon.type !== cls.weaponType) return false;
      } else if (equipSlot === 1) {
        // Ability slot - check ability type
        const ability = ABILITIES[itemId];
        if (ability && ability.type !== cls.abilityType) return false;
      } else if (equipSlot === 2) {
        // Armor slot - check armor type
        const armor = ARMORS[itemId];
        if (armor && armor.type !== cls.armorType) return false;
      }
      // Ring slot (3) has no class restriction

      return true;
    };

    // Validate item going into toSlot (if toSlot is equipment slot)
    if (toSlot < 4) {
      if (!isValidForEquipmentSlot(from.array[from.index], toSlot)) {
        return;
      }
    }

    // Validate item going into fromSlot (if fromSlot is equipment slot) - this is the swap direction
    if (fromSlot < 4) {
      if (!isValidForEquipmentSlot(to.array[to.index], fromSlot)) {
        return;
      }
    }

    // Perform the swap
    const temp = from.array[from.index];
    from.array[from.index] = to.array[to.index];
    to.array[to.index] = temp;

    // Cap HP/MP to new effective max if armor or ring slot was involved
    if (fromSlot === 2 || fromSlot === 3 || toSlot === 2 || toSlot === 3) {
      const effectiveMaxHp = player.getEffectiveMaxHp();
      const effectiveMaxMp = player.getEffectiveMaxMp();
      if (player.hp > effectiveMaxHp) {
        player.hp = effectiveMaxHp;
      }
      if (player.mp > effectiveMaxMp) {
        player.mp = effectiveMaxMp;
      }
    }
  }

  private handleDisconnect(session: ClientSession): void {
    // Save vault if open
    if (session.accountId && session.vaultOpen && session.vaultItems.length > 0) {
      this.database.saveVaultItems(session.accountId, session.vaultItems);
    }

    if (session.playerId && session.instanceId) {
      const instance = this.gameLoop.getInstance(session.instanceId);
      if (instance) {
        const player = instance.removePlayer(session.playerId);
        if (player && session.characterId) {
          // Save character state
          this.database.saveCharacter(player.toCharacterData());
        }

        // Clean up vault instance if empty
        if (instance.type === 'vault' && instance.getPlayerCount() === 0 && session.accountId) {
          this.gameLoop.removeInstance(instance.id);
          this.vaultInstances.delete(session.accountId);
          console.log(`Cleaned up vault instance for account ${session.accountId}`);
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
              maxCharacters: 2,
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
      ws.send(encode(message));
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encode(message));
    }
  }

  start(): void {
    this.gameLoop.start();
    this.startAutoSave();
  }

  private startAutoSave(): void {
    // Auto-save all active player characters every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      this.saveAllPlayers();
    }, 30000);
    console.log('Auto-save enabled (every 30 seconds)');
  }

  private saveAllPlayers(): void {
    let savedCount = 0;
    for (const [, session] of this.clients) {
      if (session.playerId && session.instanceId && session.characterId) {
        const instance = this.gameLoop.getInstance(session.instanceId);
        if (instance) {
          const player = instance.getPlayer(session.playerId);
          if (player) {
            this.database.saveCharacter(player.toCharacterData());
            savedCount++;
          }
        }
      }
    }
    if (savedCount > 0) {
      console.log(`Auto-saved ${savedCount} player(s)`);
    }
  }

  stop(): void {
    // Clear auto-save interval
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    // Save all players before shutdown
    this.saveAllPlayers();
    this.gameLoop.stop();
    this.wss.close();
  }

  // Create a dungeon instance and spawn a portal to it at the given position
  spawnDungeonPortal(sourceInstance: Instance, position: Vec2, dungeonType: string = 'demon_lair'): void {
    const dungeonDef = DUNGEONS[dungeonType] || DUNGEONS['demon_lair'];

    // Create new dungeon
    const dungeonId = `dungeon-${uuid()}`;
    const dungeonResult = GameMap.createDungeonMap(dungeonType);
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
      dungeonDef.portalName,
      120 // 2 minutes lifetime
    );
    sourceInstance.addPortal(dungeonPortal);

    console.log(`Spawned ${dungeonDef.name} portal at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) -> ${dungeonId}`);
  }

  // Called when dungeon boss is killed - spawn return portal
  onDungeonBossKilled(dungeonInstance: Instance, bossPosition: Vec2): void {
    // Credit all players in the dungeon with a dungeon clear
    for (const player of dungeonInstance.getAllPlayers()) {
      player.dungeonsClearedCount++;
    }

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
