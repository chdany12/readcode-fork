package com.example.streaming;

public final class PlaybackPlanner {
    private final StreamingConfig config;

    public PlaybackPlanner(StreamingConfig config) {
        this.config = config;
    }

    public boolean admit(String region, int activeStreamsForAccount) {
        return config.allowedRegions().contains(region.toLowerCase())
                && activeStreamsForAccount < config.maxConcurrentPerAccount();
    }

    public int initialBitrateKbps(int measuredBandwidthKbps) {
        if (measuredBandwidthKbps <= 0) {
            return config.startBitrateKbps();
        }
        int usable = (int) (measuredBandwidthKbps * 0.8);
        return Math.max(config.startBitrateKbps() / 2, Math.min(usable, config.maxBitrateKbps()));
    }

    public int segmentsToBuffer(int bufferTargetSeconds) {
        return (bufferTargetSeconds + config.segmentSeconds() - 1) / config.segmentSeconds();
    }
}
