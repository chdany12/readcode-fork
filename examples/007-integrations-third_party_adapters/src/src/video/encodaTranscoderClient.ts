export type TranscodeState = "pending" | "processing" | "complete" | "errored";

export interface TranscodeJob {
  jobId: string;
  state: TranscodeState;
  renditions: Array<{ height: number; bitrateKbps: number; playlistUrl: string }>;
  errorMessage?: string;
}

interface EncodaJobPayload {
  id: string;
  status: "QUEUED" | "IN_PROGRESS" | "FINISHED" | "FAILED";
  outputs?: Array<{ height: number; video_bitrate: number; hls_url: string }>;
  failure_reason?: string;
}

export class TranscoderError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "TranscoderError";
  }
}

export class EncodaTranscoderClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 10_000,
  ) {}

  async submit(assetId: string, sourceUrl: string, ladder: number[]): Promise<string> {
    const res = await this.request("/v1/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": `asset-${assetId}` },
      body: JSON.stringify({
        input: sourceUrl,
        outputs: ladder.map((height) => ({ format: "hls", height })),
        metadata: { asset_id: assetId },
      }),
    });
    const body = (await res.json()) as EncodaJobPayload;
    return body.id;
  }

  async getJob(jobId: string): Promise<TranscodeJob> {
    const res = await fetch(`${this.baseUrl}/v1/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    await this.assertOk(res);
    return toJob((await res.json()) as EncodaJobPayload);
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new TranscoderError(`encoda request failed: ${(err as Error).message}`, true);
    }
    await this.assertOk(res);
    return res;
  }

  private async assertOk(res: Response): Promise<void> {
    if (res.ok) return;
    const text = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    throw new TranscoderError(`encoda http ${res.status}: ${text.slice(0, 200)}`, retryable);
  }
}

function toJob(p: EncodaJobPayload): TranscodeJob {
  const stateMap: Record<EncodaJobPayload["status"], TranscodeState> = {
    QUEUED: "pending",
    IN_PROGRESS: "processing",
    FINISHED: "complete",
    FAILED: "errored",
  };
  return {
    jobId: p.id,
    state: stateMap[p.status] ?? "processing",
    renditions: (p.outputs ?? []).map((o) => ({
      height: o.height,
      bitrateKbps: Math.round(o.video_bitrate / 1000),
      playlistUrl: o.hls_url,
    })),
    errorMessage: p.failure_reason,
  };
}
