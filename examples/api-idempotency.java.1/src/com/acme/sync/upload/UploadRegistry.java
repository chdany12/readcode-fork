package com.acme.sync.upload;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class UploadRegistry {

    public enum State { PENDING, COMMITTED }

    public record Entry(State state, String fileId, Instant createdAt) {}

    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();
    private final Duration retention;

    public UploadRegistry(Duration retention) {
        this.retention = retention;
    }

    /** Returns empty if this caller claimed the key, otherwise the existing entry. */
    public Optional<Entry> claim(String key) {
        Entry fresh = new Entry(State.PENDING, null, Instant.now());
        Entry prior = entries.merge(key, fresh, (old, neu) ->
            Instant.now().isAfter(old.createdAt().plus(retention)) ? neu : old);
        return prior == fresh ? Optional.empty() : Optional.of(prior);
    }

    public void commit(String key, String fileId) {
        entries.computeIfPresent(key, (k, e) -> new Entry(State.COMMITTED, fileId, e.createdAt()));
    }

    public void release(String key) {
        entries.remove(key);
    }
}
