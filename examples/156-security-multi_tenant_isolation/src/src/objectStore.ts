export interface ObjectHead {
  size: number;
  contentType: string;
}

export interface TranscodeJob {
  tenantId: string;
  videoId: string;
  objectKey: string;
}

export interface ObjectStore {
  presignPut(key: string, expiresAt: Date): Promise<string>;
  head(key: string): Promise<ObjectHead | null>;
  enqueueTranscode(job: TranscodeJob): Promise<void>;
}
