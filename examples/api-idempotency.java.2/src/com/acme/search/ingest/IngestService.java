package com.acme.search.ingest;

import java.time.Instant;
import java.util.Optional;

public class IngestService {

    public interface SearchIndex {
        long upsert(String tenant, String docId, java.util.Map<String, Object> fields);
        void appendTags(String tenant, String docId, java.util.List<String> tags);
    }

    public interface ProcessedRequests {
        Optional<Long> versionFor(String tenant, String requestId);
        void markProcessed(String tenant, String requestId, long version, Instant at);
    }

    private final SearchIndex index;
    private final ProcessedRequests processed;

    public IngestService(SearchIndex index, ProcessedRequests processed) {
        this.index = index;
        this.processed = processed;
    }

    public long handle(IndexRequest req) {
        validate(req);

        Optional<Long> seen = processed.versionFor(req.tenant(), req.requestId());
        if (seen.isPresent()) {
            return seen.get();
        }

        long version = index.upsert(req.tenant(), req.docId(), req.fields());
        if (!req.tags().isEmpty()) {
            index.appendTags(req.tenant(), req.docId(), req.tags());
        }

        processed.markProcessed(req.tenant(), req.requestId(), version, Instant.now());
        return version;
    }

    private void validate(IndexRequest req) {
        if (req.requestId() == null || req.requestId().isBlank()) {
            throw new IllegalArgumentException("requestId is required");
        }
        if (req.tenant() == null || req.docId() == null) {
            throw new IllegalArgumentException("tenant and docId are required");
        }
    }
}
