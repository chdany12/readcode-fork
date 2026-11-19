import { AuditLog } from "./auditLog";

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
}

export interface FirmwareRequest {
  principal: Principal;
  params: { deviceId: string };
  body: { firmwareVersion: string; requestedBy: string; reason?: string };
}

export interface DeviceRegistry {
  find(deviceId: string): Promise<{ id: string; tenantId: string; firmware: string } | null>;
  scheduleFirmware(deviceId: string, version: string): Promise<string>;
}

export interface HttpResult {
  status: number;
  body: unknown;
}

export class FirmwareRolloutHandler {
  constructor(
    private readonly devices: DeviceRegistry,
    private readonly audit: AuditLog,
  ) {}

  async handle(req: FirmwareRequest): Promise<HttpResult> {
    const { deviceId } = req.params;
    const { firmwareVersion, requestedBy, reason } = req.body;
    const device = await this.devices.find(deviceId);

    if (!device || device.tenantId !== req.principal.tenantId) {
      await this.audit.record({
        actor: requestedBy,
        action: "device.firmware.schedule",
        resource: deviceId,
        outcome: "denied",
        details: { firmwareVersion, cause: "not_found_or_foreign_tenant" },
      });
      return { status: 404, body: { error: "device not found" } };
    }

    if (!req.principal.roles.includes("fleet-operator")) {
      await this.audit.record({
        actor: requestedBy,
        action: "device.firmware.schedule",
        resource: deviceId,
        outcome: "denied",
        details: { firmwareVersion, cause: "missing_role" },
      });
      return { status: 403, body: { error: "forbidden" } };
    }

    try {
      const jobId = await this.devices.scheduleFirmware(deviceId, firmwareVersion);
      await this.audit.record({
        actor: requestedBy,
        action: "device.firmware.schedule",
        resource: deviceId,
        outcome: "allowed",
        details: { from: device.firmware, to: firmwareVersion, jobId, reason },
      });
      return { status: 202, body: { jobId } };
    } catch (err) {
      await this.audit.record({
        actor: requestedBy,
        action: "device.firmware.schedule",
        resource: deviceId,
        outcome: "failed",
        details: { firmwareVersion, error: (err as Error).message },
      });
      throw err;
    }
  }
}
