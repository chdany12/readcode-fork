export interface ReviewQueue {
  enqueue(paymentId: string, reason: string): Promise<void>;
}

export class SqsReviewQueue implements ReviewQueue {
  constructor(
    private readonly send: (body: string, dedupId: string) => Promise<void>,
  ) {}

  async enqueue(paymentId: string, reason: string): Promise<void> {
    await this.send(JSON.stringify({ paymentId, reason, at: new Date().toISOString() }), paymentId);
  }
}
