import redis

MAX_PLAYERS = 8
SLOT_TTL_SECONDS = 900


class MatchSlots:
    """Tracks how many players have joined each open match."""

    def __init__(self, client: redis.Redis, max_players: int = MAX_PLAYERS):
        self._r = client
        self._max = max_players

    @staticmethod
    def _count_key(match_id: str) -> str:
        return f"match:{match_id}:count"

    @staticmethod
    def _roster_key(match_id: str) -> str:
        return f"match:{match_id}:roster"

    def join(self, match_id: str, player_id: str) -> bool:
        count_key = self._count_key(match_id)
        roster_key = self._roster_key(match_id)

        if not self._r.sadd(roster_key, player_id):
            return True

        count = self._r.incr(count_key)
        if count == 1:
            self._r.expire(count_key, SLOT_TTL_SECONDS)
            self._r.expire(roster_key, SLOT_TTL_SECONDS)
        if count > self._max:
            self._r.decr(count_key)
            self._r.srem(roster_key, player_id)
            return False
        return True

    def leave(self, match_id: str, player_id: str) -> None:
        count_key = self._count_key(match_id)
        if not self._r.srem(self._roster_key(match_id), player_id):
            return
        current = int(self._r.get(count_key) or 0)
        self._r.set(count_key, max(current - 1, 0), keepttl=True)

    def player_count(self, match_id: str) -> int:
        return int(self._r.get(self._count_key(match_id)) or 0)

    def roster(self, match_id: str) -> set[str]:
        return {m.decode() for m in self._r.smembers(self._roster_key(match_id))}
