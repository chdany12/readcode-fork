from fastapi import FastAPI, HTTPException, Query, Response

from .models import Campaign, CampaignCreate, CampaignList, CampaignPatch, CampaignStatus
from .store import CampaignStore

app = FastAPI(title="campaigns")
store = CampaignStore()


@app.post("/v1/campaigns", response_model=Campaign, status_code=201)
def create_campaign(body: CampaignCreate, response: Response) -> Campaign:
    campaign = store.insert(body)
    response.headers["Location"] = f"/v1/campaigns/{campaign.id}"
    return campaign


@app.get("/v1/campaigns", response_model=CampaignList)
def list_campaigns(
    status: CampaignStatus | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> CampaignList:
    items, total = store.search(status, limit, offset)
    return CampaignList(items=items, total=total, limit=limit, offset=offset)


@app.get("/v1/campaigns/{campaign_id}", response_model=Campaign)
def get_campaign(campaign_id: int) -> Campaign:
    campaign = store.get(campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="campaign not found")
    return campaign


@app.patch("/v1/campaigns/{campaign_id}", response_model=Campaign)
def patch_campaign(campaign_id: int, body: CampaignPatch) -> Campaign:
    changes = body.model_dump(exclude_none=True)
    updated = store.update(campaign_id, changes)
    if updated is None:
        raise HTTPException(status_code=404, detail="campaign not found")
    return updated


@app.delete("/v1/campaigns/{campaign_id}", status_code=204)
def archive_campaign(campaign_id: int) -> Response:
    updated = store.update(campaign_id, {"status": CampaignStatus.ARCHIVED})
    if updated is None:
        raise HTTPException(status_code=404, detail="campaign not found")
    return Response(status_code=204)
