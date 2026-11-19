import { TripEvent } from "./types";
import { TripSequencer } from "./tripSequencer";

export interface RawMessage {
  key: string;
  value: string;
  ack(): void;
  nack(): void;
}

export class DispatchConsumer {
  constructor(private readonly sequencer: TripSequencer, private readonly log: (msg: string) => void) {}

  async onBatch(messages: RawMessage[]): Promise<void> {
    await Promise.all(messages.map((m) => this.onMessage(m)));
  }

  private async onMessage(msg: RawMessage): Promise<void> {
    let event: TripEvent;
    try {
      event = JSON.parse(msg.value) as TripEvent;
    } catch {
      this.log(`dropping unparseable message key=${msg.key}`);
      msg.ack();
      return;
    }

    if (event.tripId !== msg.key || !Number.isInteger(event.seq) || event.seq < 1) {
      this.log(`dropping malformed trip event key=${msg.key} seq=${event.seq}`);
      msg.ack();
      return;
    }

    try {
      await this.sequencer.handle(event);
      msg.ack();
    } catch (err) {
      this.log(`trip ${event.tripId} seq ${event.seq} failed: ${(err as Error).message}`);
      msg.nack();
    }
  }
}
