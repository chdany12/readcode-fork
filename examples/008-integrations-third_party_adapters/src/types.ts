export interface RemoteEntry {
  path: string;
  size: number;
  checksum: string;
  modifiedAt: Date;
  deleted: boolean;
}

export interface ChangePage {
  entries: RemoteEntry[];
  nextCursor: string | null;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface StorageProvider {
  listChanges(cursor: string | null): Promise<ChangePage>;
  download(path: string): Promise<ReadableStream<Uint8Array>>;
}
