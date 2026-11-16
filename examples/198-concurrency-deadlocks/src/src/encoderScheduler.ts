import { Mutex } from "./mutex";

export interface EncoderNode {
  id: string;
  capacity: number;
  assigned: Set<string>;
}

export interface LiveChannel {
  id: string;
  encoderId: string | null;
  renditions: string[];
}

export interface EncoderStore {
  persistAssignment(channelId: string, encoderId: string | null): Promise<void>;
}

export class EncoderScheduler {
  private readonly channelLocks = new Map<string, Mutex>();
  private readonly encoderLocks = new Map<string, Mutex>();

  constructor(
    private readonly channels: Map<string, LiveChannel>,
    private readonly encoders: Map<string, EncoderNode>,
    private readonly store: EncoderStore,
  ) {}

  private channelLock(id: string): Mutex {
    let m = this.channelLocks.get(id);
    if (!m) {
      m = new Mutex();
      this.channelLocks.set(id, m);
    }
    return m;
  }

  private encoderLock(id: string): Mutex {
    let m = this.encoderLocks.get(id);
    if (!m) {
      m = new Mutex();
      this.encoderLocks.set(id, m);
    }
    return m;
  }

  async assign(channelId: string, encoderId: string): Promise<void> {
    await this.channelLock(channelId).runExclusive(async () => {
      await this.encoderLock(encoderId).runExclusive(async () => {
        const channel = this.mustChannel(channelId);
        const encoder = this.mustEncoder(encoderId);
        if (channel.encoderId === encoderId) return;
        if (encoder.assigned.size >= encoder.capacity) {
          throw new Error(`encoder ${encoderId} is full`);
        }
        if (channel.encoderId) {
          throw new Error(`channel ${channelId} already on ${channel.encoderId}`);
        }
        await this.store.persistAssignment(channelId, encoderId);
        encoder.assigned.add(channelId);
        channel.encoderId = encoderId;
      });
    });
  }

  async drainEncoder(encoderId: string): Promise<string[]> {
    return this.encoderLock(encoderId).runExclusive(async () => {
      const encoder = this.mustEncoder(encoderId);
      const released: string[] = [];
      for (const channelId of [...encoder.assigned]) {
        await this.channelLock(channelId).runExclusive(async () => {
          const channel = this.mustChannel(channelId);
          await this.store.persistAssignment(channelId, null);
          channel.encoderId = null;
          encoder.assigned.delete(channelId);
          released.push(channelId);
        });
      }
      return released;
    });
  }

  async updateRenditions(channelId: string, renditions: string[]): Promise<void> {
    await this.channelLock(channelId).runExclusive(async () => {
      const channel = this.mustChannel(channelId);
      channel.renditions = [...renditions];
    });
  }

  private mustChannel(id: string): LiveChannel {
    const c = this.channels.get(id);
    if (!c) throw new Error(`unknown channel ${id}`);
    return c;
  }

  private mustEncoder(id: string): EncoderNode {
    const e = this.encoders.get(id);
    if (!e) throw new Error(`unknown encoder ${id}`);
    return e;
  }
}
