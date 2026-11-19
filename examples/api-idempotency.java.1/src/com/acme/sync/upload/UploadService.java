package com.acme.sync.upload;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

public class UploadService {

    public record Result(int status, String fileId) {}

    public interface BlobStore {
        String write(String path, InputStream data) throws IOException;
    }

    public interface MetadataIndex {
        void register(String fileId, String path, long size);
    }

    private final UploadRegistry registry;
    private final BlobStore blobs;
    private final MetadataIndex index;

    public UploadService(UploadRegistry registry, BlobStore blobs, MetadataIndex index) {
        this.registry = registry;
        this.blobs = blobs;
        this.index = index;
    }

    public Result upload(String userId, String idempotencyKey, String path, long size, InputStream data) {
        String key = userId + "/" + idempotencyKey;
        Optional<UploadRegistry.Entry> existing = registry.claim(key);

        if (existing.isPresent()) {
            UploadRegistry.Entry entry = existing.get();
            if (entry.state() == UploadRegistry.State.COMMITTED) {
                return new Result(200, entry.fileId());
            }
            return new Result(409, null);
        }

        try {
            String fileId = blobs.write(userId + "/" + path, data);
            index.register(fileId, path, size);
            registry.commit(key, fileId);
            return new Result(201, fileId);
        } catch (IOException e) {
            return new Result(500, null);
        }
    }
}
