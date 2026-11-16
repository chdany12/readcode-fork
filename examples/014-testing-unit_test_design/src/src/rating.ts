export type ServiceLevel = "ground" | "express" | "overnight";

export interface Parcel {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface Shipment {
  originZone: number;
  destinationZone: number;
  serviceLevel: ServiceLevel;
  parcels: Parcel[];
  surcharges: string[];
}

const BASE_RATE_CENTS: Record<ServiceLevel, number> = { ground: 650, express: 1450, overnight: 2900 };
const PER_KG_CENTS: Record<ServiceLevel, number> = { ground: 90, express: 180, overnight: 320 };
const VOLUMETRIC_DIVISOR = 5000;
const OVERSIZE_CM = 120;

export function billableWeightKg(p: Parcel): number {
  const actualKg = p.weightGrams / 1000;
  const volumetricKg = (p.lengthCm * p.widthCm * p.heightCm) / VOLUMETRIC_DIVISOR;
  return Math.ceil(Math.max(actualKg, volumetricKg));
}

export function quoteShipment(s: Shipment): { totalCents: number; lines: string[] } {
  if (s.parcels.length === 0) throw new Error("shipment has no parcels");
  const zoneDistance = Math.abs(s.destinationZone - s.originZone);
  const zoneMultiplier = 1 + 0.15 * zoneDistance;
  const lines: string[] = [];
  let total = 0;

  for (const p of s.parcels) {
    const kg = billableWeightKg(p);
    let cents = Math.round((BASE_RATE_CENTS[s.serviceLevel] + kg * PER_KG_CENTS[s.serviceLevel]) * zoneMultiplier);
    if (Math.max(p.lengthCm, p.widthCm, p.heightCm) > OVERSIZE_CM) {
      cents += 2500;
      if (!s.surcharges.includes("oversize")) s.surcharges.push("oversize");
    }
    lines.push(`${kg}kg ${s.serviceLevel}: ${cents}`);
    total += cents;
  }
  return { totalCents: total, lines };
}
