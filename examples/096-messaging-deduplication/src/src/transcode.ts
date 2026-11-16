export interface TranscodeJob {
  assetId: string;
  renditionProfile: "1080p" | "720p" | "480p" | "audio";
  sourceUri: string;
  requestedAt: string;
}

export interface RenditionOutput {
  uri: string;
  durationMs: number;
  bytes: number;
}

export interface TranscodeService {
  run(job: TranscodeJob): Promise<RenditionOutput>;
  publishRendition(assetId: string, profile: string, output: RenditionOutput): Promise<void>;
  markFailed(assetId: string, profile: string): Promise<void>;
}
