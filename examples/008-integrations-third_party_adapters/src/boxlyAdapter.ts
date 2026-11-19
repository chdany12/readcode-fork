import { ChangePage, ProviderError, RemoteEntry, StorageProvider } from "./types";

interface BoxlyChange {
  file_path: string;
  byte_size: number;
  content_hash: string;
  modified_unix: number;
  tombstone?: boolean;
}

interface BoxlyChangesResponse {
  changes: BoxlyChange[];
  cursor: string;
  has_more: boolean;
}

export interface BoxlyConfig {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

export class BoxlyAdapter implements StorageProvider {
  constructor(
    private readonly config: BoxlyConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async listChanges(cursor: string | null): Promise<ChangePage> {
    const url = new URL("/v2/changes", this.config.baseUrl);
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await this.request(url);
    const body = (await res.json()) as BoxlyChangesResponse;

    return {
      entries: body.changes.map((c) => this.toEntry(c)),
      nextCursor: body.has_more ? body.cursor : null,
    };
  }

  async download(path: string): Promise<ReadableStream<Uint8Array>> {
    const url = new URL("/v2/content", this.config.baseUrl);
    url.searchParams.set("path", path);

    const res = await this.request(url);
    if (!res.body) {
      throw new ProviderError(`empty body for ${path}`, res.status, true);
    }
    return res.body;
  }

  private toEntry(c: BoxlyChange): RemoteEntry {
    return {
      path: c.file_path.startsWith("/") ? c.file_path : `/${c.file_path}`,
      size: c.byte_size,
      checksum: c.content_hash.toLowerCase(),
      modifiedAt: new Date(c.modified_unix),
      deleted: c.tombstone === true,
    };
  }

  private async request(url: URL): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${this.config.token}` },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (err) {
      throw new ProviderError(
        `boxly request to ${url.pathname} failed: ${(err as Error).message}`,
        0,
        true,
      );
    }

    if (res.ok) return res;

    const retryable = res.status === 429 || res.status >= 500;
    const detail = await res.text().catch(() => "");
    throw new ProviderError(
      `boxly ${url.pathname} returned ${res.status}: ${detail.slice(0, 200)}`,
      res.status,
      retryable,
    );
  }
}
