package com.driftbox.sync.upload;

import com.driftbox.sync.quota.QuotaTracker;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class UploadService {

    public interface BlobStore {
        void write(String key, InputStream data, long length) throws IOException;

        void delete(String key) throws IOException;
    }

    public record UploadResult(String path, long version, long bytes) {}

    public static class QuotaExceededException extends RuntimeException {
        public QuotaExceededException(String accountId) {
            super("storage quota exceeded for account " + accountId);
        }
    }

    private final QuotaTracker quota;
    private final BlobStore store;
    private final Map<String, Long> latestVersions = new ConcurrentHashMap<>();

    public UploadService(QuotaTracker quota, BlobStore store) {
        this.quota = quota;
        this.store = store;
    }

    public UploadResult upload(String accountId, String path, InputStream data, long length)
            throws IOException {
        if (!quota.tryReserve(accountId, length)) {
            throw new QuotaExceededException(accountId);
        }
        long version = nextVersion(accountId, path);
        String key = blobKey(accountId, path, version);
        try {
            store.write(key, data, length);
        } catch (IOException | RuntimeException e) {
            quota.release(accountId, length);
            throw e;
        }
        return new UploadResult(path, version, length);
    }

    public void delete(String accountId, String path, long version, long length) throws IOException {
        store.delete(blobKey(accountId, path, version));
        quota.release(accountId, length);
    }

    public long latestVersion(String accountId, String path) {
        return latestVersions.getOrDefault(accountId + ":" + path, 0L);
    }

    private long nextVersion(String accountId, String path) {
        return latestVersions.merge(accountId + ":" + path, 1L, Long::sum);
    }

    private static String blobKey(String accountId, String path, long version) {
        return accountId + "/" + path + "@" + version;
    }
}
