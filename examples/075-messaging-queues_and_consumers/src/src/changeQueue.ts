export type ChangeKind = "upsert" | "delete";

export interface FileChange {
  workspaceId: string;
  path: string;
  revision: number;
  kind: ChangeKind;
  contentHash: string;
  size: number;
}

export interface ChangeEnvelope {
  leaseId: string;
  attempt: number;
  change: FileChange;
}

export interface ChangeQueue {
  pull(max: number): Promise<ChangeEnvelope[]>;
  ack(leaseId: string): Promise<void>;
  release(leaseId: string, delayMs: number): Promise<void>;
  deadLetter(leaseId: string): Promise<void>;
}
