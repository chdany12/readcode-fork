import { context, propagation, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("shipment-events");

export interface QueueMessage {
  body: string;
  attributes: Record<string, string>;
}

export interface QueueProducer {
  send(topic: string, msg: QueueMessage): Promise<void>;
}

export interface ScanEvent {
  trackingNumber: string;
  facilityCode: string;
  status: "ARRIVED" | "DEPARTED" | "OUT_FOR_DELIVERY" | "DELIVERED";
  scannedAt: string;
}

export async function publishScan(producer: QueueProducer, evt: ScanEvent): Promise<void> {
  await tracer.startActiveSpan(
    "shipment.scans publish",
    {
      kind: SpanKind.PRODUCER,
      attributes: {
        "messaging.destination.name": "shipment.scans",
        "shipment.facility": evt.facilityCode,
        "shipment.status": evt.status,
      },
    },
    async (span) => {
      try {
        const attributes: Record<string, string> = { "content-type": "application/json" };
        propagation.inject(context.active(), attributes);
        await producer.send("shipment.scans", { body: JSON.stringify(evt), attributes });
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}
