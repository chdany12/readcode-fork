import { LogEntry, PayrollLog } from "./payrollLog";

export interface AppendEntriesRequest {
  term: number;
  leaderId: string;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: LogEntry[];
  leaderCommit: number;
}

export interface AppendEntriesResponse {
  term: number;
  success: boolean;
  matchIndex: number;
}

type Role = "follower" | "candidate" | "leader";

export class PayrollReplica {
  private role: Role = "follower";
  private currentTerm = 0;
  private votedFor: string | null = null;
  private leaderId: string | null = null;
  private commitIndex = 0;
  private lastHeartbeat = Date.now();

  constructor(
    readonly nodeId: string,
    private readonly log: PayrollLog,
    private readonly applyPayrollRun: (entry: LogEntry) => Promise<void>,
  ) {}

  async handleAppendEntries(req: AppendEntriesRequest): Promise<AppendEntriesResponse> {
    if (req.term > this.currentTerm) {
      this.currentTerm = req.term;
      this.votedFor = null;
    }
    this.role = "follower";
    this.leaderId = req.leaderId;
    this.lastHeartbeat = Date.now();

    const prev = this.log.entryAt(req.prevLogIndex);
    if (req.prevLogIndex > 0 && (!prev || prev.term !== req.prevLogTerm)) {
      return { term: this.currentTerm, success: false, matchIndex: 0 };
    }

    let index = req.prevLogIndex;
    for (const entry of req.entries) {
      index += 1;
      const existing = this.log.entryAt(index);
      if (existing && existing.term !== entry.term) {
        this.log.truncateFrom(index);
      }
      if (!this.log.entryAt(index)) {
        this.log.append(entry);
      }
    }

    if (req.leaderCommit > this.commitIndex) {
      this.commitIndex = Math.min(req.leaderCommit, index);
      await this.applyCommitted();
    }
    return { term: this.currentTerm, success: true, matchIndex: index };
  }

  handleRequestVote(term: number, candidateId: string, lastLogIndex: number, lastLogTerm: number) {
    if (term < this.currentTerm) return { term: this.currentTerm, voteGranted: false };
    if (term > this.currentTerm) {
      this.currentTerm = term;
      this.votedFor = null;
      this.role = "follower";
    }
    const myLast = this.log.lastEntry();
    const upToDate =
      lastLogTerm > (myLast?.term ?? 0) ||
      (lastLogTerm === (myLast?.term ?? 0) && lastLogIndex >= this.log.lastIndex());
    const canVote = this.votedFor === null || this.votedFor === candidateId;
    if (canVote && upToDate) {
      this.votedFor = candidateId;
      this.lastHeartbeat = Date.now();
      return { term: this.currentTerm, voteGranted: true };
    }
    return { term: this.currentTerm, voteGranted: false };
  }

  private async applyCommitted(): Promise<void> {
    while (this.log.lastApplied < this.commitIndex) {
      const next = this.log.entryAt(this.log.lastApplied + 1);
      if (!next) break;
      await this.applyPayrollRun(next);
      this.log.lastApplied += 1;
    }
  }

  electionTimedOut(timeoutMs: number): boolean {
    return this.role !== "leader" && Date.now() - this.lastHeartbeat > timeoutMs;
  }
}
