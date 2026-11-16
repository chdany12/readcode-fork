import { createPool } from "./db";
import { ScanEvent, ShipmentScanRepository } from "./shipmentScanRepository";

const pool = createPool();
const repo = new ShipmentScanRepository(pool);

export interface ScanMessage {
  body: string;
  ack(): Promise<void>;
  nack(): Promise<void>;
}

function parse(body: string): ScanEvent {
  const raw = JSON.parse(body);
  if (typeof raw.trackingNumber !== "string" || typeof raw.facilityCode !== "string") {
    throw new Error("malformed scan message");
  }
  return {
    trackingNumber: raw.trackingNumber,
    facilityCode: raw.facilityCode,
    status: raw.status,
    scannedAt: new Date(raw.scannedAt),
  };
}

export async function handleScan(msg: ScanMessage): Promise<void> {
  let event: ScanEvent;
  try {
    event = parse(msg.body);
  } catch {
    await msg.ack();
    return;
  }
  try {
    await repo.recordScan(event);
    await msg.ack();
  } catch (err) {
    console.error("scan processing failed", { tracking: event.trackingNumber, err });
    await msg.nack();
  }
}

export async function shutdown(): Promise<void> {
  await pool.end();
}
