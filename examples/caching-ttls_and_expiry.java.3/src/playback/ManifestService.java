package playback;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

public class ManifestService {

    public record PlaybackConfig(Duration signedUrlTtl, Duration manifestCacheTtl) {
        static final PlaybackConfig DEFAULT =
                new PlaybackConfig(Duration.ofMinutes(10), Duration.ofMinutes(15));
    }

    public record Rendition(String name, int bitrateKbps, String path) {}

    public interface EntitlementService {
        void assertCanWatch(String userId, String videoId);
    }

    public interface RenditionCatalog {
        List<Rendition> renditionsFor(String videoId, String deviceProfile);
    }

    public interface UrlSigner {
        String sign(String path, String region, Instant expiresAt);
    }

    public static class NotEntitledException extends RuntimeException {
        public NotEntitledException(String message) {
            super(message);
        }
    }

    private final EntitlementService entitlements;
    private final RenditionCatalog catalog;
    private final UrlSigner signer;
    private final ManifestCache cache;
    private final PlaybackConfig config;
    private final Clock clock;

    public ManifestService(EntitlementService entitlements, RenditionCatalog catalog,
                           UrlSigner signer, ManifestCache cache,
                           PlaybackConfig config, Clock clock) {
        this.entitlements = entitlements;
        this.catalog = catalog;
        this.signer = signer;
        this.cache = cache;
        this.config = config;
        this.clock = clock;
    }

    public String manifestFor(String userId, String videoId, String region, String deviceProfile) {
        entitlements.assertCanWatch(userId, videoId);

        String key = videoId + "|" + region + "|" + deviceProfile;
        Optional<String> cached = cache.get(key);
        if (cached.isPresent()) {
            return cached.get();
        }

        List<Rendition> renditions = catalog.renditionsFor(videoId, deviceProfile);
        if (renditions.isEmpty()) {
            throw new IllegalStateException("no renditions for " + videoId + " on " + deviceProfile);
        }

        String manifest = render(renditions, region);
        cache.put(key, manifest, config.manifestCacheTtl());
        return manifest;
    }

    private String render(List<Rendition> renditions, String region) {
        Instant expiresAt = clock.instant().plus(config.signedUrlTtl());
        return renditions.stream()
                .map(r -> "#EXT-X-STREAM-INF:BANDWIDTH=" + r.bitrateKbps() * 1000
                        + "\n" + signer.sign(r.path(), region, expiresAt))
                .collect(Collectors.joining("\n", "#EXTM3U\n", "\n"));
    }
}
