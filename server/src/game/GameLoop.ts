import { Instance } from '../instances/Instance.js';

export class GameLoop {
  private instances: Map<string, Instance> = new Map();
  private tickRate: number;
  private tickInterval: number;
  private lastTick: number = 0;
  private running: boolean = false;
  private tick: number = 0;

  constructor(tickRate: number = 20) {
    this.tickRate = tickRate;
    this.tickInterval = 1000 / tickRate;
  }

  addInstance(instance: Instance): void {
    this.instances.set(instance.id, instance);
  }

  removeInstance(instanceId: string): void {
    this.instances.delete(instanceId);
  }

  getInstance(instanceId: string): Instance | undefined {
    return this.instances.get(instanceId);
  }

  getAllInstances(): Instance[] {
    return Array.from(this.instances.values());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTick = Date.now();
    this.gameLoop();
    console.log(`Game loop started at ${this.tickRate} ticks/second`);
  }

  stop(): void {
    this.running = false;
    console.log('Game loop stopped');
  }

  private gameLoop(): void {
    if (!this.running) return;

    const now = Date.now();
    const elapsed = now - this.lastTick;

    if (elapsed >= this.tickInterval) {
      const deltaTime = elapsed / 1000; // Convert to seconds
      this.tick++;
      this.lastTick = now - (elapsed % this.tickInterval);

      // Update all instances
      for (const instance of this.instances.values()) {
        instance.update(deltaTime, this.tick);
      }
    }

    // Schedule next frame
    setImmediate(() => this.gameLoop());
  }

  getTick(): number {
    return this.tick;
  }

  getTickRate(): number {
    return this.tickRate;
  }
}
