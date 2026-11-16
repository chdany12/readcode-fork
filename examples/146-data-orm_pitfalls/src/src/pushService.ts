import { DataSource, IsNull } from "typeorm";
import { Device } from "./entities";

export interface PushGateway {
  send(token: string, platform: string, payload: { title: string; body: string }): Promise<"ok" | "unregistered">;
}

export interface DirectPushRequest {
  installId?: string;
  title: string;
  body: string;
}

export class PushService {
  constructor(private readonly ds: DataSource, private readonly gateway: PushGateway) {}

  async notifyUser(userId: string, title: string, body: string): Promise<number> {
    const devices = await this.ds.getRepository(Device).find({
      where: { userId, disabledAt: IsNull() },
      order: { createdAt: "DESC" },
      take: 10,
    });
    let delivered = 0;
    for (const d of devices) {
      if (await this.deliver(d, title, body)) delivered++;
    }
    return delivered;
  }

  async notifyInstall(req: DirectPushRequest): Promise<boolean> {
    const device = await this.ds.getRepository(Device).findOneBy({
      installId: req.installId,
      disabledAt: IsNull(),
    });
    if (!device) return false;
    return this.deliver(device, req.title, req.body);
  }

  private async deliver(device: Device, title: string, body: string): Promise<boolean> {
    const result = await this.gateway.send(device.pushToken, device.platform, { title, body });
    if (result === "unregistered") {
      await this.ds.getRepository(Device).update({ id: device.id }, { disabledAt: new Date() });
      return false;
    }
    return true;
  }
}
