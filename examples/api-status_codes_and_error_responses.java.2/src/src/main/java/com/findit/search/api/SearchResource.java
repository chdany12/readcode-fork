package com.findit.search.api;

import com.findit.search.api.SearchErrors.IndexExistsException;
import com.findit.search.api.SearchErrors.IndexNotFoundException;
import com.findit.search.api.SearchErrors.IndexRecoveringException;
import com.findit.search.api.SearchErrors.QuerySyntaxException;
import com.findit.search.api.SearchErrors.RateLimitedException;
import com.findit.search.api.SearchErrors.SearchTimeoutException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v2/indexes")
public class SearchResource {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_RESULT_WINDOW = 10_000;
    private static final int MAX_BULK_ITEMS = 1_000;

    private final SearchService service;

    public SearchResource(SearchService service) {
        this.service = service;
    }

    @PutMapping("/{index}")
    public ResponseEntity<?> createIndex(@RequestHeader("X-Tenant") String tenant, @PathVariable String index) {
        try {
            service.createIndex(tenant, index);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("index", index));
        } catch (IndexExistsException e) {
            return fail(HttpStatus.CONFLICT, "index_exists", e.getMessage());
        }
    }

    @GetMapping("/{index}/search")
    public ResponseEntity<?> search(
            @RequestHeader("X-Tenant") String tenant,
            @PathVariable String index,
            @RequestParam("q") String query,
            @RequestParam(defaultValue = "0") int from,
            @RequestParam(defaultValue = "20") int size) {
        if (size < 1 || size > MAX_PAGE_SIZE || from < 0) {
            return fail(HttpStatus.BAD_REQUEST, "invalid_paging", "size must be 1-" + MAX_PAGE_SIZE + " and from >= 0");
        }
        if (from + size > MAX_RESULT_WINDOW) {
            return fail(HttpStatus.BAD_REQUEST, "window_too_large", "from + size must not exceed " + MAX_RESULT_WINDOW);
        }
        try {
            return ResponseEntity.ok(service.search(tenant, index, query, from, size));
        } catch (IndexNotFoundException e) {
            return fail(HttpStatus.NOT_FOUND, "index_not_found", e.getMessage());
        } catch (QuerySyntaxException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("code", "query_syntax", "message", e.getMessage(), "position", e.position()));
        } catch (RateLimitedException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, String.valueOf(e.retryAfterSeconds()))
                    .body(Map.of("code", "rate_limited", "message", e.getMessage()));
        } catch (IndexRecoveringException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .header(HttpHeaders.RETRY_AFTER, "5")
                    .body(Map.of("code", "index_recovering", "message", e.getMessage()));
        } catch (SearchTimeoutException e) {
            return fail(HttpStatus.REQUEST_TIMEOUT, "search_timeout", e.getMessage());
        }
    }

    @PostMapping("/{index}/_bulk")
    public ResponseEntity<?> bulk(
            @RequestHeader("X-Tenant") String tenant,
            @PathVariable String index,
            @RequestBody List<SearchService.BulkItem> items) {
        if (items.isEmpty() || items.size() > MAX_BULK_ITEMS) {
            return fail(HttpStatus.BAD_REQUEST, "invalid_bulk_size", "bulk must contain 1-" + MAX_BULK_ITEMS + " items");
        }
        try {
            List<SearchService.BulkOutcome> outcomes = service.bulkIndex(tenant, index, items);
            long failed = outcomes.stream().filter(o -> !o.ok()).count();
            HttpStatus status = failed == 0 ? HttpStatus.OK
                    : failed == outcomes.size() ? HttpStatus.UNPROCESSABLE_ENTITY
                    : HttpStatus.MULTI_STATUS;
            return ResponseEntity.status(status).body(Map.of("failed", failed, "items", outcomes));
        } catch (IndexNotFoundException e) {
            return fail(HttpStatus.NOT_FOUND, "index_not_found", e.getMessage());
        }
    }

    private static ResponseEntity<Map<String, String>> fail(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("code", code, "message", message));
    }
}
