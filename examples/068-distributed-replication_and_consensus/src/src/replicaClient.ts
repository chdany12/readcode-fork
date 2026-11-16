export interface TicketRecord {
  id: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  assigneeId: string | null;
  version: number;
  updatedAt: number;
}

export interface ReplicaClient {
  readonly nodeId: string;
  put(record: TicketRecord): Promise<boolean>;
  putIfNewer(record: TicketRecord): Promise<boolean>;
  get(id: string): Promise<TicketRecord | null>;
}

export class HttpReplicaClient implements ReplicaClient {
  constructor(readonly nodeId: string, private readonly baseUrl: string) {}

  async put(record: TicketRecord): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/tickets/${encodeURIComponent(record.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
    });
    return res.ok;
  }

  async putIfNewer(record: TicketRecord): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/tickets/${encodeURIComponent(record.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "if-version-below": String(record.version) },
      body: JSON.stringify(record),
    });
    return res.ok || res.status === 412;
  }

  async get(id: string): Promise<TicketRecord | null> {
    const res = await fetch(`${this.baseUrl}/tickets/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`replica ${this.nodeId} returned ${res.status}`);
    return (await res.json()) as TicketRecord;
  }
}
