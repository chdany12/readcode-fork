package notify.prefs;

import java.util.Optional;

public interface KeyValueStore {

    Optional<String> get(String key);

    void put(String key, String value, long ttlSeconds);

    void delete(String key);
}
