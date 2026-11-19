package com.streamly.manifest;

import java.io.IOException;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;

public class ManifestRefresher {

    private static final Logger LOG = Logger.getLogger(ManifestRefresher.class.getName());

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "manifest-refresh");
        t.setDaemon(true);
        return t;
    });

    private final ConcurrentMap<String, Manifest> manifests = new ConcurrentHashMap<>();
    private final StreamCatalog catalog;
    private final OriginClient origin;
    private final ManifestParser parser;

    public ManifestRefresher(StreamCatalog catalog, OriginClient origin, ManifestParser parser) {
        this.catalog = catalog;
        this.origin = origin;
        this.parser = parser;
    }

    public void start(Duration interval) {
        scheduler.scheduleWithFixedDelay(this::refreshAll, 0, interval.toSeconds(), TimeUnit.SECONDS);
    }

    public Optional<Manifest> current(String streamId) {
        return Optional.ofNullable(manifests.get(streamId));
    }

    void refreshAll() {
        for (String streamId : catalog.liveStreamIds()) {
            try {
                String raw = origin.fetch(streamId);
                manifests.put(streamId, parser.parse(streamId, raw));
            } catch (IOException e) {
                LOG.log(Level.WARNING, "manifest refresh failed for " + streamId + ", keeping previous version", e);
            }
        }
    }

    public void stop() throws InterruptedException {
        scheduler.shutdown();
        if (!scheduler.awaitTermination(10, TimeUnit.SECONDS)) {
            LOG.warning("manifest refresher did not stop within 10s");
        }
    }
}
