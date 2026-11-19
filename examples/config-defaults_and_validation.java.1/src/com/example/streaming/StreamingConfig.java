package com.example.streaming;

import java.time.Duration;
import java.util.List;

public record StreamingConfig(
        int segmentSeconds,
        int startBitrateKbps,
        int maxBitrateKbps,
        int maxConcurrentPerAccount,
        Duration sessionIdleTimeout,
        List<String> allowedRegions) {

    public static final int DEFAULT_SEGMENT_SECONDS = 4;
    public static final int DEFAULT_START_BITRATE_KBPS = 1500;
    public static final int DEFAULT_MAX_BITRATE_KBPS = 8000;
    public static final int DEFAULT_MAX_CONCURRENT = 3;
    public static final int DEFAULT_IDLE_TIMEOUT_SECONDS = 300;
    public static final String DEFAULT_REGIONS = "us,eu";

    public StreamingConfig {
        allowedRegions = List.copyOf(allowedRegions);
    }
}
