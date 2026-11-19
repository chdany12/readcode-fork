import { ModerationVerdict, SentryScanModerationAdapter } from "./sentryScanModerationAdapter";

export interface Post {
  id: string;
  authorId: string;
  text: string;
  imageUrls: string[];
}

export interface PostStore {
  setVisibility(postId: string, visibility: "public" | "pending" | "removed", labels: string[]): Promise<void>;
}

export interface ReviewQueue {
  enqueue(postId: string, reason: string[]): Promise<void>;
}

export interface FeedFanout {
  publish(post: Post): Promise<void>;
}

export class PostModerationService {
  constructor(
    private readonly moderation: SentryScanModerationAdapter,
    private readonly posts: PostStore,
    private readonly reviewQueue: ReviewQueue,
    private readonly fanout: FeedFanout,
  ) {}

  async onPostCreated(post: Post): Promise<ModerationVerdict> {
    const verdict = await this.moderation.review(post.id, post.text, post.imageUrls);

    switch (verdict.action) {
      case "publish":
        await this.posts.setVisibility(post.id, "public", verdict.labels);
        await this.fanout.publish(post);
        break;
      case "hold_for_review":
        await this.posts.setVisibility(post.id, "pending", verdict.labels);
        await this.reviewQueue.enqueue(post.id, verdict.labels);
        break;
      case "remove":
        await this.posts.setVisibility(post.id, "removed", verdict.labels);
        break;
    }
    return verdict;
  }
}
