from settings import Settings


class Parcel:
    def __init__(self, parcel_id, warehouse, weight_kg):
        self.parcel_id = parcel_id
        self.warehouse = warehouse
        self.weight_kg = weight_kg


def accept(settings: Settings, parcel: Parcel) -> bool:
    if parcel.warehouse.upper() not in settings.warehouse_codes:
        return False
    return settings.min_parcel_kg <= parcel.weight_kg <= settings.max_parcel_kg


def build_batches(settings: Settings, parcels):
    by_warehouse = {}
    rejected = []
    for parcel in parcels:
        if accept(settings, parcel):
            by_warehouse.setdefault(parcel.warehouse.upper(), []).append(parcel)
        else:
            rejected.append(parcel.parcel_id)

    batches = []
    for code in sorted(by_warehouse):
        items = by_warehouse[code]
        for i in range(0, len(items), settings.batch_size):
            batches.append((code, items[i:i + settings.batch_size]))
    return batches, rejected
