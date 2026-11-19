package search;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

public final class TtlCache<K, V> {

    private record Entry<V>(V value, Instant expiresAt) {}

    private final ConcurrentHashMap<K, Entry<V>> entries = new ConcurrentHashMap<>();
    private final Duration ttl;
    private final Clock clock;

    public TtlCache(Duration ttl, Clock clock) {
        this.ttl = ttl;
        this.clock = clock;
    }

    public V get(K key) {
        Entry<V> entry = entries.get(key);
        if (entry == null) {
            return null;
        }
        if (!clock.instant().isBefore(entry.expiresAt())) {
            entries.remove(key, entry);
            return null;
        }
        return entry.value();
    }

    public void put(K key, V value) {
        entries.put(key, new Entry<>(value, clock.instant().plus(ttl)));
    }

    public int evictExpired() {
        Instant now = clock.instant();
        int before = entries.size();
        entries.entrySet().removeIf(e -> !now.isBefore(e.getValue().expiresAt()));
        return before - entries.size();
    }

    public int size() {
        return entries.size();
    }
}
