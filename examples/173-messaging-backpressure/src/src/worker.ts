import { ReservationConsumer, PartitionSource, InventoryClient, OrderPlacedEvent } from "./reservationConsumer";

export function startReservationWorker(
  source: PartitionSource,
  inventory: InventoryClient,
  deadLetter: (evt: OrderPlacedEvent, reason: string) => Promise<void>,
): ReservationConsumer {
  const consumer = new ReservationConsumer(
    source,
    inventory,
    { maxInFlight: 64, resumeBelow: 16 },
    async (evt, err) => {
      const reason = err instanceof Error ? err.message : String(err);
      await deadLetter(evt, reason);
    },
  );
  consumer.start();
  return consumer;
}
