import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

interface CachedSecret {
  value: string;
  fetchedAt: number;
}

export class SecretStore {
  private cache = new Map<string, CachedSecret>();
  private inflight = new Map<string, Promise<string>>();

  constructor(
    private readonly client: SecretsManagerClient,
    private readonly ttlMs: number = 5 * 60_000,
  ) {}

  async get(secretId: string): Promise<string> {
    const hit = this.cache.get(secretId);
    if (hit && Date.now() - hit.fetchedAt < this.ttlMs) return hit.value;

    const pending = this.inflight.get(secretId);
    if (pending) return pending;

    const p = this.fetch(secretId).finally(() => this.inflight.delete(secretId));
    this.inflight.set(secretId, p);
    return p;
  }

  invalidate(secretId: string): void {
    this.cache.delete(secretId);
  }

  private async fetch(secretId: string): Promise<string> {
    const out = await this.client.send(new GetSecretValueCommand({ SecretId: secretId }));
    if (!out.SecretString) {
      throw new Error(`secret ${secretId} has no string value`);
    }
    this.cache.set(secretId, { value: out.SecretString, fetchedAt: Date.now() });
    return out.SecretString;
  }
}
