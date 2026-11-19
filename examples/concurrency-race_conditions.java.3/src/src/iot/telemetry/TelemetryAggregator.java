package iot.telemetry;

import java.time.Clock;
import java.util.OptionalDouble;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public class TelemetryAggregator {
    private static final long BUCKET_MS = 60_000L;

    static final class Bucket {
        final long startMs;
        final AtomicLong sumMilli = new AtomicLong();
        final AtomicLong count = new AtomicLong();

        Bucket(long startMs) {
            this.startMs = startMs;
        }
    }

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final Clock clock;

    public TelemetryAggregator(Clock clock) {
        this.clock = clock;
    }

    private static long bucketStart(long timestampMs) {
        return timestampMs - (timestampMs % BUCKET_MS);
    }

    private static String key(String deviceId, long bucketStartMs) {
        return deviceId + "@" + bucketStartMs;
    }

    public void record(String deviceId, long milliDegrees, long timestampMs) {
        long start = bucketStart(timestampMs);
        Bucket bucket = buckets.computeIfAbsent(key(deviceId, start), k -> new Bucket(start));
        bucket.sumMilli.addAndGet(milliDegrees);
        bucket.count.incrementAndGet();
    }

    public OptionalDouble average(String deviceId, long timestampMs) {
        Bucket bucket = buckets.get(key(deviceId, bucketStart(timestampMs)));
        if (bucket == null) {
            return OptionalDouble.empty();
        }
        long n = bucket.count.get();
        long total = bucket.sumMilli.get();
        if (n == 0) {
            return OptionalDouble.empty();
        }
        return OptionalDouble.of(total / (double) n / 1000.0);
    }

    public int evictOlderThan(long retentionMs) {
        long cutoff = clock.millis() - retentionMs;
        int before = buckets.size();
        buckets.values().removeIf(b -> b.startMs < cutoff);
        return before - buckets.size();
    }
}
