package com.cloudlocker.sync;

import com.cloudlocker.sync.StorageExceptions.FileNotFoundException;
import com.cloudlocker.sync.StorageExceptions.InvalidRangeException;
import com.cloudlocker.sync.StorageExceptions.PayloadTooLargeException;
import com.cloudlocker.sync.StorageExceptions.PreconditionRequiredException;
import com.cloudlocker.sync.StorageExceptions.QuotaExceededException;
import com.cloudlocker.sync.StorageExceptions.StaleVersionException;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class StorageExceptionHandler {

    public record ApiError(String code, String message, Map<String, Object> details) {
    }

    private static ResponseEntity<ApiError> respond(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new ApiError(code, message, Map.of()));
    }

    @ExceptionHandler(FileNotFoundException.class)
    ResponseEntity<ApiError> notFound(FileNotFoundException e) {
        return respond(HttpStatus.NOT_FOUND, "file_not_found", e.getMessage());
    }

    @ExceptionHandler(PreconditionRequiredException.class)
    ResponseEntity<ApiError> preconditionRequired(PreconditionRequiredException e) {
        return respond(HttpStatus.PRECONDITION_REQUIRED, "if_match_required", e.getMessage());
    }

    @ExceptionHandler(StaleVersionException.class)
    ResponseEntity<ApiError> stale(StaleVersionException e) {
        return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                .body(new ApiError("stale_version", e.getMessage(), Map.of("currentVersion", e.currentVersion())));
    }

    @ExceptionHandler(PayloadTooLargeException.class)
    ResponseEntity<ApiError> tooLarge(PayloadTooLargeException e) {
        return respond(HttpStatus.PAYLOAD_TOO_LARGE, "payload_too_large", e.getMessage());
    }

    @ExceptionHandler(QuotaExceededException.class)
    ResponseEntity<ApiError> quota(QuotaExceededException e) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, "3600")
                .body(new ApiError("quota_exceeded", e.getMessage(), Map.of()));
    }

    @ExceptionHandler(InvalidRangeException.class)
    ResponseEntity<ApiError> badRange(InvalidRangeException e) {
        return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                .header(HttpHeaders.CONTENT_RANGE, "bytes */" + e.size())
                .body(new ApiError("range_not_satisfiable", e.getMessage(), Map.of()));
    }

    @ExceptionHandler({IllegalArgumentException.class})
    ResponseEntity<ApiError> badRequest(IllegalArgumentException e) {
        return respond(HttpStatus.BAD_REQUEST, "bad_request", "malformed header or parameter");
    }
}
