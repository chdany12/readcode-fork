package com.findit.search.api;

import java.util.List;
import java.util.Map;

public interface SearchService {

    record Hit(String id, double score, Map<String, Object> source) {
    }

    record SearchResult(long total, List<Hit> hits, long tookMillis) {
    }

    record BulkItem(String id, Map<String, Object> document) {
    }

    record BulkOutcome(String id, boolean ok, String error) {
    }

    SearchResult search(String tenant, String index, String query, int from, int size);

    void createIndex(String tenant, String index);

    List<BulkOutcome> bulkIndex(String tenant, String index, List<BulkItem> items);
}
