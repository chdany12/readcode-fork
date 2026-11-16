import { randomUUID } from "crypto";
import { Logger, rootLogger } from "./logger";

export interface BookingRequest {
  userId: string;
  tripId: string;
  supplier: "air" | "hotel" | "car";
  amountCents: number;
}

export interface SupplierClient {
  reserve(tripId: string, amountCents: number): Promise<{ confirmation: string }>;
}

export class BookingHandler {
  constructor(
    private readonly suppliers: Record<BookingRequest["supplier"], SupplierClient>,
    private readonly log: Logger = rootLogger,
  ) {}

  async handle(req: BookingRequest, headers: Record<string, string | undefined>) {
    const requestId = headers["x-request-id"] ?? randomUUID();
    const log = this.log.child({
      requestId,
      userId: req.userId,
      tripId: req.tripId,
      supplier: req.supplier,
    });

    const started = Date.now();
    log.info("booking.started", { amountCents: req.amountCents });

    try {
      const { confirmation } = await this.suppliers[req.supplier].reserve(
        req.tripId,
        req.amountCents,
      );
      log.info("booking.confirmed", {
        confirmation,
        durationMs: Date.now() - started,
      });
      return { status: 201, body: { confirmation, requestId } };
    } catch (err) {
      log.error("booking.failed", err, { durationMs: Date.now() - started });
      return { status: 502, body: { error: "supplier_unavailable", requestId } };
    }
  }
}
