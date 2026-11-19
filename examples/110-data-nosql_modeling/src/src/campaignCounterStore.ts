import {
  DynamoDBDocumentClient,
  UpdateCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.AD_COUNTERS_TABLE ?? "ad-counters";
export const SHARD_COUNT = 16;

export type Metric = "impressions" | "clicks" | "spendMicros";

function dayKey(ts: Date): string {
  return ts.toISOString().slice(0, 10);
}

function shardPk(campaignId: string, day: string, shard: number): string {
  return `CAMP#${campaignId}#D#${day}#S#${shard}`;
}

export class CampaignCounterStore {
  constructor(private readonly db: DynamoDBDocumentClient) {}

  async record(campaignId: string, at: Date, deltas: Partial<Record<Metric, number>>): Promise<void> {
    const shard = Math.floor(Math.random() * SHARD_COUNT);
    const names: Record<string, string> = {};
    const values: Record<string, number> = {};
    const parts: string[] = [];
    for (const [metric, delta] of Object.entries(deltas)) {
      if (!delta) continue;
      names[`#${metric}`] = metric;
      values[`:${metric}`] = delta;
      parts.push(`#${metric} :${metric}`);
    }
    if (parts.length === 0) return;
    await this.db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { pk: shardPk(campaignId, dayKey(at), shard), sk: "TOTALS" },
        UpdateExpression: `ADD ${parts.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }

  async dailyTotals(campaignId: string, day: string): Promise<Record<Metric, number>> {
    const keys = [];
    for (let s = 1; s < SHARD_COUNT; s++) {
      keys.push({ pk: shardPk(campaignId, day, s), sk: "TOTALS" });
    }
    const totals: Record<Metric, number> = { impressions: 0, clicks: 0, spendMicros: 0 };
    let request: Record<string, any> | undefined = { [TABLE]: { Keys: keys } };
    let attempts = 0;
    while (request && Object.keys(request).length > 0 && attempts < 5) {
      const out = await this.db.send(new BatchGetCommand({ RequestItems: request }));
      for (const item of out.Responses?.[TABLE] ?? []) {
        totals.impressions += item.impressions ?? 0;
        totals.clicks += item.clicks ?? 0;
        totals.spendMicros += item.spendMicros ?? 0;
      }
      request = out.UnprocessedKeys;
      attempts++;
    }
    if (request && Object.keys(request).length > 0) {
      throw new Error(`incomplete counter read for ${campaignId} on ${day}`);
    }
    return totals;
  }
}
