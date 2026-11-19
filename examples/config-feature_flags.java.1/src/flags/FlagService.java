package com.acme.iam.flags;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class FlagService implements AutoCloseable {
    private static final Logger log = LoggerFactory.getLogger(FlagService.class);

    private final FlagRepository repository;
    private final Map<String, FlagDefinition> flags = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "flag-refresh");
                t.setDaemon(true);
                return t;
            });

    public FlagService(FlagRepository repository, Duration refreshEvery) {
        this.repository = repository;
        refresh();
        long period = refreshEvery.toMillis();
        scheduler.scheduleWithFixedDelay(this::refreshQuietly, period, period, TimeUnit.MILLISECONDS);
    }

    void refresh() {
        List<FlagDefinition> fresh = repository.loadAll();
        flags.clear();
        for (FlagDefinition def : fresh) {
            flags.put(def.key(), def);
        }
    }

    private void refreshQuietly() {
        try {
            refresh();
        } catch (RuntimeException e) {
            log.warn("flag refresh failed; keeping previous flags", e);
        }
    }

    public boolean isEnabled(String key, String tenantId, String userId, boolean fallback) {
        FlagDefinition def = flags.get(key);
        if (def == null) {
            return fallback;
        }
        Boolean override = def.tenantOverrides().get(tenantId);
        if (override != null) {
            return override;
        }
        if (!def.enabled()) {
            return false;
        }
        return inRollout(def, userId);
    }

    private static boolean inRollout(FlagDefinition def, String userId) {
        int pct = def.rolloutPercent();
        if (pct >= 100) {
            return true;
        }
        if (pct <= 0) {
            return false;
        }
        int bucket = Math.floorMod((def.key() + ":" + userId).hashCode(), 100);
        return bucket < pct;
    }

    @Override
    public void close() {
        scheduler.shutdownNow();
    }
}
