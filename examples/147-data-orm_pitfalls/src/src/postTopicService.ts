import { DataSource, In } from "typeorm";
import { Post, Topic } from "./entities";

export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}

const MAX_TOPICS = 5;

export class PostTopicService {
  constructor(private readonly ds: DataSource) {}

  async listVisibleTopics(postId: number): Promise<string[]> {
    const post = await this.ds.getRepository(Post).findOne({
      where: { id: postId },
      relations: { topics: true },
    });
    if (!post) throw new NotFoundError(`post ${postId}`);
    return post.topics.filter((t) => !t.archived).map((t) => t.slug);
  }

  async addTopics(postId: number, actorId: string, slugs: string[]): Promise<string[]> {
    return this.ds.transaction(async (em) => {
      const post = await em.getRepository(Post).findOne({
        where: { id: postId, topics: { archived: false } },
        relations: { topics: true },
        lock: { mode: "pessimistic_write", tables: ["posts"] },
      });
      if (!post) throw new NotFoundError(`post ${postId}`);
      if (post.authorId !== actorId) throw new ForbiddenError("only the author can tag a post");

      const wanted = [...new Set(slugs.map((s) => s.trim().toLowerCase()))].filter(Boolean);
      const found = await em.getRepository(Topic).findBy({ slug: In(wanted), archived: false });
      const existing = new Set(post.topics.map((t) => t.id));
      for (const t of found) {
        if (!existing.has(t.id)) post.topics.push(t);
      }
      if (post.topics.length > MAX_TOPICS) {
        throw new Error(`a post can have at most ${MAX_TOPICS} active topics`);
      }
      await em.getRepository(Post).save(post);
      return post.topics.map((t) => t.slug);
    });
  }
}
