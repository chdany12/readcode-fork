package com.loopfeed.feed;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

public class FeedWorkerPool {

    private static final Duration TRENDING_TTL = Duration.ofMinutes(2);

    private final ThreadPoolExecutor pool = new ThreadPoolExecutor(
            4, 8, 60, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(200),
            new ThreadPoolExecutor.CallerRunsPolicy());

    private final FeedRanker ranker;
    private final FeedCache cache;
    private final ProfileService profiles;

    public FeedWorkerPool(FeedRanker ranker, FeedCache cache, ProfileService profiles) {
        this.ranker = ranker;
        this.cache = cache;
        this.profiles = profiles;
    }

    public CompletableFuture<List<Post>> personalized(String viewerId, int limit) {
        return CompletableFuture.supplyAsync(() -> buildPersonalized(viewerId, limit), pool);
    }

    public CompletableFuture<List<Post>> trending(int limit) {
        return CompletableFuture.supplyAsync(() -> buildTrending(limit), pool);
    }

    private List<Post> buildPersonalized(String viewerId, int limit) {
        FeedContext.setRegion(profiles.regionOf(viewerId));
        List<Post> posts = ranker.rank(viewerId, limit);
        cache.put("feed:" + viewerId, posts, Duration.ofSeconds(30));
        FeedContext.clear();
        return posts;
    }

    private List<Post> buildTrending(int limit) {
        String region = FeedContext.regionOrDefault("global");
        String key = "trending:" + region;
        List<Post> cached = cache.get(key);
        if (cached != null) {
            return cached;
        }
        List<Post> posts = ranker.trending(region, limit);
        cache.put(key, posts, TRENDING_TTL);
        return posts;
    }

    public int queued() {
        return pool.getQueue().size();
    }
}
