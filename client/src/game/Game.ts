import { NetworkClient } from '../network/NetworkClient';
import { SimpleRenderer } from '../rendering/SimpleRenderer';
import { InputManager } from './InputManager';
import type {
  WorldSnapshot,
  CharacterListData,
  DamageEvent,
  DeathEvent,
  LevelUpEvent,
  AbilityEffectEvent,
  InstanceChangeEvent,
  ChatEvent,
  PlayerSnapshot,
  Vec2,
  TileType,
  PlayerDeathStats,
  VaultOpenEvent,
  VaultUpdateEvent,
} from '@rotmg/shared';
import { ITEMS, WEAPONS, ARMORS, ABILITIES, RINGS, getExpForLevel, MAX_LEVEL, VAULT_CHEST_INTERACT_RANGE } from '@rotmg/shared';

type GameState = 'connecting' | 'login' | 'character_select' | 'playing' | 'dead';

export class Game {
  private network: NetworkClient;
  private renderer: SimpleRenderer;
  private input!: InputManager;

  private state: GameState = 'connecting';
  private playerId: string | null = null;
  private lastSnapshot: WorldSnapshot | null = null;
  private characterList: CharacterListData | null = null;

  // UI Elements
  private gameContainer: HTMLElement;
  private loginScreen: HTMLElement;
  private characterScreen: HTMLElement;
  private statsPanel: HTMLElement;
  private chatMessages: HTMLElement;
  private chatInput: HTMLInputElement;

  // Loot popup
  private lootPopup: HTMLElement;
  private lootItems: HTMLElement;
  private currentLootBag: string | null = null;

  // Inventory drag/drop
  private selectedSlot: number | null = null;

  // Item tooltip
  private itemTooltip: HTMLElement;

  // Controls overlay
  private controlsOverlay: HTMLElement;

  // Death screen
  private deathScreen: HTMLElement;
  private deathScreenActive: boolean = false;
  private canDismissDeathScreen: boolean = false;
  private deathScreenKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  // Vault
  private vaultPanel: HTMLElement;
  private vaultOpen: boolean = false;
  private vaultItems: (string | null)[] = [];
  private selectedVaultSlot: number | null = null;

  constructor() {
    this.gameContainer = document.getElementById('game-container')!;

    this.renderer = new SimpleRenderer(this.gameContainer);

    // Get UI elements
    this.loginScreen = document.getElementById('login-screen')!;
    this.characterScreen = document.getElementById('character-screen')!;
    this.statsPanel = document.getElementById('stats-panel')!;
    this.chatMessages = document.getElementById('chat-messages')!;
    this.chatInput = document.getElementById('chat-input') as HTMLInputElement;
    this.lootPopup = document.getElementById('loot-popup')!;
    this.lootItems = document.getElementById('loot-items')!;
    this.itemTooltip = document.getElementById('item-tooltip')!;
    this.controlsOverlay = document.getElementById('controls-overlay')!;
    this.deathScreen = document.getElementById('death-screen')!;
    this.vaultPanel = document.getElementById('vault-panel')!;

    // Determine WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    let wsUrl: string;
    if (window.location.port === '3000') {
      wsUrl = `${wsProtocol}//${wsHost}:8080`;
    } else if (window.location.port === '' || window.location.port === '80') {
      wsUrl = `${wsProtocol}//${wsHost}/ws`;
    } else {
      wsUrl = `${wsProtocol}//${wsHost}:${window.location.port}`;
    }

    this.network = new NetworkClient(wsUrl);

    this.setupNetworkHandlers();
    this.setupUIHandlers();
  }

  private async initRenderer(): Promise<void> {
    await this.renderer.waitForReady();
    const canvas = this.renderer.getCanvas();
    this.input = new InputManager(canvas);
    this.setupInput();
  }

  private setupNetworkHandlers(): void {
    this.network.setHandlers({
      onConnect: () => {
        console.log('Connected to server');
        // Try auto-login with saved session token
        const savedToken = localStorage.getItem('rotmg_session_token');
        if (savedToken) {
          console.log('Attempting auto-login with saved session');
          this.network.authenticateToken(savedToken);
          // Don't show login screen yet, wait for auth result
        } else {
          // Pre-fill username if saved (password is NEVER stored for security)
          const savedUsername = localStorage.getItem('rotmg_username');
          if (savedUsername) {
            (document.getElementById('username-input') as HTMLInputElement).value = savedUsername;
          }
          this.setState('login');
        }
      },

      onDisconnect: () => {
        console.log('Disconnected');
        this.setState('connecting');
      },

      onAuthResult: (success, accountId, token, error) => {
        const authMessage = document.getElementById('auth-message')!;
        if (success) {
          console.log('Authenticated as', accountId);
          authMessage.textContent = '';

          // Save session token for persistent login
          if (token) {
            localStorage.setItem('rotmg_session_token', token);
          }

          // Save username for convenience
          const usernameInput = document.getElementById('username-input') as HTMLInputElement;
          if (usernameInput && usernameInput.value) {
            localStorage.setItem('rotmg_username', usernameInput.value);
          }
        } else {
          // Clear invalid token on failed auth
          localStorage.removeItem('rotmg_session_token');

          authMessage.textContent = error || 'Login failed';
          authMessage.style.color = '#ff6666';

          // Show login screen if auto-login failed
          if (this.state === 'connecting') {
            const savedUsername = localStorage.getItem('rotmg_username');
            if (savedUsername) {
              (document.getElementById('username-input') as HTMLInputElement).value = savedUsername;
            }
            this.setState('login');
          }
        }
      },

      onRegisterResult: (success, message, error) => {
        const authMessage = document.getElementById('auth-message')!;
        if (success) {
          authMessage.textContent = message || 'Registration successful! Please login.';
          authMessage.style.color = '#66ff66';
        } else {
          authMessage.textContent = error || 'Registration failed';
          authMessage.style.color = '#ff6666';
        }
      },

      onCharacterList: (data) => {
        this.characterList = data;
        // Don't show character select if death screen is active
        if (!this.deathScreenActive) {
          this.setState('character_select');
        }
        this.updateCharacterList();
      },

      onInstanceChange: (event) => {
        console.log('Instance changed to', event.instanceType);
        this.playerId = event.playerId;
        this.setState('playing');
        this.renderer.setMapData(event.mapWidth, event.mapHeight, event.mapTiles);
        // Close vault UI when changing instances
        if (this.vaultOpen) {
          this.closeVaultUI();
        }
      },

      onSnapshot: (snapshot) => {
        this.lastSnapshot = snapshot;
        this.updateStatsUI();
        // Update renderer with new snapshot for interpolation
        if (this.playerId) {
          this.renderer.updateSnapshot(snapshot, this.playerId);
        }
      },

      onDamage: (event) => {
        // Could add damage numbers here in future
      },

      onDeath: (event) => {
        if (event.entityType === 'player' && event.entityId === this.playerId) {
          this.showDeathScreen(event.stats, event.killerName);
        }
      },

      onLevelUp: (event) => {
        if (event.playerId === this.playerId) {
          this.addChatMessage('System', `Level up! You are now level ${event.newLevel}!`);
          this.playLevelUpAnimation(event.newLevel);
        }
      },

      onAbilityEffect: (event) => {
        this.renderer.playAbilityEffect(event);
      },

      onChat: (event) => {
        this.addChatMessage(event.sender, event.message);
      },

      onVaultOpen: (event) => {
        this.openVaultUI(event.vaultItems);
      },

      onVaultUpdate: (event) => {
        this.updateVaultUI(event.vaultItems);
      },

      onError: (message) => {
        console.error('Server error:', message);
        alert('Error: ' + message);
      },
    });
  }

  private setupUIHandlers(): void {
    // Prevent browser zoom with Ctrl+/- and Ctrl+scroll
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
      }
    });
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    }, { passive: false });

    // Login
    document.getElementById('login-btn')!.addEventListener('click', () => {
      const username = (document.getElementById('username-input') as HTMLInputElement).value;
      const password = (document.getElementById('password-input') as HTMLInputElement).value;
      const authMessage = document.getElementById('auth-message')!;

      if (!username || !password) {
        authMessage.textContent = 'Please enter username and password';
        authMessage.style.color = '#ff6666';
        return;
      }

      authMessage.textContent = '';
      this.network.authenticate(username, password);
    });

    // Register
    document.getElementById('register-btn')!.addEventListener('click', () => {
      const username = (document.getElementById('username-input') as HTMLInputElement).value;
      const password = (document.getElementById('password-input') as HTMLInputElement).value;
      const authMessage = document.getElementById('auth-message')!;

      if (!username || !password) {
        authMessage.textContent = 'Please enter username and password';
        authMessage.style.color = '#ff6666';
        return;
      }

      if (username.length < 3) {
        authMessage.textContent = 'Username must be at least 3 characters';
        authMessage.style.color = '#ff6666';
        return;
      }

      if (password.length < 6) {
        authMessage.textContent = 'Password must be at least 6 characters';
        authMessage.style.color = '#ff6666';
        return;
      }

      authMessage.textContent = '';
      this.network.register(username, password);
    });

    // Character creation
    document.getElementById('create-char-btn')!.addEventListener('click', () => {
      const classId = (document.getElementById('char-class-select') as HTMLSelectElement).value;
      this.network.createCharacter(classId);
    });

    // Logout
    document.getElementById('logout-btn')!.addEventListener('click', () => {
      // Get session token before clearing
      const token = localStorage.getItem('rotmg_session_token');

      // Clear session token to prevent auto-login
      localStorage.removeItem('rotmg_session_token');

      // Revoke session on server if token exists
      if (token) {
        this.network.logout(token);
      }

      this.network.disconnect();
      this.characterList = null;
      this.playerId = null;
      this.lastSnapshot = null;
      // Clear only password field (username stays for convenience)
      (document.getElementById('password-input') as HTMLInputElement).value = '';
      this.setState('login');
      // Reconnect to allow new login
      setTimeout(() => this.network.connect(), 500);
    });

    // Chat
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && this.chatInput.value.trim()) {
        this.network.sendChat(this.chatInput.value.trim());
        this.chatInput.value = '';
        this.chatInput.blur();
      }
    });

    // Enter chat on Enter key
    window.addEventListener('keypress', (e) => {
      if (
        e.key === 'Enter' &&
        this.state === 'playing' &&
        document.activeElement !== this.chatInput
      ) {
        this.chatInput.focus();
      }
    });
  }

  private setupInput(): void {
    // F key - Enter portals
    this.input.setInteractHandler(() => {
      if (this.state !== 'playing' || !this.lastSnapshot) return;

      const localPlayer = this.lastSnapshot.players.find((p) => p.id === this.playerId);
      if (!localPlayer) return;

      // Check for nearby portals
      for (const portal of this.lastSnapshot.portals) {
        const dx = portal.position.x - localPlayer.position.x;
        const dy = portal.position.y - localPlayer.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 1.5) {
          this.network.enterPortal(portal.id);
          return;
        }
      }
    });

    // G key - Pickup loot
    this.input.setPickupHandler(() => {
      if (this.state !== 'playing' || !this.lastSnapshot) return;

      const localPlayer = this.lastSnapshot.players.find((p) => p.id === this.playerId);
      if (!localPlayer) return;

      // Check for nearby loot
      for (const loot of this.lastSnapshot.loots) {
        const dx = loot.position.x - localPlayer.position.x;
        const dy = loot.position.y - localPlayer.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 1) {
          this.network.pickupLoot(loot.id);
          return;
        }
      }
    });

    this.input.setNexusHandler(() => {
      if (this.state !== 'playing') return;
      this.network.returnToNexus();
    });

    this.input.setAbilityHandler(() => {
      if (this.state !== 'playing') return;
      this.network.useAbility();
    });

  }

  private setState(newState: GameState): void {
    this.state = newState;

    this.loginScreen.classList.toggle('hidden', newState !== 'login');
    this.characterScreen.classList.toggle('hidden', newState !== 'character_select');

    // Hide game UI elements when not playing
    const showGameUI = newState === 'playing';
    this.gameContainer.classList.toggle('game-ui-hidden', !showGameUI);
  }

  private updateCharacterList(): void {
    const listEl = document.getElementById('character-list')!;
    listEl.innerHTML = '';

    if (!this.characterList) return;

    for (const char of this.characterList.characters) {
      const item = document.createElement('div');
      item.className = 'character-item';
      const classColor = char.classId === 'wizard' ? 'class-wizard' :
                         char.classId === 'warrior' ? 'class-warrior' : 'class-archer';
      item.innerHTML = `
        <div class="character-info">
          <div class="character-name">${char.name}</div>
          <div class="character-class ${classColor}">${char.classId.charAt(0).toUpperCase() + char.classId.slice(1)}</div>
        </div>
        <div class="character-level">Lv ${char.level}</div>
      `;
      item.addEventListener('click', () => {
        this.network.selectCharacter(char.id);
      });
      listEl.appendChild(item);
    }

    if (this.characterList.characters.length === 0) {
      listEl.innerHTML = '<p class="no-characters">No characters yet. Create one below!</p>';
    }

    // Disable create button if at max characters
    const createBtn = document.getElementById('create-char-btn') as HTMLButtonElement;
    const atMaxChars = this.characterList.characters.length >= this.characterList.maxCharacters;
    createBtn.disabled = atMaxChars;
  }

  private updateStatsUI(): void {
    if (!this.lastSnapshot) return;

    const localPlayer = this.lastSnapshot.players.find((p) => p.id === this.playerId);
    if (!localPlayer) return;

    document.getElementById('hp-display')!.textContent = `${Math.round(localPlayer.hp)}/${Math.round(localPlayer.maxHp)}`;
    document.getElementById('mp-display')!.textContent = `${Math.round(localPlayer.mp)}/${Math.round(localPlayer.maxMp)}`;
    document.getElementById('level-display')!.textContent = String(localPlayer.level);
    document.getElementById('instance-display')!.textContent = this.lastSnapshot.instanceType;

    // Update XP bar
    if (localPlayer.level >= MAX_LEVEL) {
      document.getElementById('xp-bar-fill')!.style.width = '100%';
      document.getElementById('xp-text')!.textContent = 'MAX';
    } else {
      const expNeeded = getExpForLevel(localPlayer.level + 1);
      const xpPercent = Math.min(100, (localPlayer.exp / expNeeded) * 100);
      document.getElementById('xp-bar-fill')!.style.width = `${xpPercent}%`;
      document.getElementById('xp-text')!.textContent = `${localPlayer.exp}/${expNeeded}`;
    }

    // Calculate equipment bonuses
    const bonuses = this.calculateEquipmentBonuses(localPlayer.equipment);

    // Update stat displays with bonuses
    this.updateStatDisplay('att-display', localPlayer.attack, bonuses.attack);
    this.updateStatDisplay('def-display', localPlayer.defense, bonuses.defense);
    this.updateStatDisplay('spd-display', localPlayer.speed, bonuses.speed);
    this.updateStatDisplay('dex-display', localPlayer.dexterity, bonuses.dexterity);
    this.updateStatDisplay('vit-display', localPlayer.vitality, bonuses.vitality);
    this.updateStatDisplay('wis-display', localPlayer.wisdom, bonuses.wisdom);

    this.updateInventoryUI(localPlayer);
  }

  private calculateEquipmentBonuses(equipment: (string | null)[]): Record<string, number> {
    const bonuses: Record<string, number> = {
      attack: 0,
      defense: 0,
      speed: 0,
      dexterity: 0,
      vitality: 0,
      wisdom: 0,
    };

    // Check armor (slot 2)
    const armorId = equipment[2];
    if (armorId && ARMORS[armorId]) {
      bonuses.defense += ARMORS[armorId].defense || 0;
    }

    // Check ring (slot 3)
    const ringId = equipment[3];
    if (ringId && RINGS[ringId]?.stats) {
      const stats = RINGS[ringId].stats;
      bonuses.attack += stats.attack || 0;
      bonuses.defense += stats.defense || 0;
      bonuses.speed += stats.speed || 0;
      bonuses.dexterity += stats.dexterity || 0;
      bonuses.vitality += stats.vitality || 0;
      bonuses.wisdom += stats.wisdom || 0;
    }

    return bonuses;
  }

  private updateStatDisplay(elementId: string, baseStat: number, bonus: number): void {
    const el = document.getElementById(elementId)!;
    if (bonus > 0) {
      el.innerHTML = `${baseStat} <span style="color: #8f8;">(+${bonus})</span>`;
    } else {
      el.textContent = String(baseStat);
    }
  }

  private updateInventoryUI(player: PlayerSnapshot): void {
    const equipmentGrid = document.getElementById('equipment-grid')!;
    const inventoryGrid = document.getElementById('inventory-grid')!;

    // Equipment slots (slots 0-3)
    equipmentGrid.innerHTML = '';
    const equipLabels = ['Wep', 'Abl', 'Arm', 'Ring'];
    for (let i = 0; i < 4; i++) {
      const slot = this.createSlotElement(i, player.equipment[i], equipLabels[i], true);
      equipmentGrid.appendChild(slot);
    }

    // Inventory slots (slots 4-11)
    inventoryGrid.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const slotIndex = i + 4;
      const slot = this.createSlotElement(slotIndex, player.inventory[i], String(i + 1), false);
      inventoryGrid.appendChild(slot);
    }
  }

  private createSlotElement(slotIndex: number, itemId: string | null, label: string, isEquipment: boolean): HTMLElement {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot' + (isEquipment ? ' equipment-slot' : '');
    slot.dataset.slot = String(slotIndex);

    if (itemId) {
      const item = ITEMS[itemId];
      slot.style.backgroundColor = item?.color || '#444';
      slot.title = item ? `${item.name} (T${item.tier})\n${item.description}` : itemId;
      slot.textContent = item?.type[0].toUpperCase() || '?';
    } else {
      slot.textContent = label;
      slot.style.color = '#555';
    }

    if (this.selectedSlot === slotIndex) {
      slot.style.outline = '2px solid #ffd700';
      slot.style.outlineOffset = '-2px';
    }

    slot.style.cursor = 'pointer';

    // Use pointerdown for more reliable click detection
    // This fires before mousedown and works better across devices
    slot.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.handleSlotClick(slotIndex, e.shiftKey);
    }, { capture: true });

    // Block all mouse events from propagating to canvas
    slot.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, { capture: true });
    slot.addEventListener('mouseup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, { capture: true });
    slot.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, { capture: true });

    // Hover to show tooltip
    slot.addEventListener('mouseenter', () => {
      if (itemId) {
        this.updateItemTooltip(itemId);
      }
    });
    slot.addEventListener('mouseleave', () => {
      this.updateItemTooltip(null);
    });

    return slot;
  }

  private handleSlotClick(slotIndex: number, shiftKey: boolean): void {
    // Shift+click to drop item
    if (shiftKey) {
      this.network.dropItem(slotIndex);
      this.selectedSlot = null;
      return;
    }

    // If vault slot is selected and clicking on inventory slot, transfer vault -> inventory
    if (this.vaultOpen && this.selectedVaultSlot !== null && slotIndex >= 4 && slotIndex < 12) {
      const invSlot = slotIndex - 4;
      this.network.vaultTransfer(true, this.selectedVaultSlot, invSlot);
      this.selectedVaultSlot = null;
      this.selectedSlot = null;
      this.updateInventoryAndVault();
      return;
    }

    if (this.selectedSlot === null) {
      this.selectedSlot = slotIndex;
      this.selectedVaultSlot = null; // Deselect vault when selecting inventory
    } else if (this.selectedSlot === slotIndex) {
      this.selectedSlot = null;
    } else {
      this.network.swapItems(this.selectedSlot, slotIndex);
      this.selectedSlot = null;
    }
    if (this.lastSnapshot) {
      const localPlayer = this.lastSnapshot.players.find((p) => p.id === this.playerId);
      if (localPlayer) {
        this.updateInventoryUI(localPlayer);
      }
    }
    if (this.vaultOpen) {
      this.renderVaultUI();
    }
  }

  private updateItemTooltip(itemId: string | null): void {
    if (!itemId) {
      this.itemTooltip.classList.add('hidden');
      return;
    }

    const item = ITEMS[itemId];
    if (!item) {
      this.itemTooltip.classList.add('hidden');
      return;
    }

    // Set name with color
    const nameEl = document.getElementById('tooltip-name')!;
    nameEl.textContent = item.name;
    nameEl.style.color = item.color || '#fff';

    // Set tier
    const tierEl = document.getElementById('tooltip-tier')!;
    tierEl.textContent = `Tier ${item.tier} ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}${item.soulbound ? ' (Soulbound)' : ''}`;

    // Set stats based on item type
    const statsEl = document.getElementById('tooltip-stats')!;
    statsEl.innerHTML = this.getItemStats(itemId, item.type);

    // Set description
    const descEl = document.getElementById('tooltip-desc')!;
    descEl.textContent = item.description;

    this.itemTooltip.classList.remove('hidden');
  }

  private getItemStats(itemId: string, type: string): string {
    const stats: string[] = [];

    if (type === 'weapon') {
      const weapon = WEAPONS[itemId];
      if (weapon) {
        stats.push(`Damage: ${weapon.damage[0]}-${weapon.damage[1]}`);
        stats.push(`Range: ${weapon.range}`);
        stats.push(`Rate of Fire: ${weapon.rateOfFire}/s`);
        if (weapon.numProjectiles > 1) {
          stats.push(`Shots: ${weapon.numProjectiles}`);
        }
        if (weapon.piercing) {
          stats.push('Piercing');
        }
      }
    } else if (type === 'armor') {
      const armor = ARMORS[itemId];
      if (armor) {
        stats.push(`+${armor.defense} Defense`);
        if (armor.hpBonus) stats.push(`+${armor.hpBonus} HP`);
        if (armor.mpBonus) stats.push(`+${armor.mpBonus} MP`);
      }
    } else if (type === 'ability') {
      const ability = ABILITIES[itemId];
      if (ability) {
        stats.push(`MP Cost: ${ability.mpCost}`);
        stats.push(`Cooldown: ${ability.cooldown}s`);
        if (ability.effect.type === 'heal') {
          stats.push(`Heals: ${ability.effect.amount} HP`);
        } else if (ability.effect.type === 'damage') {
          stats.push(`Damage: ${ability.effect.damage}`);
          stats.push(`Radius: ${ability.effect.radius}`);
        } else if (ability.effect.type === 'buff') {
          stats.push(`+${ability.effect.amount} ${ability.effect.stat}`);
          stats.push(`Duration: ${ability.effect.duration}s`);
        } else if (ability.effect.type === 'teleport') {
          stats.push(`Range: ${ability.effect.range}`);
        }
      }
    } else if (type === 'ring') {
      const ring = RINGS[itemId];
      if (ring && ring.stats) {
        if (ring.stats.hp) stats.push(`+${ring.stats.hp} HP`);
        if (ring.stats.mp) stats.push(`+${ring.stats.mp} MP`);
        if (ring.stats.attack) stats.push(`+${ring.stats.attack} Attack`);
        if (ring.stats.defense) stats.push(`+${ring.stats.defense} Defense`);
        if (ring.stats.speed) stats.push(`+${ring.stats.speed} Speed`);
        if (ring.stats.dexterity) stats.push(`+${ring.stats.dexterity} Dexterity`);
        if (ring.stats.vitality) stats.push(`+${ring.stats.vitality} Vitality`);
        if (ring.stats.wisdom) stats.push(`+${ring.stats.wisdom} Wisdom`);
      }
    }

    return stats.join('<br>');
  }

  private addChatMessage(sender: string, message: string): void {
    const msgEl = document.createElement('div');
    msgEl.innerHTML = `<strong>${sender}:</strong> ${message}`;
    this.chatMessages.appendChild(msgEl);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    while (this.chatMessages.children.length > 50) {
      this.chatMessages.removeChild(this.chatMessages.firstChild!);
    }
  }

  private updateLootPopup(): void {
    if (!this.lastSnapshot || this.state !== 'playing') {
      this.hideLootPopup();
      return;
    }

    const localPlayer = this.lastSnapshot.players.find((p) => p.id === this.playerId);
    if (!localPlayer) {
      this.hideLootPopup();
      return;
    }

    let nearestLoot = null;
    let nearestDist = Infinity;
    const LOOT_RANGE = 1.5;

    for (const loot of this.lastSnapshot.loots) {
      const dx = loot.position.x - localPlayer.position.x;
      const dy = loot.position.y - localPlayer.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < LOOT_RANGE && dist < nearestDist) {
        nearestDist = dist;
        nearestLoot = loot;
      }
    }

    if (nearestLoot) {
      this.showLootPopup(nearestLoot.id, nearestLoot.itemId);
    } else {
      this.hideLootPopup();
    }
  }

  private showLootPopup(lootId: string, itemId: string): void {
    if (this.currentLootBag === lootId) return;
    this.currentLootBag = lootId;

    const item = ITEMS[itemId];
    if (!item) {
      this.hideLootPopup();
      return;
    }

    this.lootItems.innerHTML = '';
    const itemEl = document.createElement('div');
    itemEl.className = 'loot-item';
    itemEl.innerHTML = `
      <div class="loot-item-icon" style="background-color: ${item.color}">
        ${item.type[0].toUpperCase()}
      </div>
      <div class="loot-item-info">
        <div class="loot-item-name">${item.name}<span class="loot-item-tier">T${item.tier}</span></div>
        <div class="loot-item-desc">${item.description}</div>
      </div>
    `;
    itemEl.addEventListener('click', () => {
      this.network.pickupLoot(lootId);
    });
    this.lootItems.appendChild(itemEl);

    this.lootPopup.classList.remove('hidden');
  }

  private hideLootPopup(): void {
    if (this.currentLootBag !== null) {
      this.currentLootBag = null;
      this.lootPopup.classList.add('hidden');
    }
  }

  private openVaultUI(vaultItems: (string | null)[]): void {
    this.vaultItems = vaultItems;
    this.vaultOpen = true;
    this.selectedVaultSlot = null;
    this.selectedSlot = null;
    this.renderVaultUI();
    this.vaultPanel.classList.remove('hidden');
  }

  private updateVaultUI(vaultItems: (string | null)[]): void {
    this.vaultItems = vaultItems;
    if (this.vaultOpen) {
      this.renderVaultUI();
    }
  }

  private closeVaultUI(): void {
    if (this.vaultOpen) {
      this.vaultOpen = false;
      this.selectedVaultSlot = null;
      this.vaultPanel.classList.add('hidden');
      this.network.closeVault();
    }
  }

  private renderVaultUI(): void {
    const vaultGrid = document.getElementById('vault-grid')!;
    vaultGrid.innerHTML = '';

    for (let i = 0; i < this.vaultItems.length; i++) {
      const slot = this.createVaultSlotElement(i, this.vaultItems[i]);
      vaultGrid.appendChild(slot);
    }
  }

  private createVaultSlotElement(slotIndex: number, itemId: string | null): HTMLElement {
    const slot = document.createElement('div');
    slot.className = 'vault-slot';
    slot.dataset.slot = String(slotIndex);

    if (itemId) {
      const item = ITEMS[itemId];
      slot.style.backgroundColor = item?.color || '#444';
      slot.title = item ? `${item.name} (T${item.tier})\n${item.description}` : itemId;
      slot.textContent = item?.type[0].toUpperCase() || '?';
    } else {
      slot.textContent = String(slotIndex + 1);
      slot.style.color = '#555';
    }

    if (this.selectedVaultSlot === slotIndex) {
      slot.style.outline = '2px solid #ffd700';
      slot.style.outlineOffset = '-2px';
    }

    slot.style.cursor = 'pointer';

    // Click handler
    slot.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleVaultSlotClick(slotIndex);
    }, { capture: true });

    // Block mouse events
    slot.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, { capture: true });

    // Hover for tooltip
    slot.addEventListener('mouseenter', () => {
      if (itemId) {
        this.updateItemTooltip(itemId);
      }
    });
    slot.addEventListener('mouseleave', () => {
      this.updateItemTooltip(null);
    });

    return slot;
  }

  private handleVaultSlotClick(slotIndex: number): void {
    // If inventory slot is selected, transfer from inventory to vault
    if (this.selectedSlot !== null && this.selectedSlot >= 4 && this.selectedSlot < 12) {
      const invSlot = this.selectedSlot - 4;
      this.network.vaultTransfer(false, invSlot, slotIndex);
      this.selectedSlot = null;
      this.selectedVaultSlot = null;
      this.updateInventoryAndVault();
      return;
    }

    // If another vault slot is selected, swap within vault (not supported, just deselect)
    if (this.selectedVaultSlot !== null && this.selectedVaultSlot !== slotIndex) {
      this.selectedVaultSlot = slotIndex;
      this.renderVaultUI();
      return;
    }

    // If same slot clicked, deselect
    if (this.selectedVaultSlot === slotIndex) {
      this.selectedVaultSlot = null;
      this.renderVaultUI();
      return;
    }

    // Select this vault slot
    this.selectedVaultSlot = slotIndex;
    this.selectedSlot = null; // Deselect inventory
    this.renderVaultUI();
    if (this.lastSnapshot) {
      const localPlayer = this.lastSnapshot.players.find((p) => p.id === this.playerId);
      if (localPlayer) {
        this.updateInventoryUI(localPlayer);
      }
    }
  }

  private updateInventoryAndVault(): void {
    if (this.lastSnapshot) {
      const localPlayer = this.lastSnapshot.players.find((p) => p.id === this.playerId);
      if (localPlayer) {
        this.updateInventoryUI(localPlayer);
      }
    }
    if (this.vaultOpen) {
      this.renderVaultUI();
    }
  }

  private nearVaultChest: boolean = false;

  private updateVaultProximity(): void {
    if (!this.lastSnapshot || this.state !== 'playing') return;

    const localPlayer = this.lastSnapshot.players.find((p) => p.id === this.playerId);
    if (!localPlayer) return;

    // Check for nearby vault chests
    let isNearChest = false;
    for (const chest of this.lastSnapshot.vaultChests) {
      const dx = chest.position.x - localPlayer.position.x;
      const dy = chest.position.y - localPlayer.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < VAULT_CHEST_INTERACT_RANGE) {
        isNearChest = true;
        break;
      }
    }

    // Auto-open vault when approaching chest
    if (isNearChest && !this.nearVaultChest && !this.vaultOpen) {
      this.network.interactVaultChest();
    }

    // Auto-close vault when moving away
    if (!isNearChest && this.nearVaultChest && this.vaultOpen) {
      this.closeVaultUI();
    }

    this.nearVaultChest = isNearChest;
  }

  private playLevelUpAnimation(newLevel: number): void {
    // Show level up text overlay
    const overlay = document.getElementById('level-up-overlay')!;
    overlay.textContent = `LEVEL ${newLevel}!`;
    overlay.style.opacity = '1';
    overlay.style.transform = 'translate(-50%, -50%) scale(1.2)';
    overlay.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';

    setTimeout(() => {
      overlay.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 100);

    setTimeout(() => {
      overlay.style.opacity = '0';
    }, 1500);

    // Create double helix particle effect
    this.renderer.playHelixParticles();
  }

  private showDeathScreen(stats?: PlayerDeathStats, killerName?: string): void {
    // Set state
    this.setState('dead');
    this.deathScreenActive = true;
    this.canDismissDeathScreen = false;

    // Populate death screen with stats
    if (stats) {
      document.getElementById('death-char-name')!.textContent = stats.characterName;
      document.getElementById('death-class-name')!.textContent = stats.className;
      document.getElementById('death-killer-name')!.textContent = killerName || 'Unknown';
      document.getElementById('death-level')!.textContent = String(stats.level);
      document.getElementById('death-kills')!.textContent = String(stats.enemiesKilled);
      document.getElementById('death-xp')!.textContent = this.formatNumber(stats.totalXp);
      document.getElementById('death-damage-dealt')!.textContent = this.formatNumber(stats.damageDealt);
      document.getElementById('death-damage-taken')!.textContent = this.formatNumber(stats.damageTaken);
      document.getElementById('death-shots')!.textContent = String(stats.shotsFired);
      document.getElementById('death-abilities')!.textContent = String(stats.abilitiesUsed);
      document.getElementById('death-dungeons')!.textContent = String(stats.dungeonsClearedCount);
      document.getElementById('death-time')!.textContent = this.formatTime(stats.timePlayed);
    }

    // Hide the continue prompt initially
    const continuePrompt = document.querySelector('.death-continue') as HTMLElement;
    if (continuePrompt) {
      continuePrompt.style.opacity = '0';
    }

    // Remove any existing handler
    if (this.deathScreenKeyHandler) {
      window.removeEventListener('keydown', this.deathScreenKeyHandler, true);
      this.deathScreenKeyHandler = null;
    }

    // Create the key handler
    this.deathScreenKeyHandler = (e: KeyboardEvent) => {
      // Block all keypresses while death screen is showing
      if (this.deathScreenActive) {
        e.preventDefault();
        e.stopPropagation();

        // Only allow dismissal after animations complete
        if (this.canDismissDeathScreen) {
          this.hideDeathScreen();
        }
      }
    };

    // Add listener in capture phase so it runs BEFORE other handlers
    window.addEventListener('keydown', this.deathScreenKeyHandler, true);

    // Start animations
    // 1. Background fades in first
    this.deathScreen.classList.add('visible');

    // 2. Content fades in after background starts
    setTimeout(() => {
      if (this.deathScreenActive) {
        this.deathScreen.classList.add('show-content');
      }
    }, 500);

    // 3. Clear canvas after background opacity settles (~2s)
    setTimeout(() => {
      if (this.deathScreenActive) {
        this.renderer.clearCanvas();
      }
    }, 2000);

    // 4. Enable dismissal after animations complete (~4s)
    setTimeout(() => {
      if (this.deathScreenActive) {
        this.canDismissDeathScreen = true;
        if (continuePrompt) {
          continuePrompt.style.opacity = '1';
        }
      }
    }, 4000);
  }

  private hideDeathScreen(): void {
    // Clean up state
    this.deathScreenActive = false;
    this.canDismissDeathScreen = false;

    // Remove key handler
    if (this.deathScreenKeyHandler) {
      window.removeEventListener('keydown', this.deathScreenKeyHandler, true);
      this.deathScreenKeyHandler = null;
    }

    // Fade out: first content, then background
    this.deathScreen.classList.remove('show-content');

    // After content fades, remove background and transition to character select
    setTimeout(() => {
      this.deathScreen.classList.remove('visible');
      this.setState('character_select');
    }, 1000);
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return String(num);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hours}:${String(remMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  async start(): Promise<void> {
    await this.initRenderer();
    this.network.connect();
    this.lastInputTime = 0;
    this.gameLoop();
  }

  private lastInputTime: number = 0;
  private readonly INPUT_RATE = 50;

  // FPS tracking
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 0;
  private lastFrameTime = 0;

  private gameLoop(): void {
    const now = performance.now();
    const deltaTime = (now - this.lastFrameTime) / 1000; // in seconds
    this.lastFrameTime = now;

    // FPS counter
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      // console.log(`FPS: ${this.currentFps}`);
    }

    if (this.state === 'playing' && this.lastSnapshot && now - this.lastInputTime >= this.INPUT_RATE) {
      const localPlayer = this.lastSnapshot.players.find((p) => p.id === this.playerId);
      if (localPlayer) {
        const screenPos = this.renderer.getPlayerScreenPosition(localPlayer.position);
        const aimAngle = this.input.getAimAngle(screenPos);

        this.network.sendInput({
          moveDirection: this.input.getMoveDirection(),
          aimAngle,
          shooting: this.input.isShooting(),
        });
        this.lastInputTime = now;
      }
    }

    if (this.state === 'playing') {
      // Apply local movement prediction for instant response
      const moveDir = this.input.getMoveDirection();
      this.renderer.applyLocalMovement(moveDir, deltaTime);

      // Update camera rotation smoothly based on held keys
      this.input.updateCameraRotation(deltaTime);
      this.renderer.setCameraRotation(this.input.getCameraRotation());
      // Render with interpolation using deltaTime
      this.renderer.render(deltaTime);
      this.updateLootPopup();
      this.updateVaultProximity();

      // Show/hide controls overlay when H is held
      this.controlsOverlay.classList.toggle('hidden', !this.input.isKeyDown('h'));
    } else {
      // Hide controls when not playing
      this.controlsOverlay.classList.add('hidden');
    }

    requestAnimationFrame(() => this.gameLoop());
  }
}
