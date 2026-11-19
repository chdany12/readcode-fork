package search;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

public class SearchService {

    public record Hit(String documentId, String title, double score) {}

    public record Document(String id, String title, String body) {}

    public interface SearchIndex {
        List<Hit> search(String tenantId, String query, int limit);

        void upsert(String tenantId, Document document);
    }

    static final class GenerationRegistry {
        private final ConcurrentHashMap<String, AtomicLong> generations = new ConcurrentHashMap<>();

        long current(String tenantId) {
            AtomicLong g = generations.get(tenantId);
            return g == null ? 0L : g.get();
        }

        long bump(String tenantId) {
            return generations.computeIfAbsent(tenantId, t -> new AtomicLong()).incrementAndGet();
        }
    }

    private final SearchIndex index;
    private final GenerationRegistry generations = new GenerationRegistry();
    private final TtlCache<String, List<Hit>> cache;
    private final ScheduledExecutorService sweeper =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "search-cache-sweeper");
                t.setDaemon(true);
                return t;
            });

    public SearchService(SearchIndex index, Clock clock) {
        this.index = index;
        this.cache = new TtlCache<>(Duration.ofMinutes(10), clock);
        this.sweeper.scheduleWithFixedDelay(cache::evictExpired, 1, 1, TimeUnit.MINUTES);
    }

    public List<Hit> search(String tenantId, String query, int limit) {
        long observed = generations.current(tenantId);
        List<Hit> cached = cache.get(cacheKey(tenantId, observed, query, limit));
        if (cached != null) {
            return cached;
        }

        List<Hit> hits = List.copyOf(index.search(tenantId, query, limit));

        long generation = generations.current(tenantId);
        cache.put(cacheKey(tenantId, generation, query, limit), hits);
        return hits;
    }

    public void indexDocument(String tenantId, Document document) {
        index.upsert(tenantId, document);
        generations.bump(tenantId);
    }

    public void shutdown() {
        sweeper.shutdownNow();
    }

    private static String cacheKey(String tenantId, long generation, String query, int limit) {
        return tenantId + '|' + generation + '|' + limit + '|' + query.strip().toLowerCase();
    }
}
