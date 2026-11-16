import { OriginClient, OriginTimeoutError, PlaybackManifest } from "./originClient";
import { logger } from "./logger";

interface CachedManifest {
  manifest: PlaybackManifest;
  storedAt: number;
}

const FRESH_MS = 30_000;

export class ManifestService {
  private readonly cache = new Map<string, CachedManifest>();

  constructor(private readonly origin: OriginClient) {}

  async getManifest(assetId: string, maxBandwidth?: number): Promise<PlaybackManifest> {
    const cached = this.cache.get(assetId);
    if (cached && Date.now() - cached.storedAt < FRESH_MS) {
      return this.filter(cached.manifest, maxBandwidth);
    }

    try {
      const manifest = await this.origin.fetchManifest(assetId);
      this.cache.set(assetId, { manifest, storedAt: Date.now() });
      return this.filter(manifest, maxBandwidth);
    } catch (err) {
      if (err instanceof OriginTimeoutError && cached) {
        logger.warn("serving stale manifest after origin timeout", {
          assetId,
          ageMs: Date.now() - cached.storedAt,
        });
        return this.filter(cached.manifest, maxBandwidth);
      }
      throw err;
    }
  }

  private filter(manifest: PlaybackManifest, maxBandwidth?: number): PlaybackManifest {
    if (maxBandwidth === undefined) return manifest;
    const renditions = manifest.renditions.filter((r) => r.bandwidth <= maxBandwidth);
    return {
      ...manifest,
      renditions: renditions.length > 0 ? renditions : manifest.renditions.slice(0, 1),
    };
  }
}
