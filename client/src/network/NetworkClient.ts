import { encode, decode } from '@msgpack/msgpack';
import type {
  ClientMessage,
  ServerMessage,
  PlayerInput,
  WorldSnapshot,
  CharacterListData,
  DamageEvent,
  DeathEvent,
  LevelUpEvent,
  AbilityEffectEvent,
  InstanceChangeEvent,
  ChatEvent,
  VaultOpenEvent,
  VaultUpdateEvent,
} from '@rotmg/shared';

export type NetworkEventHandler = {
  onSnapshot?: (snapshot: WorldSnapshot) => void;
  onDamage?: (event: DamageEvent) => void;
  onDeath?: (event: DeathEvent) => void;
  onLevelUp?: (event: LevelUpEvent) => void;
  onAbilityEffect?: (event: AbilityEffectEvent) => void;
  onAuthResult?: (success: boolean, accountId?: string, token?: string, error?: string) => void;
  onRegisterResult?: (success: boolean, message?: string, error?: string) => void;
  onCharacterList?: (data: CharacterListData) => void;
  onInstanceChange?: (event: InstanceChangeEvent) => void;
  onChat?: (event: ChatEvent) => void;
  onVaultOpen?: (event: VaultOpenEvent) => void;
  onVaultUpdate?: (event: VaultUpdateEvent) => void;
  onError?: (message: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

export class NetworkClient {
  private ws: WebSocket | null = null;
  private handlers: NetworkEventHandler = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  setHandlers(handlers: NetworkEventHandler): void {
    this.handlers = handlers;
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.serverUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log('Connected to server');
      this.reconnectAttempts = 0;
      this.handlers.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        // Handle binary MessagePack data
        const message: ServerMessage = decode(new Uint8Array(event.data)) as ServerMessage;
        this.handleMessage(message);
      } catch (e) {
        console.error('Failed to parse server message:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from server');
      this.handlers.onDisconnect?.();
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
    }
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'snapshot':
        this.handlers.onSnapshot?.(message.data);
        break;
      case 'damage':
        this.handlers.onDamage?.(message.data);
        break;
      case 'death':
        this.handlers.onDeath?.(message.data);
        break;
      case 'levelUp':
        this.handlers.onLevelUp?.(message.data);
        break;
      case 'authResult':
        this.handlers.onAuthResult?.(
          message.data.success,
          message.data.accountId,
          message.data.token,
          message.data.error
        );
        break;
      case 'registerResult':
        this.handlers.onRegisterResult?.(
          message.data.success,
          message.data.message,
          message.data.error
        );
        break;
      case 'characterList':
        this.handlers.onCharacterList?.(message.data);
        break;
      case 'instanceChange':
        this.handlers.onInstanceChange?.(message.data);
        break;
      case 'chat':
        this.handlers.onChat?.(message.data);
        break;
      case 'abilityEffect':
        this.handlers.onAbilityEffect?.(message.data);
        break;
      case 'vaultOpen':
        this.handlers.onVaultOpen?.(message.data);
        break;
      case 'vaultUpdate':
        this.handlers.onVaultUpdate?.(message.data);
        break;
      case 'error':
        this.handlers.onError?.(message.data.message);
        break;
    }
  }

  private send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(encode(message));
    }
  }

  // Public send methods
  authenticate(username: string, password: string): void {
    this.send({ type: 'auth', data: { username, password } });
  }

  authenticateToken(token: string): void {
    this.send({ type: 'authToken', data: { token } });
  }

  logout(token: string): void {
    this.send({ type: 'logout', data: { token } });
  }

  register(username: string, password: string): void {
    this.send({ type: 'register', data: { username, password } });
  }

  createCharacter(classId: string): void {
    this.send({ type: 'createCharacter', data: { classId } });
  }

  selectCharacter(characterId: string): void {
    this.send({ type: 'selectCharacter', data: { characterId } });
  }

  sendInput(input: PlayerInput): void {
    this.send({ type: 'input', data: input });
  }

  sendShoot(aimAngle: number): void {
    this.send({ type: 'shoot', data: { aimAngle } });
  }

  useAbility(): void {
    this.send({ type: 'useAbility' });
  }

  pickupLoot(lootId: string): void {
    this.send({ type: 'pickupLoot', data: { lootId } });
  }

  swapItems(fromSlot: number, toSlot: number): void {
    this.send({ type: 'swapItems', data: { from: fromSlot, to: toSlot } });
  }

  dropItem(slot: number): void {
    this.send({ type: 'dropItem', data: { slot } });
  }

  enterPortal(portalId: string): void {
    this.send({ type: 'enterPortal', data: { portalId } });
  }

  returnToNexus(): void {
    this.send({ type: 'returnToNexus' });
  }

  sendChat(message: string): void {
    this.send({ type: 'chat', data: { message } });
  }

  interactVaultChest(): void {
    this.send({ type: 'interactVaultChest' });
  }

  vaultTransfer(fromVault: boolean, fromSlot: number, toSlot: number): void {
    this.send({ type: 'vaultTransfer', data: { fromVault, fromSlot, toSlot } });
  }

  closeVault(): void {
    this.send({ type: 'closeVault' });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
