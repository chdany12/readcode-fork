export interface MatchEvent {
  matchId: string;
  seq: number;
  payload: { type: string; playerId: string; data: unknown };
}

export interface LogEntry {
  term: number;
  index: number;
  event: MatchEvent;
}

export interface AppendRequest {
  term: number;
  leaderId: string;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: LogEntry[];
  leaderCommit: number;
}

export interface AppendResponse {
  term: number;
  success: boolean;
  matchIndex: number;
}

export interface PersistentState {
  save(state: { currentTerm: number; votedFor: string | null; log: LogEntry[] }): Promise<void>;
}

export class MatchStateReplica {
  currentTerm = 0;
  votedFor: string | null = null;
  leaderId: string | null = null;
  log: LogEntry[] = [];
  commitIndex = 0;
  lastApplied = 0;
  private electionDeadline = 0;

  constructor(
    readonly nodeId: string,
    private readonly storage: PersistentState,
    private readonly apply: (event: MatchEvent) => void,
    private readonly electionTimeoutMs: () => number,
  ) {
    this.resetElectionTimer();
  }

  private termAt(index: number): number {
    if (index === 0) return 0;
    return this.log[index - 1]?.term ?? -1;
  }

  private resetElectionTimer(): void {
    this.electionDeadline = Date.now() + this.electionTimeoutMs();
  }

  electionDue(now: number): boolean {
    return this.leaderId !== this.nodeId && now >= this.electionDeadline;
  }

  async handleAppend(req: AppendRequest): Promise<AppendResponse> {
    if (req.term > this.currentTerm) {
      this.currentTerm = req.term;
      this.votedFor = null;
    }
    this.leaderId = req.leaderId;
    this.resetElectionTimer();

    if (this.termAt(req.prevLogIndex) !== req.prevLogTerm) {
      return { term: this.currentTerm, success: false, matchIndex: 0 };
    }

    let changed = false;
    for (const entry of req.entries) {
      const existingTerm = this.termAt(entry.index);
      if (existingTerm !== -1 && existingTerm !== entry.term) {
        this.log.length = entry.index - 1;
      }
      if (this.log.length < entry.index) {
        this.log.push(entry);
        changed = true;
      }
    }
    if (changed || req.term !== this.currentTerm) {
      await this.storage.save({ currentTerm: this.currentTerm, votedFor: this.votedFor, log: this.log });
    }

    const lastNew = req.prevLogIndex + req.entries.length;
    if (req.leaderCommit > this.commitIndex) {
      this.commitIndex = Math.min(req.leaderCommit, lastNew);
    }
    this.applyCommitted();
    return { term: this.currentTerm, success: true, matchIndex: lastNew };
  }

  private applyCommitted(): void {
    while (this.lastApplied < this.commitIndex) {
      this.lastApplied++;
      this.apply(this.log[this.lastApplied - 1].event);
    }
  }
}
