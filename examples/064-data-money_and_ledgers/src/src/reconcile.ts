import { CarrierInvoiceLine } from "./invoiceParser";

export interface QuotedShipment {
  trackingNumber: string;
  quotedCents: number;
  currency: string;
}

export interface ShipmentRepo {
  findQuotes(trackingNumbers: string[]): Promise<Map<string, QuotedShipment>>;
}

export type Discrepancy =
  | { kind: "unknown_shipment"; trackingNumber: string; chargeCents: number }
  | { kind: "currency_mismatch"; trackingNumber: string; invoice: string; quote: string }
  | { kind: "overcharge"; trackingNumber: string; deltaCents: number };

export interface ReconciliationResult {
  totalBilledCents: number;
  totalExpectedCents: number;
  disputableCents: number;
  discrepancies: Discrepancy[];
}

export async function reconcile(
  lines: CarrierInvoiceLine[],
  repo: ShipmentRepo,
  toleranceCents: number,
): Promise<ReconciliationResult> {
  const quotes = await repo.findQuotes([...new Set(lines.map((l) => l.trackingNumber))]);
  const result: ReconciliationResult = {
    totalBilledCents: 0,
    totalExpectedCents: 0,
    disputableCents: 0,
    discrepancies: [],
  };

  const billedPerShipment = new Map<string, number>();
  for (const line of lines) {
    result.totalBilledCents += line.chargeCents;
    const quote = quotes.get(line.trackingNumber);
    if (!quote) {
      result.discrepancies.push({ kind: "unknown_shipment", trackingNumber: line.trackingNumber, chargeCents: line.chargeCents });
      result.disputableCents += line.chargeCents;
      continue;
    }
    if (quote.currency !== line.currency) {
      result.discrepancies.push({ kind: "currency_mismatch", trackingNumber: line.trackingNumber, invoice: line.currency, quote: quote.currency });
      continue;
    }
    billedPerShipment.set(line.trackingNumber, (billedPerShipment.get(line.trackingNumber) ?? 0) + line.chargeCents);
  }

  for (const [tracking, billed] of billedPerShipment) {
    const quote = quotes.get(tracking)!;
    result.totalExpectedCents += quote.quotedCents;
    const delta = billed - quote.quotedCents;
    if (delta > toleranceCents) {
      result.discrepancies.push({ kind: "overcharge", trackingNumber: tracking, deltaCents: delta });
      result.disputableCents += delta;
    }
  }
  return result;
}
