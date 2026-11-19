package com.loopfeed.feed;

public final class FeedContext {

    private static final ThreadLocal<String> REGION = new ThreadLocal<>();

    private FeedContext() {}

    public static void setRegion(String region) {
        REGION.set(region);
    }

    public static String regionOrDefault(String fallback) {
        String region = REGION.get();
        return region != null ? region : fallback;
    }

    public static void clear() {
        REGION.remove();
    }
}
