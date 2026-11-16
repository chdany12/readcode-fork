import { CatalogStore, CursorStore, ProductDoc, SearchIndex, Tokenizer } from "./types";

const JOB = "catalog-reindex";

export class CatalogReindexer {
  constructor(
    private readonly catalog: CatalogStore,
    private readonly index: SearchIndex,
    private readonly cursors: CursorStore,
    private readonly tokenizer: Tokenizer,
    private readonly pageSize = 100,
  ) {}

  async runOnce(): Promise<number> {
    let cursor = await this.cursors.load(JOB);
    let total = 0;

    for (;;) {
      const page = await this.catalog.listChangedSince(cursor, this.pageSize);
      if (page.docs.length === 0) break;

      await this.indexPage(page.docs);
      total += page.docs.length;

      if (!page.nextCursor) break;
      cursor = page.nextCursor;
      await this.cursors.save(JOB, cursor);
    }

    if (total > 0) await this.index.refresh();
    return total;
  }

  private async indexPage(docs: ProductDoc[]): Promise<void> {
    docs.forEach(async (doc) => {
      const fields = await this.buildFields(doc);
      await this.index.upsert(doc.id, fields);
    });
  }

  private async buildFields(doc: ProductDoc): Promise<Record<string, unknown>> {
    const [titleTokens, descTokens] = await Promise.all([
      this.tokenizer.analyze(doc.title),
      this.tokenizer.analyze(doc.description),
    ]);
    return {
      title: doc.title,
      title_tokens: titleTokens,
      description_tokens: descTokens.slice(0, 512),
      updated_at: doc.updatedAt,
    };
  }
}
