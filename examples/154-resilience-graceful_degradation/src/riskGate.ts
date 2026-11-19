import { FraudScoringClient, FraudScore } from "./fraudClient";
import { ReviewQueue } from "./reviewQueue";

export type Decision = "approve" | "decline" | "review";

export interface ChargeRequest {
  merchantId: string;
  paymentId: string;
  amountCents: number;
  currency: string;
  cardFingerprint: string;
}

export interface RiskOutcome {
  decision: Decision;
  score: number | null;
  source: "model" | "fallback";
}

export class ScoringTimeoutError extends Error {}

export interface RiskConfig {
  scoringTimeoutMs: number;
  declineAbove: number;
  reviewAbove: number;
  fallbackAutoApproveMaxCents: number;
}

export class RiskGate {
  constructor(
    private readonly scoring: FraudScoringClient,
    private readonly reviews: ReviewQueue,
    private readonly cfg: RiskConfig,
    private readonly metrics: { increment(name: string, tags?: Record<string, string>): void },
  ) {}

  async evaluate(req: ChargeRequest): Promise<RiskOutcome> {
    let score: FraudScore;
    try {
      score = await this.scoreWithDeadline(req);
    } catch (err) {
      if (err instanceof ScoringTimeoutError) {
        return this.fallback(req, "timeout");
      }
      throw err;
    }

    this.metrics.increment("risk.scored", { merchant: req.merchantId });
    if (score.value >= this.cfg.declineAbove) {
      return { decision: "decline", score: score.value, source: "model" };
    }
    if (score.value >= this.cfg.reviewAbove) {
      await this.reviews.enqueue(req.paymentId, `score ${score.value}`);
      return { decision: "review", score: score.value, source: "model" };
    }
    return { decision: "approve", score: score.value, source: "model" };
  }

  private async fallback(req: ChargeRequest, reason: string): Promise<RiskOutcome> {
    this.metrics.increment("risk.fallback", { reason });
    if (req.amountCents <= this.cfg.fallbackAutoApproveMaxCents) {
      return { decision: "approve", score: null, source: "fallback" };
    }
    await this.reviews.enqueue(req.paymentId, `scoring unavailable (${reason})`);
    return { decision: "review", score: null, source: "fallback" };
  }

  private scoreWithDeadline(req: ChargeRequest): Promise<FraudScore> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.scoringTimeoutMs);
    return this.scoring
      .score(
        { amountCents: req.amountCents, currency: req.currency, card: req.cardFingerprint },
        controller.signal,
      )
      .catch((err) => {
        if (controller.signal.aborted) throw new ScoringTimeoutError("fraud scoring timed out");
        throw err;
      })
      .finally(() => clearTimeout(timer));
  }
}
