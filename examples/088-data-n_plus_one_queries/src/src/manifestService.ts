import { ManifestRepository, StopRow } from "./manifestRepository";

export interface ManifestLine {
  trackingNumber: string;
  carrier: string;
  weightKg: number;
  route: string[];
  firstStopAt: Date | null;
}

export interface CarrierManifest {
  carrier: string;
  cutoffHourUtc: number;
  lines: ManifestLine[];
  totalWeightKg: number;
}

export class ManifestService {
  constructor(private readonly repo: ManifestRepository) {}

  async buildDailyManifest(depotId: string, shipDate: string): Promise<CarrierManifest[]> {
    const shipments = await this.repo.shipmentsForDepot(depotId, shipDate);
    const carrierCodes = [...new Set(shipments.map((s) => s.carrierCode))];
    const carriers = await this.repo.carriersByCode(carrierCodes);

    const grouped = new Map<string, CarrierManifest>();
    for (const shipment of shipments) {
      const carrier = carriers.get(shipment.carrierCode);
      if (!carrier) {
        throw new Error(`unknown carrier ${shipment.carrierCode} on shipment ${shipment.id}`);
      }
      const stops: StopRow[] = await this.repo.stopsForShipment(shipment.id);
      const line: ManifestLine = {
        trackingNumber: shipment.trackingNumber,
        carrier: carrier.displayName,
        weightKg: shipment.weightGrams / 1000,
        route: stops.map((s) => s.facilityCode),
        firstStopAt: stops.length > 0 ? stops[0].scheduledAt : null,
      };
      const manifest = grouped.get(carrier.code) ?? {
        carrier: carrier.displayName,
        cutoffHourUtc: carrier.cutoffHourUtc,
        lines: [],
        totalWeightKg: 0,
      };
      manifest.lines.push(line);
      manifest.totalWeightKg += line.weightKg;
      grouped.set(carrier.code, manifest);
    }
    return [...grouped.values()];
  }
}
