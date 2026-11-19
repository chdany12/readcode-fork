package com.example.streaming;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Properties;

public final class ConfigLoader {
    private static final int MIN_BITRATE_KBPS = 235;
    private static final Duration MIN_IDLE_TIMEOUT = Duration.ofSeconds(30);

    private ConfigLoader() {}

    public static StreamingConfig load(Properties props) {
        int segment = intOrDefault(props, "stream.segmentSeconds",
                StreamingConfig.DEFAULT_SEGMENT_SECONDS);
        if (segment < 2 || segment > 10) {
            throw new ConfigException("stream.segmentSeconds must be 2..10, got " + segment);
        }

        Integer start = optionalInt(props, "stream.startBitrateKbps");
        Integer max = optionalInt(props, "stream.maxBitrateKbps");
        if (start != null && max != null && start > max) {
            throw new ConfigException("stream.startBitrateKbps exceeds stream.maxBitrateKbps");
        }
        int startBitrate = start != null ? start : StreamingConfig.DEFAULT_START_BITRATE_KBPS;
        int maxBitrate = max != null ? max : StreamingConfig.DEFAULT_MAX_BITRATE_KBPS;
        if (startBitrate < MIN_BITRATE_KBPS) {
            throw new ConfigException("stream.startBitrateKbps below " + MIN_BITRATE_KBPS);
        }

        int concurrent = intOrDefault(props, "stream.maxConcurrentPerAccount",
                StreamingConfig.DEFAULT_MAX_CONCURRENT);
        if (concurrent < 1) {
            throw new ConfigException("stream.maxConcurrentPerAccount must be at least 1");
        }

        Duration idle = Duration.ofSeconds(intOrDefault(props, "stream.idleTimeoutSeconds",
                StreamingConfig.DEFAULT_IDLE_TIMEOUT_SECONDS));
        if (idle.compareTo(MIN_IDLE_TIMEOUT) < 0) {
            throw new ConfigException("stream.idleTimeoutSeconds must be at least 30");
        }

        List<String> regions = parseRegions(
                props.getProperty("stream.allowedRegions", StreamingConfig.DEFAULT_REGIONS));

        return new StreamingConfig(segment, startBitrate, maxBitrate, concurrent, idle, regions);
    }

    private static Integer optionalInt(Properties props, String key) {
        String raw = props.getProperty(key);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(raw.trim());
        } catch (NumberFormatException e) {
            throw new ConfigException(key + " is not an integer: '" + raw + "'", e);
        }
    }

    private static int intOrDefault(Properties props, String key, int fallback) {
        Integer value = optionalInt(props, key);
        return value != null ? value : fallback;
    }

    private static List<String> parseRegions(String raw) {
        List<String> regions = Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .distinct()
                .toList();
        if (regions.isEmpty()) {
            throw new ConfigException("stream.allowedRegions must list at least one region");
        }
        return regions;
    }
}
