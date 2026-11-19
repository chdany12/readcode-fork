package com.acme.search.api;

import com.acme.search.service.IndexService;
import com.acme.search.service.IndexService.IndexExists;
import com.acme.search.service.IndexService.IndexMissing;
import com.acme.search.service.IndexService.IndexView;
import com.acme.search.service.IndexService.ReindexStatus;
import com.acme.search.service.IndexService.SearchPage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.net.URI;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/v1/indexes")
public class IndexController {

    private static final int MAX_PAGE_SIZE = 100;

    private final IndexService service;

    public IndexController(IndexService service) {
        this.service = service;
    }

    public record CreateIndexRequest(
            @NotBlank @Pattern(regexp = "[a-z0-9-]{3,40}") String name,
            @Min(1) @Max(32) int shards) {}

    @PostMapping
    public ResponseEntity<IndexView> create(@Valid @RequestBody CreateIndexRequest req) {
        IndexView created = service.create(req.name(), req.shards());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{name}")
                .buildAndExpand(created.name())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @GetMapping("/{name}")
    public IndexView get(@PathVariable String name) {
        return service.get(name);
    }

    @PutMapping("/{name}/documents/{docId}")
    public ResponseEntity<Void> upsertDocument(
            @PathVariable String name,
            @PathVariable String docId,
            @RequestBody Map<String, Object> document) {
        boolean created = service.upsertDocument(name, docId, document);
        if (created) {
            URI location = ServletUriComponentsBuilder.fromCurrentRequest().build().toUri();
            return ResponseEntity.created(location).build();
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{name}/search")
    public SearchPage search(
            @PathVariable String name,
            @RequestParam("q") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int boundedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int boundedPage = Math.max(page, 0);
        return service.search(name, query, boundedPage, boundedSize);
    }

    @GetMapping("/{name}/reindex")
    public ResponseEntity<ReindexStatus> reindex(@PathVariable String name) {
        return ResponseEntity.accepted().body(service.startReindex(name));
    }

    @DeleteMapping("/{name}")
    public ResponseEntity<Void> delete(@PathVariable String name) {
        service.delete(name);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(IndexExists.class)
    ProblemDetail onExists(IndexExists e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());
    }

    @ExceptionHandler(IndexMissing.class)
    ProblemDetail onMissing(IndexMissing e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
    }
}
