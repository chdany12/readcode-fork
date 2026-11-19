import { ClickEvent, QueueMessage, SeenStore, SpendLedger } from "./types";

const DEDUP_TTL_SECONDS = 48 * 3600;

export class InvalidClickError extends Error {}

export function parseClick(raw: string): ClickEvent {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new InvalidClickError("click payload is not JSON");
  }
  if (typeof data.clickId !== "string" || data.clickId.length === 0) {
    throw new InvalidClickError("missing clickId");
  }
  if (!Number.isInteger(data.costMicros) || data.costMicros < 0) {
    throw new InvalidClickError(`bad costMicros for ${data.clickId}`);
  }
  return {
    clickId: data.clickId,
    campaignId: String(data.campaignId),
    advertiserId: String(data.advertiserId),
    costMicros: data.costMicros,
    occurredAt: String(data.occurredAt),
  };
}

export type Outcome = "billed" | "duplicate" | "rejected";

export class ClickBillingHandler {
  constructor(
    private readonly seen: SeenStore,
    private readonly ledger: SpendLedger,
    private readonly metrics: { increment(name: string, tags?: Record<string, string>): void },
  ) {}

  async handle(msg: QueueMessage): Promise<Outcome> {
    let click: ClickEvent;
    try {
      click = parseClick(msg.body);
    } catch (err) {
      if (err instanceof InvalidClickError) {
        this.metrics.increment("clicks.rejected");
        return "rejected";
      }
      throw err;
    }

    const key = `click:${click.clickId}:${msg.receivedAt}`;
    const isNew = await this.seen.markIfNew(key, DEDUP_TTL_SECONDS);
    if (!isNew) {
      this.metrics.increment("clicks.duplicate", { campaign: click.campaignId });
      return "duplicate";
    }

    try {
      await this.ledger.addSpend(click.advertiserId, click.campaignId, click.costMicros, click.occurredAt);
    } catch (err) {
      await this.seen.forget(key);
      throw err;
    }

    this.metrics.increment("clicks.billed", { campaign: click.campaignId });
    return "billed";
  }
}
