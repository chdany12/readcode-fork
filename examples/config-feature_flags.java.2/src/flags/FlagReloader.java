package io.fleetsense.flags;

import java.io.IOException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class FlagReloader {
    private static final Logger LOG = Logger.getLogger(FlagReloader.class.getName());

    private final RolloutFlags flags;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor();

    public FlagReloader(RolloutFlags flags) {
        this.flags = flags;
    }

    public void start(long periodSeconds) {
        timer.scheduleWithFixedDelay(this::tick, 0, periodSeconds, TimeUnit.SECONDS);
    }

    private void tick() {
        try {
            if (flags.reloadIfChanged()) {
                LOG.info("flag file reloaded");
            }
        } catch (IOException | RuntimeException e) {
            LOG.log(Level.WARNING, "flag reload failed, previous rules stay active", e);
        }
    }

    public void stop() {
        timer.shutdown();
    }
}
