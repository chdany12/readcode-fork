import { GameFlags } from "./gameFlags";

export interface QueuedPlayer {
  playerId: string;
  rating: number;
  region: string;
  queuedAt: number;
}

export interface Match {
  players: string[];
  algorithm: "legacy" | "skill_v2";
}

const TEAM_SIZE = 4;

export class Matchmaker {
  constructor(private readonly flags: GameFlags) {}

  formMatches(queue: QueuedPlayer[], now: number): Match[] {
    const useSkillV2 = this.flags.isOn("matchmaking_skill_v2");
    const byRegion = new Map<string, QueuedPlayer[]>();
    for (const p of queue) {
      const list = byRegion.get(p.region) ?? [];
      list.push(p);
      byRegion.set(p.region, list);
    }

    const matches: Match[] = [];
    for (const players of byRegion.values()) {
      const ordered = useSkillV2
        ? this.orderBySkill(players, now)
        : [...players].sort((a, b) => a.queuedAt - b.queuedAt);
      for (let i = 0; i + TEAM_SIZE <= ordered.length; i += TEAM_SIZE) {
        matches.push({
          players: ordered.slice(i, i + TEAM_SIZE).map((p) => p.playerId),
          algorithm: useSkillV2 ? "skill_v2" : "legacy",
        });
      }
    }
    return matches;
  }

  private orderBySkill(players: QueuedPlayer[], now: number): QueuedPlayer[] {
    return [...players].sort((a, b) => {
      const waitBonusA = Math.min((now - a.queuedAt) / 1000, 300);
      const waitBonusB = Math.min((now - b.queuedAt) / 1000, 300);
      return a.rating - waitBonusA - (b.rating - waitBonusB);
    });
  }
}
