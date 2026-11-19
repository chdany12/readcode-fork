from enum import Enum

from pydantic import BaseModel, Field


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    daily_budget_cents: int = Field(gt=0)
    status: CampaignStatus = CampaignStatus.DRAFT
    targeting_tags: list[str] = Field(default_factory=list, max_length=50)


class CampaignPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    daily_budget_cents: int | None = Field(default=None, gt=0)
    status: CampaignStatus | None = None
    targeting_tags: list[str] = Field(default_factory=list, max_length=50)


class Campaign(CampaignCreate):
    id: int


class CampaignList(BaseModel):
    items: list[Campaign]
    total: int
    limit: int
    offset: int
