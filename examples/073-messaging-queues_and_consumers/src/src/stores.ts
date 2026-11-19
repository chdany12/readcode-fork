export interface FollowerPage {
  userIds: string[];
  nextCursor?: string;
}

export interface TimelineEntry {
  userId: string;
  postId: string;
  authorId: string;
  publishedAt: string;
}

export interface FollowerStore {
  page(authorId: string, limit: number, cursor?: string): Promise<FollowerPage>;
}

export interface TimelineStore {
  // Upsert keyed on (userId, postId): re-inserting an existing entry is a no-op.
  insertMany(entries: TimelineEntry[]): Promise<void>;
}
