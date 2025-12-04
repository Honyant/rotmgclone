import type { Vec2 } from '@rotmg/shared';

export class InputManager {
  private keys: Set<string> = new Set();
  private mousePosition: Vec2 = { x: 0, y: 0 };
  private mouseDown: boolean = false;
  private canvas: HTMLCanvasElement;
  private onInteract: (() => void) | null = null;
  private onPickup: (() => void) | null = null;
  private onNexus: (() => void) | null = null;
  private onAbility: (() => void) | null = null;
  private onVault: (() => void) | null = null;

  // Camera rotation
  private cameraRotation: number = 0; // radians
  private readonly ROTATION_SPEED = 2.5; // radians per second

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e) => {
      // Don't capture input when typing in chat
      if (document.activeElement?.id === 'chat-input') return;

      this.keys.add(e.key.toLowerCase());

      // Interact with portal using F key
      if (e.key.toLowerCase() === 'f') {
        this.onInteract?.();
      }

      // Pickup loot with G key
      if (e.key.toLowerCase() === 'g') {
        this.onPickup?.();
      }

      // Return to nexus with R key
      if (e.key.toLowerCase() === 'r') {
        this.onNexus?.();
      }

      // Use ability with Space bar
      if (e.key === ' ') {
        e.preventDefault();
        this.onAbility?.();
      }

      // Interact with vault chest using V key
      if (e.key.toLowerCase() === 'v') {
        this.onVault?.();
      }

      // Reset camera rotation with Z
      if (e.key.toLowerCase() === 'z') {
        this.cameraRotation = 0;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
      }
    });

    // Prevent context menu on right click
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Handle focus loss
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
  }

  getMoveDirection(): Vec2 {
    let x = 0;
    let y = 0;

    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;

    // Normalize diagonal movement
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) {
      x /= len;
      y /= len;
    }

    // Rotate movement direction by camera rotation so WASD is relative to screen
    if (this.cameraRotation !== 0) {
      const cos = Math.cos(this.cameraRotation);
      const sin = Math.sin(this.cameraRotation);
      const rotX = x * cos - y * sin;
      const rotY = x * sin + y * cos;
      x = rotX;
      y = rotY;
    }

    return { x, y };
  }

  updateCameraRotation(deltaTime: number): void {
    if (this.keys.has('q')) {
      this.cameraRotation -= this.ROTATION_SPEED * deltaTime;
    }
    if (this.keys.has('e')) {
      this.cameraRotation += this.ROTATION_SPEED * deltaTime;
    }
  }

  getCameraRotation(): number {
    return this.cameraRotation;
  }

  getAimAngle(playerScreenPos: Vec2): number {
    const dx = this.mousePosition.x - playerScreenPos.x;
    const dy = this.mousePosition.y - playerScreenPos.y;
    // Add camera rotation to aim angle so shooting is in world coordinates
    return Math.atan2(dy, dx) + this.cameraRotation;
  }

  isShooting(): boolean {
    return this.mouseDown;
  }

  isKeyDown(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  getMousePosition(): Vec2 {
    return { ...this.mousePosition };
  }

  setInteractHandler(handler: () => void): void {
    this.onInteract = handler;
  }

  setPickupHandler(handler: () => void): void {
    this.onPickup = handler;
  }

  setNexusHandler(handler: () => void): void {
    this.onNexus = handler;
  }

  setAbilityHandler(handler: () => void): void {
    this.onAbility = handler;
  }

  setVaultHandler(handler: () => void): void {
    this.onVault = handler;
  }
}
