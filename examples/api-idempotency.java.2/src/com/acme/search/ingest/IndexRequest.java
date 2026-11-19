package com.acme.search.ingest;

import java.util.List;
import java.util.Map;

public record IndexRequest(String requestId, String tenant, String docId, Map<String, Object> fields, List<String> tags) {}
