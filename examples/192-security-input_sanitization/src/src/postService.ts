import { normalizeLink, LinkPreview } from "./links";

export interface PostInput {
  authorId: string;
  body: string;
  links: string[];
}

export interface StoredPost {
  id: string;
  authorId: string;
  body: string;
  links: LinkPreview[];
  createdAt: string;
}

export class ValidationError extends Error {
  readonly status = 422;
}

export interface PostRepository {
  insert(post: StoredPost): Promise<void>;
}

const MAX_BODY = 5000;
const MAX_LINKS = 4;

export class PostService {
  constructor(
    private readonly repo: PostRepository,
    private readonly newId: () => string,
    private readonly now: () => Date,
  ) {}

  async create(input: PostInput): Promise<StoredPost> {
    const body = input.body.normalize("NFC").trim();
    if (body.length === 0 || body.length > MAX_BODY) {
      throw new ValidationError(`body must be 1-${MAX_BODY} characters`);
    }
    if (input.links.length > MAX_LINKS) {
      throw new ValidationError(`at most ${MAX_LINKS} links per post`);
    }

    const links: LinkPreview[] = [];
    for (const raw of input.links) {
      const link = normalizeLink(raw);
      if (!link) {
        throw new ValidationError("one of the links is not allowed");
      }
      links.push(link);
    }

    const post: StoredPost = {
      id: this.newId(),
      authorId: input.authorId,
      body,
      links,
      createdAt: this.now().toISOString(),
    };
    await this.repo.insert(post);
    return post;
  }
}
