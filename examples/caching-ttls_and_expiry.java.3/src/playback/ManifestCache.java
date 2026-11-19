package playback;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class ManifestCache {

    private record Entry(String manifest, Instant expiresAt) {}

    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();
    private final Clock clock;

    public ManifestCache(Clock clock) {
        this.clock = clock;
    }

    public Optional<String> get(String key) {
        Entry entry = entries.get(key);
        if (entry == null) {
            return Optional.empty();
        }
        if (!clock.instant().isBefore(entry.expiresAt())) {
            entries.remove(key, entry);
            return Optional.empty();
        }
        return Optional.of(entry.manifest());
    }

    public void put(String key, String manifest, Duration ttl) {
        entries.put(key, new Entry(manifest, clock.instant().plus(ttl)));
    }
}
