package iot.telemetry;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

public class TelemetryIngest implements AutoCloseable {
    private static final long RETENTION_MS = 3 * 60 * 60 * 1000L;

    private final TelemetryAggregator aggregator;
    private final ScheduledExecutorService sweeper = Executors.newSingleThreadScheduledExecutor();
    private final AtomicLong dropped = new AtomicLong();

    public TelemetryIngest(TelemetryAggregator aggregator) {
        this.aggregator = aggregator;
        sweeper.scheduleAtFixedRate(
                () -> aggregator.evictOlderThan(RETENTION_MS), 1, 1, TimeUnit.MINUTES);
    }

    /** Called from MQTT client threads. Payload format: deviceId,milliDegrees,timestampMs */
    public void onMessage(String payload) {
        String[] parts = payload.split(",");
        if (parts.length != 3 || parts[0].isBlank()) {
            dropped.incrementAndGet();
            return;
        }
        try {
            long milli = Long.parseLong(parts[1].trim());
            long ts = Long.parseLong(parts[2].trim());
            aggregator.record(parts[0].trim(), milli, ts);
        } catch (NumberFormatException e) {
            dropped.incrementAndGet();
        }
    }

    public long droppedCount() {
        return dropped.get();
    }

    @Override
    public void close() {
        sweeper.shutdown();
    }
}
