export type Profile = "1080p" | "720p" | "480p";

export interface RenditionRequest {
  videoId: string;
  sourceKey: string;
  profile: Profile;
}

export interface Transcoder {
  exists(objectKey: string): Promise<boolean>;
  // Writes to a temp key and renames on completion, so outputKey is never partial.
  transcode(sourceKey: string, outputKey: string, profile: Profile): Promise<void>;
}
