export interface BookingRow {
  booking_ref: string;
  traveller_name: string;
  departs_at: Date;
  origin: string;
  destination: string;
  fare_cents: number;
  currency: string;
}

export const CSV_HEADER = "booking_ref,traveller_name,departs_at,origin,destination,fare,currency\n";

function escape(field: string): string {
  if (/[",\n\r]/.test(field)) return `"${field.replace(/"/g, '""')}"`;
  return field;
}

export function toCsvRow(r: BookingRow): string {
  const fare = (r.fare_cents / 100).toFixed(2);
  return [
    r.booking_ref,
    r.traveller_name,
    r.departs_at.toISOString(),
    r.origin,
    r.destination,
    fare,
    r.currency,
  ].map(escape).join(",") + "\n";
}
