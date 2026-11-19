import { Ticket, Priority, TicketStore, Notifier } from "./types";

const TARGET_MINUTES: Record<Priority, number> = {
  urgent: 30,
  high: 120,
  normal: 480,
  low: 1440,
};

export interface SweepStats {
  scanned: number;
  breached: number;
  notified: number;
  durationMs: number;
}

export class SlaSweeper {
  constructor(
    private readonly store: TicketStore,
    private readonly notifier: Notifier,
    private readonly now: () => number = Date.now,
  ) {}

  async sweep(): Promise<SweepStats> {
    const started = this.now();
    const open = await this.store.listOpenTickets();
    const alreadyEscalated = await this.store.listEscalatedTicketIds();
    const onShift = new Set(await this.store.listOnShiftAgentIds());

    const toNotify: Ticket[] = [];
    let breached = 0;

    for (const t of open) {
      if (!this.isBreached(t)) continue;
      breached++;
      if (alreadyEscalated.includes(t.id)) continue;
      if (t.assigneeId && onShift.has(t.assigneeId)) {
        toNotify.push(t);
      } else {
        toNotify.push({ ...t, assigneeId: null });
      }
    }

    let notified = 0;
    for (const batch of chunk(toNotify, 200)) {
      await this.notifier.escalate(batch);
      await this.store.markEscalated(batch.map((t) => t.id));
      notified += batch.length;
    }

    return {
      scanned: open.length,
      breached,
      notified,
      durationMs: this.now() - started,
    };
  }

  private isBreached(t: Ticket): boolean {
    if (t.firstResponseAt !== null) return false;
    const limitMs = TARGET_MINUTES[t.priority] * 60_000;
    const paused = t.pausedMs ?? 0;
    return this.now() - t.createdAt - paused > limitMs;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
