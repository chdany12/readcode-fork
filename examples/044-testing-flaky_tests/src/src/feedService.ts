export interface Post {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export interface FollowGraph {
  followeesOf(userId: string): Promise<string[]>;
}

export class FeedService {
  private postsByAuthor = new Map<string, Post[]>();
  private seq = 0;

  constructor(
    private readonly follows: FollowGraph,
    private readonly clock: Clock = systemClock,
  ) {}

  publish(authorId: string, text: string): Post {
    if (text.trim().length === 0) {
      throw new Error("empty post");
    }
    const post: Post = {
      id: `p_${++this.seq}`,
      authorId,
      text,
      createdAt: this.clock.now(),
    };
    const list = this.postsByAuthor.get(authorId) ?? [];
    list.push(post);
    this.postsByAuthor.set(authorId, list);
    return post;
  }

  async homeFeed(userId: string, limit = 20): Promise<Post[]> {
    const followees = await this.follows.followeesOf(userId);
    const candidates: Post[] = [];
    for (const id of [userId, ...followees]) {
      candidates.push(...(this.postsByAuthor.get(id) ?? []));
    }
    candidates.sort((a, b) => b.createdAt - a.createdAt);
    return candidates.slice(0, limit);
  }
}
