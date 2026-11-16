import { Collection, Db, ObjectId } from "mongodb";

export interface SellerDoc {
  _id: ObjectId;
  displayName: string;
  rating: number;
  region: string;
}

export interface ListingSearchDoc {
  _id: ObjectId;
  title: string;
  keywords: string[];
  priceCents: number;
  category: string;
  seller: { id: ObjectId; displayName: string; rating: number };
  indexedAt: Date;
}

export class ListingIndexRepo {
  private readonly listings: Collection<ListingSearchDoc>;
  private readonly sellers: Collection<SellerDoc>;

  constructor(db: Db) {
    this.listings = db.collection<ListingSearchDoc>("listing_search");
    this.sellers = db.collection<SellerDoc>("sellers");
  }

  async ensureIndexes(): Promise<void> {
    await this.listings.createIndex({ category: 1, priceCents: 1 });
    await this.listings.createIndex({ keywords: 1 });
    await this.listings.createIndex({ "seller.id": 1 });
  }

  async indexListing(input: {
    id: ObjectId;
    title: string;
    priceCents: number;
    category: string;
    sellerId: ObjectId;
  }): Promise<void> {
    const seller = await this.sellers.findOne({ _id: input.sellerId });
    if (!seller) throw new Error(`seller ${input.sellerId.toHexString()} not found`);
    const doc: ListingSearchDoc = {
      _id: input.id,
      title: input.title,
      keywords: tokenize(input.title),
      priceCents: input.priceCents,
      category: input.category,
      seller: { id: seller._id, displayName: seller.displayName, rating: seller.rating },
      indexedAt: new Date(),
    };
    await this.listings.replaceOne({ _id: input.id }, doc, { upsert: true });
  }

  async onSellerProfileChanged(sellerId: ObjectId): Promise<void> {
    const seller = await this.sellers.findOne({ _id: sellerId });
    if (!seller) return;
    await this.listings.updateOne(
      { "seller.id": sellerId },
      {
        $set: {
          "seller.displayName": seller.displayName,
          "seller.rating": seller.rating,
          indexedAt: new Date(),
        },
      },
    );
  }

  async search(q: string, category: string, maxPriceCents: number, limit = 25) {
    const terms = tokenize(q);
    return this.listings
      .find({ category, priceCents: { $lte: maxPriceCents }, keywords: { $all: terms } })
      .sort({ priceCents: 1, _id: 1 })
      .limit(Math.min(limit, 100))
      .project({ title: 1, priceCents: 1, "seller.displayName": 1, "seller.rating": 1 })
      .toArray();
  }
}

export function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 1),
    ),
  );
}
