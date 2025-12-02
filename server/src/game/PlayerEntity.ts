import {
  Player,
  PlayerInput,
  Vec2,
  CLASSES,
  WEAPONS,
  ARMORS,
  RINGS,
  getExpForLevel,
  getStarterEquipment,
  MAX_LEVEL,
  PLAYER_RADIUS,
  Character,
} from '@rotmg/shared';
import { Entity, normalizeVec2 } from './Entity.js';
import { Instance } from '../instances/Instance.js';

export class PlayerEntity extends Entity implements Player {
  type: 'player' = 'player';
  name: string;
  classId: string;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  dexterity: number;
  vitality: number;
  wisdom: number;
  equipment: (string | null)[];
  inventory: (string | null)[];
  lastHitTime: number = 0;

  // Server-only state
  accountId: string;
  characterId: string;
  lastInput: PlayerInput | null = null;
  lastShootTime: number = 0;
  lastAbilityTime: number = 0;
  instance: Instance | null = null;

  // Regen timers
  private hpRegenAccum: number = 0;
  private mpRegenAccum: number = 0;

  // Active buffs: { stat: string, amount: number, endTime: number }
  private activeBuffs: { stat: string; amount: number; endTime: number }[] = [];

  constructor(character: Character, accountId: string) {
    super({ x: 0, y: 0 }, PLAYER_RADIUS, character.id);
    this.accountId = accountId;
    this.characterId = character.id;
    this.name = character.name;
    this.classId = character.classId;
    this.level = character.level;
    this.exp = character.exp;
    this.hp = character.hp;
    this.maxHp = character.maxHp;
    this.mp = character.mp;
    this.maxMp = character.maxMp;
    this.attack = character.attack;
    this.defense = character.defense;
    this.speed = character.speed;
    this.dexterity = character.dexterity;
    this.vitality = character.vitality;
    this.wisdom = character.wisdom;
    this.equipment = [...character.equipment];
    this.inventory = [...character.inventory];

    // Migration: ensure old characters have starter equipment
    const starterEquipment = getStarterEquipment(character.classId);
    for (let i = 0; i < starterEquipment.length; i++) {
      if (this.equipment[i] === null && starterEquipment[i] !== null) {
        this.equipment[i] = starterEquipment[i];
      }
    }
  }

  update(deltaTime: number): void {
    // Remove expired buffs
    const now = Date.now();
    this.activeBuffs = this.activeBuffs.filter(buff => buff.endTime > now);

    // Apply movement from last input
    if (this.lastInput && this.instance) {
      const moveDir = normalizeVec2(this.lastInput.moveDirection);
      const moveSpeed = this.getEffectiveSpeed();

      const newX = this.position.x + moveDir.x * moveSpeed * deltaTime;
      const newY = this.position.y + moveDir.y * moveSpeed * deltaTime;

      // Check collision with map
      if (this.instance.map.canMoveTo(newX, newY, this.radius)) {
        this.position.x = newX;
        this.position.y = newY;
      } else {
        // Try sliding along walls
        if (this.instance.map.canMoveTo(newX, this.position.y, this.radius)) {
          this.position.x = newX;
        } else if (this.instance.map.canMoveTo(this.position.x, newY, this.radius)) {
          this.position.y = newY;
        }
      }
    }

    // HP regeneration (vitality based)
    if (this.hp < this.maxHp) {
      this.hpRegenAccum += (1 + this.vitality * 0.12) * deltaTime;
      if (this.hpRegenAccum >= 1) {
        const regen = Math.floor(this.hpRegenAccum);
        this.hp = Math.min(this.maxHp, this.hp + regen);
        this.hpRegenAccum -= regen;
      }
    }

    // MP regeneration (wisdom based)
    if (this.mp < this.maxMp) {
      this.mpRegenAccum += (0.5 + this.wisdom * 0.06) * deltaTime;
      if (this.mpRegenAccum >= 1) {
        const regen = Math.floor(this.mpRegenAccum);
        this.mp = Math.min(this.maxMp, this.mp + regen);
        this.mpRegenAccum -= regen;
      }
    }
  }

  processInput(input: PlayerInput): void {
    this.lastInput = input;
  }

  canShoot(): boolean {
    const weapon = this.getWeapon();
    if (!weapon) return false;

    const now = Date.now();
    const fireInterval = 1000 / weapon.rateOfFire;
    return now - this.lastShootTime >= fireInterval;
  }

  getWeapon() {
    const weaponId = this.equipment[0];
    return weaponId ? WEAPONS[weaponId] : null;
  }

  getEffectiveSpeed(): number {
    // Base speed + modifiers from equipment
    let speed = 4 + this.speed * 0.1;

    // Apply ring bonuses
    const ringId = this.equipment[3];
    if (ringId && RINGS[ringId]?.stats.speed) {
      speed += RINGS[ringId].stats.speed * 0.1;
    }

    // Apply buff bonuses
    speed += this.getBuffBonus('speed') * 0.1;

    return speed;
  }

  addBuff(stat: string, amount: number, duration: number): void {
    const endTime = Date.now() + duration * 1000;
    this.activeBuffs.push({ stat, amount, endTime });
  }

  getBuffBonus(stat: string): number {
    let total = 0;
    for (const buff of this.activeBuffs) {
      if (buff.stat === stat) {
        total += buff.amount;
      }
    }
    return total;
  }

  getEffectiveAttack(): number {
    let attack = this.attack;

    const ringId = this.equipment[3];
    if (ringId && RINGS[ringId]?.stats.attack) {
      attack += RINGS[ringId].stats.attack;
    }

    return attack;
  }

  getEffectiveDefense(): number {
    let defense = this.defense;

    const armorId = this.equipment[2];
    if (armorId && ARMORS[armorId]) {
      defense += ARMORS[armorId].defense;
    }

    const ringId = this.equipment[3];
    if (ringId && RINGS[ringId]?.stats.defense) {
      defense += RINGS[ringId].stats.defense;
    }

    return defense;
  }

  calculateDamage(baseDamage: number): number {
    // Damage formula: base damage + attack modifier
    const attackMod = this.getEffectiveAttack() * 0.5;
    return Math.floor(baseDamage + attackMod);
  }

  takeDamage(rawDamage: number): number {
    const defense = this.getEffectiveDefense();
    // Damage reduction formula: min 15% damage always gets through
    const damage = Math.max(Math.floor(rawDamage * 0.15), rawDamage - defense);
    this.hp = Math.max(0, this.hp - damage);
    this.lastHitTime = Date.now();
    return damage;
  }

  addExp(amount: number): boolean {
    if (this.level >= MAX_LEVEL) return false;

    this.exp += amount;
    const expNeeded = getExpForLevel(this.level + 1);

    if (this.exp >= expNeeded) {
      this.levelUp();
      return true;
    }
    return false;
  }

  private levelUp(): void {
    this.level++;
    this.exp = 0;

    const cls = CLASSES[this.classId];
    if (cls) {
      this.maxHp += cls.hpPerLevel;
      this.maxMp += cls.mpPerLevel;
      this.hp = this.maxHp;
      this.mp = this.maxMp;
      this.attack += cls.attackPerLevel;
      this.defense += cls.defensePerLevel;
      this.speed += cls.speedPerLevel;
      this.dexterity += cls.dexterityPerLevel;
      this.vitality += cls.vitalityPerLevel;
      this.wisdom += cls.wisdomPerLevel;
    }
  }

  isDead(): boolean {
    return this.hp <= 0;
  }

  toCharacterData(): Character {
    return {
      id: this.characterId,
      accountId: this.accountId,
      name: this.name,
      classId: this.classId,
      level: this.level,
      exp: this.exp,
      hp: this.hp,
      maxHp: this.maxHp,
      mp: this.mp,
      maxMp: this.maxMp,
      attack: this.attack,
      defense: this.defense,
      speed: this.speed,
      dexterity: this.dexterity,
      vitality: this.vitality,
      wisdom: this.wisdom,
      equipment: [...this.equipment],
      inventory: [...this.inventory],
      alive: !this.isDead(),
      createdAt: Date.now(),
    };
  }

  canPickupItem(slot: number): boolean {
    // Check if there's an empty inventory slot
    return this.inventory.some((item) => item === null);
  }

  addToInventory(itemId: string): boolean {
    const emptySlot = this.inventory.findIndex((item) => item === null);
    if (emptySlot === -1) return false;
    this.inventory[emptySlot] = itemId;
    return true;
  }
}
