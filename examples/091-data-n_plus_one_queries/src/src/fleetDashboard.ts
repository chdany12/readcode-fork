import { FleetRepository, Site } from "./fleetRepository";

export interface DeviceTile {
  deviceId: string;
  model: string;
  siteName: string;
  siteTimezone: string;
  online: boolean;
  temperatureC: number | null;
  lowBattery: boolean;
}

const OFFLINE_AFTER_MS = 15 * 60 * 1000;
const LOW_BATTERY_PCT = 20;

export class FleetDashboard {
  constructor(private readonly repo: FleetRepository) {}

  async tiles(accountId: string, now: Date = new Date()): Promise<DeviceTile[]> {
    const devices = await this.repo.devicesForAccount(accountId);
    const readings = await this.repo.latestReadings(devices.map((d) => d.id));
    const siteCache = new Map<string, Site | null>();

    const tiles: DeviceTile[] = [];
    for (const device of devices) {
      let site = siteCache.get(device.siteId);
      if (site === undefined) {
        site = await this.repo.siteById(device.siteId);
      }
      const reading = readings.get(device.id);
      const online =
        reading !== undefined && now.getTime() - reading.recordedAt.getTime() < OFFLINE_AFTER_MS;
      tiles.push({
        deviceId: device.id,
        model: device.model,
        siteName: site?.name ?? "Unassigned",
        siteTimezone: site?.timezone ?? "UTC",
        online,
        temperatureC: reading ? reading.temperatureC : null,
        lowBattery: reading !== undefined && reading.batteryPct < LOW_BATTERY_PCT,
      });
    }
    return tiles.sort((a, b) => Number(a.online) - Number(b.online));
  }
}
