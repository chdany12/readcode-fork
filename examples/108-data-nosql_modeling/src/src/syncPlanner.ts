import { FileVersionStore, FileVersion } from "./fileVersionStore";

export interface SyncDecision {
  action: "upload" | "download" | "noop" | "conflict";
  remote: FileVersion | null;
}

export class SyncPlanner {
  constructor(private readonly store: FileVersionStore) {}

  async plan(
    workspaceId: string,
    fileId: string,
    localBaseVersion: number,
    localChecksum: string,
    locallyModified: boolean,
  ): Promise<SyncDecision> {
    const remote = await this.store.latestVersion(workspaceId, fileId);
    if (!remote) {
      return { action: locallyModified ? "upload" : "noop", remote };
    }
    if (remote.version === localBaseVersion) {
      if (!locallyModified || remote.checksum === localChecksum) {
        return { action: "noop", remote };
      }
      return { action: "upload", remote };
    }
    if (remote.version > localBaseVersion) {
      return { action: locallyModified ? "conflict" : "download", remote };
    }
    return { action: "conflict", remote };
  }
}
