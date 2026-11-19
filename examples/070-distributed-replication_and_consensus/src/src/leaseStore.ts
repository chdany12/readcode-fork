export interface AcquireResult {
  acquired: boolean;
  fencingToken: number;
}

export interface LeaseStore {
  tryAcquire(name: string, holderId: string, ttlMs: number): Promise<AcquireResult>;
  release(name: string, holderId: string, fencingToken: number): Promise<void>;
}
