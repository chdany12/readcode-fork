package dev.stashly.files;

import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

public class InMemoryFileStore implements FileStore {

    private record Entry(FileMeta meta, byte[] content) {}

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final Clock clock;

    public InMemoryFileStore(Clock clock) {
        this.clock = clock;
    }

    private static String key(String folderId, String name) {
        return folderId + "/" + name;
    }

    @Override
    public Optional<FileMeta> head(String folderId, String name) {
        return Optional.ofNullable(entries.get(key(folderId, name))).map(Entry::meta);
    }

    @Override
    public Optional<byte[]> read(String folderId, String name) {
        return Optional.ofNullable(entries.get(key(folderId, name))).map(Entry::content);
    }

    @Override
    public Write write(String folderId, String name, byte[] content, String ifMatch, boolean createOnly) {
        AtomicBoolean created = new AtomicBoolean();
        Entry stored = entries.compute(key(folderId, name), (k, current) -> {
            if (current == null) {
                if (ifMatch != null) {
                    throw new PreconditionFailed();
                }
                created.set(true);
            } else {
                if (createOnly) {
                    throw new PreconditionFailed();
                }
                if (ifMatch == null) {
                    throw new PreconditionRequired();
                }
                if (!current.meta().etag().equals(ifMatch)) {
                    throw new PreconditionFailed();
                }
            }
            FileMeta meta = new FileMeta(folderId, name, content.length, etagOf(content), Instant.now(clock));
            return new Entry(meta, content.clone());
        });
        return new Write(stored.meta(), created.get());
    }

    @Override
    public boolean delete(String folderId, String name) {
        return entries.remove(key(folderId, name)) != null;
    }

    @Override
    public Page list(String folderId, String cursor, int limit) {
        List<FileMeta> sorted = entries.values().stream()
                .map(Entry::meta)
                .filter(m -> m.folderId().equals(folderId))
                .filter(m -> cursor == null || m.name().compareTo(cursor) > 0)
                .sorted((a, b) -> a.name().compareTo(b.name()))
                .limit(limit + 1L)
                .toList();
        if (sorted.size() <= limit) {
            return new Page(sorted, null);
        }
        List<FileMeta> items = sorted.subList(0, limit);
        return new Page(items, items.get(limit - 1).name());
    }

    private static String etagOf(byte[] content) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(content);
            return "\"" + HexFormat.of().formatHex(digest, 0, 16) + "\"";
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
