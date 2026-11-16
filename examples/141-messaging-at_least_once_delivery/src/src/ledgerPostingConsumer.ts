import { Channel, ConsumeMessage } from "amqplib";
import { Pool } from "pg";

interface TransferPosted {
  transferId: string;
  debitAccount: string;
  creditAccount: string;
  amountMinor: number;
  currency: string;
}

export class LedgerPostingConsumer {
  constructor(private readonly channel: Channel, private readonly pool: Pool) {}

  async start(queue = "ledger.transfers"): Promise<void> {
    await this.channel.prefetch(20);
    await this.channel.consume(queue, (msg) => {
      if (msg) void this.onMessage(msg);
    }, { noAck: false });
  }

  private async onMessage(msg: ConsumeMessage): Promise<void> {
    let evt: TransferPosted;
    try {
      evt = JSON.parse(msg.content.toString());
    } catch {
      this.channel.nack(msg, false, false);
      return;
    }
    if (!Number.isInteger(evt.amountMinor) || evt.amountMinor <= 0) {
      this.channel.nack(msg, false, false);
      return;
    }

    this.channel.ack(msg);
    try {
      await this.post(evt);
    } catch (err) {
      console.error("ledger posting failed", { transferId: evt.transferId, err: String(err) });
    }
  }

  private async post(evt: TransferPosted): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const dup = await client.query(
        "INSERT INTO ledger_postings (transfer_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [evt.transferId],
      );
      if (dup.rowCount === 0) {
        await client.query("COMMIT");
        return;
      }
      const [first, second] = [evt.debitAccount, evt.creditAccount].sort();
      await client.query("SELECT id FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE", [first, second]);
      await client.query(
        `INSERT INTO ledger_entries (transfer_id, account_id, direction, amount_minor, currency)
         VALUES ($1, $2, 'debit', $4, $5), ($1, $3, 'credit', $4, $5)`,
        [evt.transferId, evt.debitAccount, evt.creditAccount, evt.amountMinor, evt.currency],
      );
      await client.query("UPDATE accounts SET balance_minor = balance_minor - $2 WHERE id = $1", [evt.debitAccount, evt.amountMinor]);
      await client.query("UPDATE accounts SET balance_minor = balance_minor + $2 WHERE id = $1", [evt.creditAccount, evt.amountMinor]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
