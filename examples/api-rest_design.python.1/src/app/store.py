import itertools
import threading

from .models import Campaign, CampaignCreate, CampaignStatus


class CampaignStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ids = itertools.count(1)
        self._rows: dict[int, Campaign] = {}

    def insert(self, data: CampaignCreate) -> Campaign:
        with self._lock:
            campaign = Campaign(id=next(self._ids), **data.model_dump())
            self._rows[campaign.id] = campaign
            return campaign

    def get(self, campaign_id: int) -> Campaign | None:
        with self._lock:
            return self._rows.get(campaign_id)

    def update(self, campaign_id: int, changes: dict) -> Campaign | None:
        with self._lock:
            current = self._rows.get(campaign_id)
            if current is None:
                return None
            updated = current.model_copy(update=changes)
            self._rows[campaign_id] = updated
            return updated

    def search(
        self, status: CampaignStatus | None, limit: int, offset: int
    ) -> tuple[list[Campaign], int]:
        with self._lock:
            rows = [c for c in self._rows.values() if status is None or c.status == status]
        rows.sort(key=lambda c: c.id)
        return rows[offset : offset + limit], len(rows)
