export interface IndexedFile {
  workspaceId: string;
  path: string;
  revision: number;
  contentHash: string;
  size: number;
  deleted?: boolean;
}

export interface MetadataIndex {
  get(workspaceId: string, path: string): Promise<IndexedFile | null>;
  upsert(file: IndexedFile): Promise<void>;
  markDeleted(workspaceId: string, path: string, revision: number): Promise<void>;
}

export interface BlobStore {
  has(contentHash: string): Promise<boolean>;
  scheduleGc(contentHash: string): Promise<void>;
}
