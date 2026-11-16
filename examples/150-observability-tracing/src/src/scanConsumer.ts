import { context, propagation, ROOT_CONTEXT, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { QueueMessage, ScanEvent } from "./publishScan";

const tracer = trace.getTracer("shipment-events");

export interface TrackingStore {
  appendScan(evt: ScanEvent): Promise<{ firstDelivery: boolean }>;
}

export interface Notifier {
  deliveryConfirmed(trackingNumber: string): Promise<void>;
}

export class ScanConsumer {
  constructor(private readonly store: TrackingStore, private readonly notifier: Notifier) {}

  async handle(msg: QueueMessage): Promise<void> {
    const parent = propagation.extract(ROOT_CONTEXT, msg.attributes);

    await context.with(parent, () =>
      tracer.startActiveSpan(
        "shipment.scans process",
        { kind: SpanKind.CONSUMER, attributes: { "messaging.destination.name": "shipment.scans" } },
        async (span) => {
          try {
            const evt = JSON.parse(msg.body) as ScanEvent;
            span.setAttribute("shipment.status", evt.status);

            const { firstDelivery } = await this.store.appendScan(evt);
            if (evt.status === "DELIVERED" && firstDelivery) {
              await tracer.startActiveSpan("notify.delivery_confirmed", async (child) => {
                try {
                  await this.notifier.deliveryConfirmed(evt.trackingNumber);
                } catch (err) {
                  child.recordException(err as Error);
                  child.setStatus({ code: SpanStatusCode.ERROR });
                } finally {
                  child.end();
                }
              });
            }
          } catch (err) {
            span.recordException(err as Error);
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw err;
          } finally {
            span.end();
          }
        },
      ),
    );
  }
}
