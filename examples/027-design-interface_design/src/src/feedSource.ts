export interface FeedItem {
  id: string;
  authorId: string;
  createdAt: number;
  kind: "post" | "repost" | "ad";
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

export interface FeedSource {
  readonly key: string;
  fetchPage(viewerId: string, cursor: string | null, limit: number): Promise<FeedPage>;
}

export function compareFeedItems(a: FeedItem, b: FeedItem): number {
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
