package notify.prefs;

import java.time.Duration;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

public class PreferenceCache {

    public enum Channel { EMAIL, SMS, PUSH }

    public sealed interface Lookup permits Miss, Absent, Present {}

    public record Miss() implements Lookup {}

    public record Absent() implements Lookup {}

    public record Present(Set<Channel> channels) implements Lookup {}

    private static final String ABSENT_MARKER = "-";

    private final KeyValueStore store;
    private final Duration ttl;
    private final Duration absentTtl;

    public PreferenceCache(KeyValueStore store, Duration ttl, Duration absentTtl) {
        this.store = store;
        this.ttl = ttl;
        this.absentTtl = absentTtl;
    }

    public Lookup lookup(String userId) {
        Optional<String> raw = store.get(key(userId));
        if (raw.isEmpty()) {
            return new Miss();
        }
        if (raw.get().equals(ABSENT_MARKER)) {
            return new Absent();
        }
        return new Present(decode(raw.get()));
    }

    public void putPresent(String userId, Set<Channel> channels) {
        store.put(key(userId), encode(channels), ttl.toMillis());
    }

    public void putAbsent(String userId) {
        store.put(key(userId), ABSENT_MARKER, absentTtl.toSeconds());
    }

    public void evict(String userId) {
        store.delete(key(userId));
    }

    private static String key(String userId) {
        return "notify:prefs:v2:" + userId;
    }

    private static String encode(Set<Channel> channels) {
        return channels.stream().map(Enum::name).sorted().collect(Collectors.joining(","));
    }

    private static Set<Channel> decode(String raw) {
        if (raw.isBlank()) {
            return EnumSet.noneOf(Channel.class);
        }
        return Arrays.stream(raw.split(","))
                .map(Channel::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(Channel.class)));
    }
}
