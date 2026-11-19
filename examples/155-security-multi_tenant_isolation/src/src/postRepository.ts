import { Pool } from "pg";

export interface Post {
  id: string;
  communityId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  hidden: boolean;
}

interface PostRow {
  id: string;
  community_id: string;
  author_id: string;
  body: string;
  created_at: Date;
  hidden: boolean;
}

function toPost(r: PostRow): Post {
  return {
    id: r.id,
    communityId: r.community_id,
    authorId: r.author_id,
    body: r.body,
    createdAt: r.created_at,
    hidden: r.hidden,
  };
}

export class PostRepository {
  constructor(private readonly db: Pool) {}

  async feed(communityId: string, before: Date, limit: number): Promise<Post[]> {
    const res = await this.db.query<PostRow>(
      `SELECT id, community_id, author_id, body, created_at, hidden
         FROM posts
        WHERE community_id = $1 AND hidden = false AND created_at < $2
        ORDER BY created_at DESC
        LIMIT $3`,
      [communityId, before, limit],
    );
    return res.rows.map(toPost);
  }

  async findById(communityId: string, postId: string): Promise<Post | null> {
    const res = await this.db.query<PostRow>(
      `SELECT id, community_id, author_id, body, created_at, hidden
         FROM posts
        WHERE id = $1 AND hidden = false`,
      [postId],
    );
    return res.rowCount ? toPost(res.rows[0]) : null;
  }

  async create(communityId: string, authorId: string, body: string): Promise<Post> {
    const res = await this.db.query<PostRow>(
      `INSERT INTO posts (community_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, community_id, author_id, body, created_at, hidden`,
      [communityId, authorId, body],
    );
    return toPost(res.rows[0]);
  }
}
