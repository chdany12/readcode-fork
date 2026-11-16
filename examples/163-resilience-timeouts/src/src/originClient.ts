import { logger } from "./logger";

export interface Rendition {
  bandwidth: number;
  resolution: string;
  uri: string;
}

export interface PlaybackManifest {
  assetId: string;
  durationSec: number;
  renditions: Rendition[];
}

export class OriginTimeoutError extends Error {
  constructor(public readonly assetId: string, public readonly afterMs: number) {
    super(`origin did not respond for ${assetId} within ${afterMs}ms`);
  }
}

export class OriginClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number = 2500,
  ) {}

  async fetchManifest(assetId: string): Promise<PlaybackManifest> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const started = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/assets/${encodeURIComponent(assetId)}/manifest`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`origin returned ${res.status} for ${assetId}`);
      }
      const body = (await res.json()) as PlaybackManifest;
      logger.info("manifest fetched", { assetId, ms: Date.now() - started });
      return body;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new OriginTimeoutError(assetId, this.timeoutMs);
      }
      throw err;
    }
  }
}
