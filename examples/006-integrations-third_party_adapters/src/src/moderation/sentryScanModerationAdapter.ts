export type ModerationAction = "publish" | "hold_for_review" | "remove";

export interface ModerationVerdict {
  action: ModerationAction;
  labels: string[];
  providerRef: string | null;
}

interface SentryScanResponse {
  scan_id: string;
  decision: "ALLOW" | "FLAG" | "BLOCK" | string;
  categories: Array<{ name: string; confidence: number }>;
}

export interface ModerationConfig {
  endpoint: string;
  apiKey: string;
  timeoutMs: number;
  labelThreshold: number;
}

export class SentryScanModerationAdapter {
  constructor(private readonly cfg: ModerationConfig) {}

  async review(postId: string, text: string, imageUrls: string[]): Promise<ModerationVerdict> {
    let res: Response;
    try {
      res = await fetch(`${this.cfg.endpoint}/v3/scan`, {
        method: "POST",
        headers: { "x-api-key": this.cfg.apiKey, "content-type": "application/json" },
        body: JSON.stringify({ reference: postId, text, images: imageUrls.map((url) => ({ url })) }),
        signal: AbortSignal.timeout(this.cfg.timeoutMs),
      });
    } catch {
      return { action: "hold_for_review", labels: ["moderation_unavailable"], providerRef: null };
    }

    if (!res.ok) {
      return { action: "hold_for_review", labels: [`moderation_http_${res.status}`], providerRef: null };
    }

    const body = (await res.json()) as SentryScanResponse;
    const labels = body.categories
      .filter((c) => c.confidence >= this.cfg.labelThreshold)
      .map((c) => c.name.toLowerCase());

    return { action: this.toAction(body.decision), labels, providerRef: body.scan_id };
  }

  private toAction(decision: string): ModerationAction {
    switch (decision) {
      case "BLOCK":
        return "remove";
      case "FLAG":
        return "hold_for_review";
      case "ALLOW":
      default:
        return "publish";
    }
  }
}
