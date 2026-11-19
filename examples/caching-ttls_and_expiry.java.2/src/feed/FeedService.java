package feed;

import java.util.List;
import java.util.Optional;

import feed.FeedCache.FeedItem;

public class FeedService {

    static final int FANOUT_INVALIDATION_LIMIT = 5_000;

    public interface FeedBuilder {
        List<FeedItem> build(long userId, int limit);
    }

    public interface FollowerGraph {
        int followerCount(long authorId);

        List<Long> followerIds(long authorId);
    }

    private static final int PAGE_SIZE = 50;

    private final FeedBuilder builder;
    private final FollowerGraph graph;
    private final FeedCache cache;

    public FeedService(FeedBuilder builder, FollowerGraph graph, FeedCache cache) {
        this.builder = builder;
        this.graph = graph;
        this.cache = cache;
    }

    public List<FeedItem> getFeed(long userId) {
        Optional<List<FeedItem>> cached = cache.get(userId);
        if (cached.isPresent()) {
            return cached.get();
        }
        List<FeedItem> built = builder.build(userId, PAGE_SIZE);
        cache.put(userId, built);
        return built;
    }

    public void onPostPublished(long authorId) {
        if (graph.followerCount(authorId) > FANOUT_INVALIDATION_LIMIT) {
            return;
        }
        for (long followerId : graph.followerIds(authorId)) {
            cache.invalidate(followerId);
        }
    }
}
