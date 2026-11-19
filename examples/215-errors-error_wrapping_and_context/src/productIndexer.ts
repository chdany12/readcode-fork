import { IndexingError, SearchClusterError } from "./errors";

export interface ProductDoc { id: string; title: string; body: string; categoryId: string; }

export interface SearchClient {
  bulk(index: string, ops: object[]): Promise<{ status: number; body: any }>;
}

export interface CatalogStore {
  loadBatch(ids: string[]): Promise<ProductDoc[]>;
}

export class ProductIndexer {
  constructor(
    private readonly search: SearchClient,
    private readonly catalog: CatalogStore,
    private readonly indexName: string,
  ) {}

  async indexBatch(batchId: string, ids: string[]): Promise<number> {
    let docs: ProductDoc[];
    try {
      docs = await this.catalog.loadBatch(ids);
    } catch (err) {
      throw new IndexingError(
        `loading batch ${batchId} from catalog`,
        { batchId, size: ids.length },
        { cause: err },
      );
    }

    const ops = docs.flatMap((d) => [
      { index: { _index: this.indexName, _id: d.id } },
      { title: d.title, body: d.body, category_id: d.categoryId },
    ]);

    try {
      const res = await this.search.bulk(this.indexName, ops);
      if (res.status >= 300 || res.body?.errors) {
        throw new SearchClusterError(`bulk request rejected for index ${this.indexName}`, res.status);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new IndexingError(
        `writing batch ${batchId} to ${this.indexName}: ${reason}`,
        { batchId, size: docs.length, index: this.indexName },
      );
    }
    return docs.length;
  }
}
