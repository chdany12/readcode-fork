package dev.stashly.files;

import java.net.URI;
import java.util.regex.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/v1/folders/{folderId}/files")
public class FileController {

    private static final Pattern NAME = Pattern.compile("^[A-Za-z0-9._ -]{1,255}$");
    private static final int MAX_PAGE = 200;

    private final FileStore store;

    public FileController(FileStore store) {
        this.store = store;
    }

    @GetMapping
    public FileStore.Page list(
            @PathVariable String folderId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit) {
        int bounded = Math.max(1, Math.min(limit, MAX_PAGE));
        return store.list(folderId, cursor, bounded);
    }

    @GetMapping("/{name}")
    public ResponseEntity<byte[]> download(
            @PathVariable String folderId,
            @PathVariable String name,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        FileMeta meta = store.head(folderId, name).orElseThrow(this::notFound);
        if (meta.etag().equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(meta.etag()).build();
        }
        byte[] content = store.read(folderId, name).orElseThrow(this::notFound);
        return ResponseEntity.ok()
                .eTag(meta.etag())
                .cacheControl(CacheControl.noCache())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(content);
    }

    @PutMapping("/{name}")
    public ResponseEntity<FileMeta> upload(
            @PathVariable String folderId,
            @PathVariable String name,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch,
            @RequestBody byte[] content) {
        if (!NAME.matcher(name).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid file name");
        }
        FileStore.Write result = store.write(folderId, name, content, ifMatch, "*".equals(ifNoneMatch));
        FileMeta meta = result.meta();
        if (result.created()) {
            URI location = URI.create("/v1/folders/" + folderId + "/files/" + name);
            return ResponseEntity.created(location).eTag(meta.etag()).body(meta);
        }
        return ResponseEntity.ok().eTag(meta.etag()).body(meta);
    }

    @DeleteMapping("/{name}")
    public ResponseEntity<Void> delete(@PathVariable String folderId, @PathVariable String name) {
        store.delete(folderId, name);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(FileStore.PreconditionFailed.class)
    ResponseEntity<Void> onPreconditionFailed() {
        return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED).build();
    }

    @ExceptionHandler(FileStore.PreconditionRequired.class)
    ResponseEntity<Void> onPreconditionRequired() {
        return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED).build();
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "file not found");
    }
}
