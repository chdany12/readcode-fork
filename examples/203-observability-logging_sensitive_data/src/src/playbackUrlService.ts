import { createHmac } from "node:crypto";
import pino from "pino";
import { redact, maskViewer } from "./redact";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

export interface PlaybackRequest {
  viewerId: string;
  assetId: string;
  rendition: "720p" | "1080p" | "4k";
  region: string;
}

export interface CdnClient {
  headManifest(url: string): Promise<{ status: number }>;
}

export class PlaybackUrlService {
  constructor(
    private readonly cdnBase: string,
    private readonly signingKey: string,
    private readonly cdn: CdnClient,
    private readonly ttlSeconds = 300,
  ) {}

  private sign(path: string, expires: number): string {
    return createHmac("sha256", this.signingKey).update(`${path}:${expires}`).digest("hex");
  }

  buildSignedUrl(req: PlaybackRequest, now = Date.now()): { url: string; expires: number } {
    const path = `/vod/${req.assetId}/${req.rendition}/master.m3u8`;
    const expires = Math.floor(now / 1000) + this.ttlSeconds;
    const sig = this.sign(path, expires);
    const url = `${this.cdnBase}${path}?expires=${expires}&sig=${sig}&vid=${encodeURIComponent(req.viewerId)}`;
    return { url, expires };
  }

  async issue(req: PlaybackRequest): Promise<{ url: string; expires: number }> {
    const log = logger.child({ viewer: maskViewer(req.viewerId), asset: req.assetId });
    const signed = this.buildSignedUrl(req);

    log.info(redact({ rendition: req.rendition, region: req.region, expires: signed.expires }), "playback url issued");

    try {
      const probe = await this.cdn.headManifest(signed.url);
      if (probe.status >= 400) {
        log.warn(
          redact({ status: probe.status, manifestUrl: signed.url, region: req.region }),
          "manifest probe failed",
        );
        throw new Error(`manifest unavailable (${probe.status})`);
      }
    } catch (err) {
      log.error(redact({ err: (err as Error).message, region: req.region }), "playback issue failed");
      throw err;
    }

    return signed;
  }
}
