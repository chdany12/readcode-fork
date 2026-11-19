package feed;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;

public class FeedCache {

    public record FeedItem(long postId, long authorId, Instant createdAt) {}

    private record Entry(List<FeedItem> items, Instant expiresAt) {}

    private final ConcurrentHashMap<Long, Entry> entries = new ConcurrentHashMap<>();
    private final Duration ttl;
    private final Clock clock;
    private final AtomicLong hits = new AtomicLong();
    private final AtomicLong misses = new AtomicLong();

    public FeedCache(Duration ttl, Clock clock) {
        this.ttl = ttl;
        this.clock = clock;
    }

    public Optional<List<FeedItem>> get(long userId) {
        Entry entry = entries.get(userId);
        if (entry == null) {
            misses.incrementAndGet();
            return Optional.empty();
        }
        if (entry.expiresAt().isBefore(clock.instant())) {
            misses.incrementAndGet();
            return Optional.empty();
        }
        hits.incrementAndGet();
        return Optional.of(entry.items());
    }

    public void put(long userId, List<FeedItem> items) {
        long jitterMillis = ThreadLocalRandom.current().nextLong(ttl.toMillis() / 10 + 1);
        Instant expiresAt = clock.instant().plus(ttl).plusMillis(jitterMillis);
        entries.put(userId, new Entry(List.copyOf(items), expiresAt));
    }

    public void invalidate(long userId) {
        entries.remove(userId);
    }

    public int size() {
        return entries.size();
    }

    public double hitRatio() {
        long h = hits.get();
        long total = h + misses.get();
        return total == 0 ? 0.0 : (double) h / total;
    }
}
