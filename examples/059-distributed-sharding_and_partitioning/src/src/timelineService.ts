import { HashRing, FeedNode } from "./hashRing";

export interface Post {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
}

export interface FeedStoreClient {
  appendPost(node: FeedNode, post: Post): Promise<void>;
  recentPosts(node: FeedNode, authorIds: string[], limit: number): Promise<Post[]>;
}

export class TimelineService {
  constructor(
    private readonly ring: HashRing,
    private readonly store: FeedStoreClient,
  ) {}

  async publish(post: Post): Promise<void> {
    const node = this.ring.locate(post.authorId);
    await this.store.appendPost(node, post);
  }

  async homeTimeline(following: string[], limit = 30): Promise<Post[]> {
    const byNode = new Map<string, { node: FeedNode; authors: string[] }>();
    for (const authorId of following) {
      const node = this.ring.locate(authorId);
      const entry = byNode.get(node.id) ?? { node, authors: [] };
      entry.authors.push(authorId);
      byNode.set(node.id, entry);
    }

    const batches = await Promise.all(
      [...byNode.values()].map(({ node, authors }) =>
        this.store.recentPosts(node, authors, limit),
      ),
    );

    return batches
      .flat()
      .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1))
      .slice(0, limit);
  }
}
