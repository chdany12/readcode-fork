import { Db, ObjectId } from "mongodb";
import { ListingIndexRepo } from "./listingIndexRepo";

interface SellerUpdatedEvent {
  type: "seller.updated";
  sellerId: string;
}
interface ListingUpsertedEvent {
  type: "listing.upserted";
  listing: { id: string; title: string; priceCents: number; category: string; sellerId: string };
}
type IndexEvent = SellerUpdatedEvent | ListingUpsertedEvent;

export function makeIndexHandler(db: Db) {
  const repo = new ListingIndexRepo(db);
  return async function handle(event: IndexEvent): Promise<void> {
    switch (event.type) {
      case "seller.updated":
        await repo.onSellerProfileChanged(new ObjectId(event.sellerId));
        return;
      case "listing.upserted":
        await repo.indexListing({
          id: new ObjectId(event.listing.id),
          title: event.listing.title,
          priceCents: event.listing.priceCents,
          category: event.listing.category,
          sellerId: new ObjectId(event.listing.sellerId),
        });
        return;
    }
  };
}
