from fastapi import APIRouter, Depends, HTTPException

from .menu_repo import MenuRepo
from .schemas import PlaceOrder

router = APIRouter(prefix="/v1/orders")


def get_menu_repo() -> MenuRepo:
    raise NotImplementedError


@router.post("", status_code=201)
def place_order(body: PlaceOrder, menu: MenuRepo = Depends(get_menu_repo)):
    restaurant = menu.get_restaurant(body.restaurant_id)
    if restaurant is None:
        raise HTTPException(status_code=404, detail="restaurant not found")
    if not restaurant.is_open:
        raise HTTPException(status_code=409, detail="restaurant is closed")

    ids = [item.menu_item_id for item in body.items]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=422, detail="each menu item may appear only once")

    prices = menu.prices_for(body.restaurant_id, ids)
    missing = [i for i in ids if i not in prices]
    if missing:
        raise HTTPException(status_code=422, detail={"unknown_items": missing})

    subtotal_cents = sum(prices[i.menu_item_id] * i.quantity for i in body.items)
    if subtotal_cents < restaurant.minimum_order_cents:
        raise HTTPException(status_code=422, detail="below the restaurant minimum order")
    if body.tip_cents > subtotal_cents // 2:
        raise HTTPException(status_code=422, detail="tip may not exceed half of the subtotal")

    order_id = menu.create_order(body.model_dump(mode="json"), subtotal_cents)
    return {"order_id": order_id, "subtotal_cents": subtotal_cents}
