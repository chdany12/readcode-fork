package com.acme.search.service;

import java.util.List;
import java.util.Map;

public interface IndexService {

    record IndexView(String name, int shards, long documentCount) {}

    record SearchPage(List<Map<String, Object>> hits, int page, int size, long totalHits) {}

    record ReindexStatus(String index, String jobId, String state) {}

    class IndexExists extends RuntimeException {
        public IndexExists(String name) {
            super("index already exists: " + name);
        }
    }

    class IndexMissing extends RuntimeException {
        public IndexMissing(String name) {
            super("no such index: " + name);
        }
    }

    IndexView create(String name, int shards);

    IndexView get(String name);

    /** Returns true when the document id was not present before. */
    boolean upsertDocument(String index, String docId, Map<String, Object> document);

    SearchPage search(String index, String query, int page, int size);

    ReindexStatus startReindex(String index);

    void delete(String index);
}
