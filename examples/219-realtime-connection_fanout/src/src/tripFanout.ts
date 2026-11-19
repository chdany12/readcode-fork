import { WebSocket } from "ws";
import { randomUUID } from "crypto";

export interface DriverPosition {
  tripId: string;
  driverId: string;
  lat: number;
  lng: number;
  heading: number;
  recordedAt: number;
}

interface Client {
  id: string;
  socket: WebSocket;
  riderId: string;
  trips: Set<string>;
}

const MAX_BUFFERED_BYTES = 256 * 1024;

export class TripFanout {
  private clients = new Map<string, Client>();
  private subscribers = new Map<string, Set<string>>();
  private dropped = 0;

  register(socket: WebSocket, riderId: string): string {
    const client: Client = { id: randomUUID(), socket, riderId, trips: new Set() };
    this.clients.set(client.id, client);
    socket.on("close", () => this.clients.delete(client.id));
    socket.on("error", () => socket.terminate());
    return client.id;
  }

  subscribe(clientId: string, tripId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.trips.add(tripId);
    let set = this.subscribers.get(tripId);
    if (!set) {
      set = new Set();
      this.subscribers.set(tripId, set);
    }
    set.add(clientId);
  }

  unsubscribe(clientId: string, tripId: string): void {
    this.clients.get(clientId)?.trips.delete(tripId);
    const set = this.subscribers.get(tripId);
    if (!set) return;
    set.delete(clientId);
    if (set.size === 0) this.subscribers.delete(tripId);
  }

  endTrip(tripId: string): void {
    const set = this.subscribers.get(tripId);
    if (!set) return;
    for (const clientId of set) this.clients.get(clientId)?.trips.delete(tripId);
    this.subscribers.delete(tripId);
  }

  publish(pos: DriverPosition): number {
    const set = this.subscribers.get(pos.tripId);
    if (!set) return 0;
    const frame = JSON.stringify({ type: "driver_position", ...pos });
    let delivered = 0;
    for (const clientId of set) {
      const client = this.clients.get(clientId);
      if (!client) continue;
      if (client.socket.readyState !== WebSocket.OPEN) continue;
      if (client.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
        this.dropped++;
        continue;
      }
      client.socket.send(frame);
      delivered++;
    }
    return delivered;
  }

  stats() {
    let subscriptions = 0;
    for (const set of this.subscribers.values()) subscriptions += set.size;
    return { clients: this.clients.size, trips: this.subscribers.size, subscriptions, dropped: this.dropped };
  }
}
