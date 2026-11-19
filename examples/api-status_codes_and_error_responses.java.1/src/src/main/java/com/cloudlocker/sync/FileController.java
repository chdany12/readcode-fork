package com.cloudlocker.sync;

import com.cloudlocker.sync.StorageExceptions.InvalidRangeException;
import com.cloudlocker.sync.StorageExceptions.PayloadTooLargeException;
import com.cloudlocker.sync.StorageExceptions.PreconditionRequiredException;
import java.io.InputStream;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/files")
public class FileController {

    private static final long MAX_UPLOAD_BYTES = 5L * 1024 * 1024 * 1024;

    private final FileStore store;

    public FileController(FileStore store) {
        this.store = store;
    }

    @PutMapping("/{fileId}")
    public ResponseEntity<FileStore.FileMeta> upload(
            @RequestHeader("X-Account-Id") String accountId,
            @PathVariable String fileId,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @RequestHeader(HttpHeaders.CONTENT_LENGTH) long length,
            InputStream body) {
        if (ifMatch == null) {
            throw new PreconditionRequiredException();
        }
        if (length > MAX_UPLOAD_BYTES) {
            throw new PayloadTooLargeException(length, MAX_UPLOAD_BYTES);
        }
        long expected = Long.parseLong(ifMatch.replace("\"", ""));
        FileStore.FileMeta meta = store.write(accountId, fileId, expected, body, length);
        HttpStatus status = meta.version() == 1 ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).eTag("\"" + meta.version() + "\"").body(meta);
    }

    @GetMapping("/{fileId}")
    public ResponseEntity<InputStreamResource> download(
            @RequestHeader("X-Account-Id") String accountId,
            @PathVariable String fileId,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String range) {
        FileStore.FileMeta meta = store.stat(accountId, fileId);
        if (range == null) {
            return ResponseEntity.ok()
                    .eTag("\"" + meta.version() + "\"")
                    .contentLength(meta.size())
                    .body(new InputStreamResource(store.read(accountId, fileId, 0, meta.size() - 1)));
        }
        long[] bounds = parseRange(range, meta.size());
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.CONTENT_RANGE, "bytes " + bounds[0] + "-" + bounds[1] + "/" + meta.size());
        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .headers(headers)
                .eTag("\"" + meta.version() + "\"")
                .contentLength(bounds[1] - bounds[0] + 1)
                .body(new InputStreamResource(store.read(accountId, fileId, bounds[0], bounds[1])));
    }

    private static long[] parseRange(String header, long size) {
        if (!header.startsWith("bytes=")) {
            throw new IllegalArgumentException("unsupported range unit");
        }
        String[] parts = header.substring(6).split("-", 2);
        long start = Long.parseLong(parts[0]);
        long end = parts.length < 2 || parts[1].isEmpty() ? size - 1 : Long.parseLong(parts[1]);
        if (start >= size || end < start) {
            throw new InvalidRangeException(size);
        }
        return new long[] {start, Math.min(end, size - 1)};
    }
}
