from decimal import Decimal


class LedgerClient:
    def __init__(self, http):
        self._http = http

    async def available_balance(self, account_id: str) -> Decimal:
        body = await self._http.get_json(f"/accounts/{account_id}/balance")
        return Decimal(body["available"])

    async def post_entries(self, entries: list[dict], idempotency_key: str) -> list[str]:
        body = await self._http.post_json(
            "/entries",
            {"entries": entries},
            headers={"Idempotency-Key": idempotency_key},
        )
        return body["entry_ids"]
