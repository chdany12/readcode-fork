package com.loopfeed.feed;

import java.time.Duration;
import java.util.List;

record Post(String id, String authorId, double score) {}

interface FeedRanker {
    List<Post> rank(String viewerId, int limit);
    List<Post> trending(String region, int limit);
}

interface FeedCache {
    List<Post> get(String key);
    void put(String key, List<Post> posts, Duration ttl);
}

interface ProfileService {
    String regionOf(String viewerId);
}
