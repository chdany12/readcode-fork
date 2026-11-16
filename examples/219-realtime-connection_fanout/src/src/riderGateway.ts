import { WebSocketServer } from "ws";
import { TripFanout, DriverPosition } from "./tripFanout";

export function startRiderGateway(port: number, fanout: TripFanout, authenticate: (token: string) => string | null) {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (socket, req) => {
    const token = new URL(req.url ?? "/", "http://localhost").searchParams.get("token") ?? "";
    const riderId = authenticate(token);
    if (!riderId) {
      socket.close(4401, "unauthorized");
      return;
    }
    const clientId = fanout.register(socket, riderId);

    socket.on("message", (raw) => {
      let msg: { op?: string; tripId?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!msg.tripId) return;
      if (msg.op === "watch") fanout.subscribe(clientId, msg.tripId);
      else if (msg.op === "unwatch") fanout.unsubscribe(clientId, msg.tripId);
    });
  });

  return {
    onDriverPosition: (pos: DriverPosition) => fanout.publish(pos),
    close: () => new Promise<void>((resolve) => wss.close(() => resolve())),
  };
}
