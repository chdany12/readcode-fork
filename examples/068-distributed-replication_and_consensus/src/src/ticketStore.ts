import { ReplicaClient, TicketRecord } from "./replicaClient";

export class QuorumError extends Error {
  constructor(message: string, readonly acks: number, readonly required: number) {
    super(message);
  }
}

export class TicketStore {
  private readonly writeQuorum: number;
  private readonly readQuorum: number;

  constructor(private readonly replicas: ReplicaClient[], private readonly timeoutMs = 800) {
    if (replicas.length < 3) {
      throw new Error("TicketStore requires at least 3 replicas");
    }
    const writeQuorum = Math.floor(this.replicas.length / 2);
    this.writeQuorum = writeQuorum;
    this.readQuorum = Math.floor(this.replicas.length / 2) + 1;
  }

  async save(ticket: TicketRecord): Promise<void> {
    const versioned: TicketRecord = { ...ticket, version: ticket.version + 1, updatedAt: Date.now() };
    const results = await Promise.allSettled(
      this.replicas.map((r) => withTimeout(r.put(versioned), this.timeoutMs)),
    );
    const acks = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
    if (acks < this.writeQuorum) {
      throw new QuorumError(`write for ticket ${ticket.id} reached ${acks} replicas`, acks, this.writeQuorum);
    }
  }

  async load(ticketId: string): Promise<TicketRecord | null> {
    const results = await Promise.allSettled(
      this.replicas.map((r) => withTimeout(r.get(ticketId), this.timeoutMs)),
    );
    const responses: (TicketRecord | null)[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") responses.push(r.value);
    }
    if (responses.length < this.readQuorum) {
      throw new QuorumError(`read for ticket ${ticketId} reached ${responses.length} replicas`, responses.length, this.readQuorum);
    }
    let newest: TicketRecord | null = null;
    for (const rec of responses) {
      if (rec && (!newest || rec.version > newest.version)) newest = rec;
    }
    if (newest) void this.repair(newest, responses);
    return newest;
  }

  private async repair(newest: TicketRecord, seen: (TicketRecord | null)[]): Promise<void> {
    const stale = seen.some((r) => !r || r.version < newest.version);
    if (!stale) return;
    await Promise.allSettled(this.replicas.map((r) => r.putIfNewer(newest)));
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`replica timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}
