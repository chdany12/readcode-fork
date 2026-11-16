import net from "node:net";

export interface RelayEndpoint {
  host: string;
  port: number;
}

export interface ProbeResult {
  endpoint: RelayEndpoint;
  healthy: boolean;
  rttMs?: number;
  error?: string;
}

const PING = Buffer.from("PING\n");
const PONG = "PONG";

export function probeRelay(endpoint: RelayEndpoint, timeoutMs: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.createConnection({ host: endpoint.host, port: endpoint.port });
    let received = "";
    let settled = false;

    const finish = (result: Omit<ProbeResult, "endpoint">) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeAllListeners("data");
      socket.destroy();
      resolve({ endpoint, ...result });
    };

    const timer = setTimeout(() => {
      finish({ healthy: false, error: `timeout after ${timeoutMs}ms` });
    }, timeoutMs);

    socket.setNoDelay(true);
    socket.once("connect", () => {
      socket.write(PING);
    });
    socket.on("data", (chunk: Buffer) => {
      received += chunk.toString("utf8");
      if (received.length > 64) {
        finish({ healthy: false, error: "unexpected response" });
        return;
      }
      if (received.includes("\n")) {
        const line = received.trim();
        if (line === PONG) {
          finish({ healthy: true, rttMs: Date.now() - started });
        } else {
          finish({ healthy: false, error: `unexpected response: ${line}` });
        }
      }
    });
    socket.on("error", (err) => {
      finish({ healthy: false, error: err.message });
    });
    socket.on("close", () => {
      finish({ healthy: false, error: "closed before reply" });
    });
  });
}
