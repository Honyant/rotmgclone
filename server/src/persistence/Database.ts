import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';
import { Account, Character, CLASSES, getStarterEquipment } from '@rotmg/shared';

export class GameDatabase {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private saveInterval: NodeJS.Timeout | null = null;

  constructor(dbPath: string = './data/game.db') {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();

    // Auto-save every 30 seconds
    this.saveInterval = setInterval(() => this.save(), 30000);
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        vault_items TEXT DEFAULT '[]'
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        class_id TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        hp INTEGER NOT NULL,
        max_hp INTEGER NOT NULL,
        mp INTEGER NOT NULL,
        max_mp INTEGER NOT NULL,
        attack INTEGER NOT NULL,
        defense INTEGER NOT NULL,
        speed INTEGER NOT NULL,
        dexterity INTEGER NOT NULL,
        vitality INTEGER NOT NULL,
        wisdom INTEGER NOT NULL,
        equipment TEXT NOT NULL,
        inventory TEXT NOT NULL,
        alive INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        death_time INTEGER
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_characters_account ON characters(account_id)`);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts (id)
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id)`);
  }

  save(): void {
    if (!this.db) return;

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  // Account methods
  async createAccount(username: string, password: string): Promise<Account | null> {
    if (!this.db) return null;

    const existing = this.db.exec('SELECT id FROM accounts WHERE username = ?', [username]);
    if (existing.length > 0 && existing[0].values.length > 0) return null;

    const id = uuid();
    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = Date.now();

    this.db.run(
      `INSERT INTO accounts (id, username, password_hash, created_at, vault_items) VALUES (?, ?, ?, ?, ?)`,
      [id, username, passwordHash, createdAt, '[]']
    );

    return {
      id,
      username,
      passwordHash,
      createdAt,
      vaultItems: [],
    };
  }

  async validateLogin(username: string, password: string): Promise<Account | null> {
    if (!this.db) return null;

    const result = this.db.exec(
      `SELECT id, username, password_hash, created_at, vault_items FROM accounts WHERE username = ?`,
      [username]
    );

    // Use a dummy hash if user doesn't exist to prevent timing attacks
    // This ensures bcrypt.compare is always called, making timing consistent
    const dummyHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // bcrypt hash of "dummy"

    let passwordHash: string;
    let accountData: any = null;

    if (result.length > 0 && result[0].values.length > 0) {
      const row = result[0].values[0];
      passwordHash = row[2] as string;
      accountData = row;
    } else {
      // User doesn't exist - use dummy hash to maintain consistent timing
      passwordHash = dummyHash;
    }

    // Always perform bcrypt comparison to prevent timing attacks
    const valid = await bcrypt.compare(password, passwordHash);

    // Only return account if user exists AND password is valid
    if (!valid || !accountData) return null;

    return {
      id: accountData[0] as string,
      username: accountData[1] as string,
      passwordHash: accountData[2] as string,
      createdAt: accountData[3] as number,
      vaultItems: JSON.parse(accountData[4] as string),
    };
  }

  getAccount(accountId: string): Account | null {
    if (!this.db) return null;

    const result = this.db.exec(
      `SELECT id, username, password_hash, created_at, vault_items FROM accounts WHERE id = ?`,
      [accountId]
    );

    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      id: row[0] as string,
      username: row[1] as string,
      passwordHash: row[2] as string,
      createdAt: row[3] as number,
      vaultItems: JSON.parse(row[4] as string),
    };
  }

  // Session methods
  createSession(accountId: string): string | null {
    if (!this.db) return null;

    // Clean up expired sessions first
    this.cleanupExpiredSessions();

    // Generate cryptographically secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const id = uuid();
    const createdAt = Date.now();
    const expiresAt = createdAt + 30 * 24 * 60 * 60 * 1000; // 30 days

    this.db.run(
      `INSERT INTO sessions (id, account_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
      [id, accountId, token, expiresAt, createdAt]
    );

    return token;
  }

  validateSession(token: string): Account | null {
    if (!this.db) return null;

    const result = this.db.exec(
      `SELECT s.account_id, s.expires_at, a.id, a.username, a.password_hash, a.created_at, a.vault_items
       FROM sessions s
       JOIN accounts a ON s.account_id = a.id
       WHERE s.token = ?`,
      [token]
    );

    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    const expiresAt = row[1] as number;

    // Check if token is expired
    if (Date.now() > expiresAt) {
      this.revokeSession(token);
      return null;
    }

    return {
      id: row[2] as string,
      username: row[3] as string,
      passwordHash: row[4] as string,
      createdAt: row[5] as number,
      vaultItems: JSON.parse(row[6] as string),
    };
  }

  revokeSession(token: string): void {
    if (!this.db) return;
    this.db.run(`DELETE FROM sessions WHERE token = ?`, [token]);
  }

  revokeAllSessions(accountId: string): void {
    if (!this.db) return;
    this.db.run(`DELETE FROM sessions WHERE account_id = ?`, [accountId]);
  }

  cleanupExpiredSessions(): void {
    if (!this.db) return;
    const now = Date.now();
    this.db.run(`DELETE FROM sessions WHERE expires_at < ?`, [now]);
  }

  // Character methods
  createCharacter(accountId: string, name: string, classId: string): Character | null {
    if (!this.db) return null;

    const cls = CLASSES[classId];
    if (!cls) return null;

    const id = uuid();
    const equipment = getStarterEquipment(classId);
    const inventory = new Array(8).fill(null);

    const character: Character = {
      id,
      accountId,
      name,
      classId,
      level: 1,
      exp: 0,
      hp: cls.baseHp,
      maxHp: cls.baseHp,
      mp: cls.baseMp,
      maxMp: cls.baseMp,
      attack: cls.baseAttack,
      defense: cls.baseDefense,
      speed: cls.baseSpeed,
      dexterity: cls.baseDexterity,
      vitality: cls.baseVitality,
      wisdom: cls.baseWisdom,
      equipment,
      inventory,
      alive: true,
      createdAt: Date.now(),
    };

    this.db.run(
      `INSERT INTO characters (
        id, account_id, name, class_id, level, exp,
        hp, max_hp, mp, max_mp,
        attack, defense, speed, dexterity, vitality, wisdom,
        equipment, inventory, alive, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        character.id,
        character.accountId,
        character.name,
        character.classId,
        character.level,
        character.exp,
        character.hp,
        character.maxHp,
        character.mp,
        character.maxMp,
        character.attack,
        character.defense,
        character.speed,
        character.dexterity,
        character.vitality,
        character.wisdom,
        JSON.stringify(character.equipment),
        JSON.stringify(character.inventory),
        character.alive ? 1 : 0,
        character.createdAt,
      ]
    );

    return character;
  }

  getCharacter(characterId: string): Character | null {
    if (!this.db) return null;

    const result = this.db.exec('SELECT * FROM characters WHERE id = ?', [characterId]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    return this.rowToCharacter(result[0].columns, result[0].values[0]);
  }

  getCharactersByAccount(accountId: string): Character[] {
    if (!this.db) return [];

    const result = this.db.exec('SELECT * FROM characters WHERE account_id = ?', [accountId]);
    if (result.length === 0) return [];

    return result[0].values.map((row: any[]) => this.rowToCharacter(result[0].columns, row));
  }

  getAliveCharactersByAccount(accountId: string): Character[] {
    if (!this.db) return [];

    const result = this.db.exec('SELECT * FROM characters WHERE account_id = ? AND alive = 1', [
      accountId,
    ]);
    if (result.length === 0) return [];

    return result[0].values.map((row: any[]) => this.rowToCharacter(result[0].columns, row));
  }

  saveCharacter(character: Character): void {
    if (!this.db) return;

    this.db.run(
      `UPDATE characters SET
        level = ?, exp = ?,
        hp = ?, max_hp = ?, mp = ?, max_mp = ?,
        attack = ?, defense = ?, speed = ?, dexterity = ?, vitality = ?, wisdom = ?,
        equipment = ?, inventory = ?,
        alive = ?, death_time = ?
      WHERE id = ?`,
      [
        character.level,
        character.exp,
        character.hp,
        character.maxHp,
        character.mp,
        character.maxMp,
        character.attack,
        character.defense,
        character.speed,
        character.dexterity,
        character.vitality,
        character.wisdom,
        JSON.stringify(character.equipment),
        JSON.stringify(character.inventory),
        character.alive ? 1 : 0,
        character.deathTime || null,
        character.id,
      ]
    );
  }

  killCharacter(characterId: string): void {
    if (!this.db) return;

    this.db.run(`UPDATE characters SET alive = 0, death_time = ? WHERE id = ?`, [
      Date.now(),
      characterId,
    ]);
  }

  private rowToCharacter(columns: string[], values: any[]): Character {
    const row: any = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });

    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      classId: row.class_id,
      level: row.level,
      exp: row.exp,
      hp: row.hp,
      maxHp: row.max_hp,
      mp: row.mp,
      maxMp: row.max_mp,
      attack: row.attack,
      defense: row.defense,
      speed: row.speed,
      dexterity: row.dexterity,
      vitality: row.vitality,
      wisdom: row.wisdom,
      equipment: JSON.parse(row.equipment),
      inventory: JSON.parse(row.inventory),
      alive: row.alive === 1,
      createdAt: row.created_at,
      deathTime: row.death_time,
    };
  }

  // Vault methods
  getVaultItems(accountId: string): (string | null)[] {
    if (!this.db) return [];

    const result = this.db.exec(`SELECT vault_items FROM accounts WHERE id = ?`, [accountId]);
    if (result.length === 0 || result[0].values.length === 0) return [];

    return JSON.parse(result[0].values[0][0] as string);
  }

  saveVaultItems(accountId: string, vaultItems: (string | null)[]): void {
    if (!this.db) return;

    this.db.run(`UPDATE accounts SET vault_items = ? WHERE id = ?`, [
      JSON.stringify(vaultItems),
      accountId,
    ]);
  }

  close(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    this.save();
    if (this.db) {
      this.db.close();
    }
  }
}
