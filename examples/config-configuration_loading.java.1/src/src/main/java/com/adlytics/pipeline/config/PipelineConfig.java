package com.adlytics.pipeline.config;

import java.net.URI;
import java.time.Duration;

public record PipelineConfig(
        int batchSize,
        Duration flushInterval,
        int workerThreads,
        boolean dedupeEnabled,
        boolean piiHashingEnabled,
        URI sinkUrl) {}
