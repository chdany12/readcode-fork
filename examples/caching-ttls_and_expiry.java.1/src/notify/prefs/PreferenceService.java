package notify.prefs;

import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;

import notify.prefs.PreferenceCache.Absent;
import notify.prefs.PreferenceCache.Channel;
import notify.prefs.PreferenceCache.Lookup;
import notify.prefs.PreferenceCache.Present;

public class PreferenceService {

    public interface PreferenceRepository {
        Optional<Set<Channel>> findByUserId(String userId);

        void save(String userId, Set<Channel> channels);
    }

    private static final Set<Channel> DEFAULT_CHANNELS = EnumSet.of(Channel.EMAIL);

    private final PreferenceRepository repository;
    private final PreferenceCache cache;

    public PreferenceService(PreferenceRepository repository, PreferenceCache cache) {
        this.repository = repository;
        this.cache = cache;
    }

    public Set<Channel> channelsFor(String userId) {
        Lookup cached = cache.lookup(userId);
        if (cached instanceof Present present) {
            return present.channels();
        }
        if (cached instanceof Absent) {
            return DEFAULT_CHANNELS;
        }

        Optional<Set<Channel>> stored = repository.findByUserId(userId);
        if (stored.isEmpty()) {
            cache.putAbsent(userId);
            return DEFAULT_CHANNELS;
        }
        cache.putPresent(userId, stored.get());
        return stored.get();
    }

    public void update(String userId, Set<Channel> channels) {
        repository.save(userId, channels);
        cache.evict(userId);
    }
}
