import { performance } from "node:perf_hooks";
import { Metrics } from "./metrics";

export interface Vec2 { x: number; y: number }

export interface PlayerState {
  id: string;
  pos: Vec2;
  vel: Vec2;
  hp: number;
  lastInputSeq: number;
}

export interface Connection {
  playerId: string;
  send(payload: string): void;
}

const TICK_MS = 50;
const VIEW_RADIUS = 600;

export class MatchLoop {
  private players = new Map<string, PlayerState>();
  private conns = new Map<string, Connection>();
  private tickNo = 0;
  private timer?: NodeJS.Timeout;

  constructor(private readonly matchId: string, private readonly metrics: Metrics) {}

  join(conn: Connection, spawn: Vec2): void {
    this.conns.set(conn.playerId, conn);
    this.players.set(conn.playerId, {
      id: conn.playerId, pos: { ...spawn }, vel: { x: 0, y: 0 }, hp: 100, lastInputSeq: 0,
    });
  }

  leave(playerId: string): void {
    this.conns.delete(playerId);
    this.players.delete(playerId);
  }

  applyInput(playerId: string, seq: number, vel: Vec2): void {
    const p = this.players.get(playerId);
    if (!p || seq <= p.lastInputSeq) return;
    p.lastInputSeq = seq;
    p.vel = vel;
  }

  start(): void {
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private tick(): void {
    const t0 = performance.now();
    this.tickNo++;
    const dt = TICK_MS / 1000;
    for (const p of this.players.values()) {
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
    }
    const t1 = performance.now();
    this.broadcast();
    const t2 = performance.now();
    this.metrics.observe("tick_simulate_ms", t1 - t0, { match: this.matchId });
    this.metrics.observe("tick_broadcast_ms", t2 - t1, { match: this.matchId });
    if (t2 - t0 > TICK_MS) {
      this.metrics.increment("tick_overrun_total", { match: this.matchId });
    }
  }

  private broadcast(): void {
    for (const [id, conn] of this.conns) {
      const self = this.players.get(id);
      if (!self) continue;
      const snapshot = this.buildSnapshot();
      const visible = snapshot.players.filter(
        (o) => o.id === id || dist2(o.pos, self.pos) <= VIEW_RADIUS * VIEW_RADIUS,
      );
      conn.send(JSON.stringify({ tick: snapshot.tick, ack: self.lastInputSeq, players: visible }));
    }
  }

  private buildSnapshot(): { tick: number; players: PlayerState[] } {
    return {
      tick: this.tickNo,
      players: [...this.players.values()]
        .map((p) => structuredClone(p))
        .sort((a, b) => a.id.localeCompare(b.id)),
    };
  }
}

function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
