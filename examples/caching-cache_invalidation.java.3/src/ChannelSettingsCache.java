package com.example.messaging.channels;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.time.Duration;
import java.util.Optional;

public class ChannelSettingsCache {

    public record ChannelSettings(String channelId, String topic, boolean muted, int retentionDays) {}

    public record Invalidation(String channelId) {}

    public interface SharedCache {
        Optional<ChannelSettings> get(String key);
        void put(String key, ChannelSettings value, Duration ttl);
        void delete(String key);
    }

    public interface InvalidationBus {
        void publish(Invalidation message);
    }

    public interface ChannelRepository {
        ChannelSettings load(String channelId);
        void save(ChannelSettings settings);
    }

    private static final Duration SHARED_TTL = Duration.ofMinutes(30);

    private final Cache<String, ChannelSettings> local = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofMinutes(2))
            .build();

    private final SharedCache shared;
    private final InvalidationBus bus;
    private final ChannelRepository repository;

    public ChannelSettingsCache(SharedCache shared, InvalidationBus bus, ChannelRepository repository) {
        this.shared = shared;
        this.bus = bus;
        this.repository = repository;
    }

    public ChannelSettings get(String channelId) {
        return local.get(channelId, this::loadShared);
    }

    public void update(ChannelSettings settings) {
        repository.save(settings);
        invalidate(settings.channelId());
    }

    public void onInvalidation(Invalidation message) {
        local.invalidate(message.channelId());
    }

    void invalidate(String channelId) {
        local.invalidate(channelId);
        bus.publish(new Invalidation(channelId));
        shared.delete(sharedKey(channelId));
    }

    private ChannelSettings loadShared(String channelId) {
        String key = sharedKey(channelId);
        Optional<ChannelSettings> hit = shared.get(key);
        if (hit.isPresent()) {
            return hit.get();
        }
        ChannelSettings loaded = repository.load(channelId);
        shared.put(key, loaded, SHARED_TTL);
        return loaded;
    }

    private static String sharedKey(String channelId) {
        return "channel-settings:" + channelId;
    }
}
