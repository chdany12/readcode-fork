import redis

DAILY_BONUS_COINS = 250
CLAIM_WINDOW_SECONDS = 24 * 60 * 60

_SPEND_SCRIPT = """
local balance = tonumber(redis.call('HGET', KEYS[1], 'coins') or '0')
local cost = tonumber(ARGV[1])
if balance < cost then
    return -1
end
return redis.call('HINCRBY', KEYS[1], 'coins', -cost)
"""


class InsufficientCoins(Exception):
    pass


class PlayerWallet:
    def __init__(self, client: redis.Redis):
        self._r = client
        self._spend = client.register_script(_SPEND_SCRIPT)

    @staticmethod
    def _profile_key(player_id: str) -> str:
        return f"player:{player_id}:profile"

    def claim_daily_bonus(self, player_id: str) -> bool:
        claimed = self._r.set(
            f"player:{player_id}:daily_claim", "1", nx=True, ex=CLAIM_WINDOW_SECONDS
        )
        if not claimed:
            return False
        self._r.hincrby(self._profile_key(player_id), "coins", DAILY_BONUS_COINS)
        return True

    def spend(self, player_id: str, cost: int) -> int:
        if cost <= 0:
            raise ValueError("cost must be positive")
        remaining = self._spend(keys=[self._profile_key(player_id)], args=[cost])
        if remaining < 0:
            raise InsufficientCoins(player_id)
        return int(remaining)

    def balance(self, player_id: str) -> int:
        return int(self._r.hget(self._profile_key(player_id), "coins") or 0)
