package io.fleetsense.ingest;

import jakarta.validation.Valid;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/telemetry")
public class TelemetryController {

    private static final Duration MAX_CLOCK_SKEW = Duration.ofMinutes(5);

    private final TelemetryService service;
    private final Clock clock;

    public TelemetryController(TelemetryService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    @PostMapping("/batches")
    public ResponseEntity<Map<String, Object>> ingest(@Valid @RequestBody TelemetryBatchRequest request) {
        Instant latestAllowed = clock.instant().plus(MAX_CLOCK_SKEW);
        for (ReadingDto reading : request.getReadings()) {
            if (reading.getRecordedAt().isAfter(latestAllowed)) {
                return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                        .body(Map.of("error", "recordedAt is in the future", "metric", reading.getMetric()));
            }
        }
        int stored = service.store(request.getDeviceId(), request.getReadings());
        return ResponseEntity.accepted().body(Map.of("stored", stored));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> onInvalid(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return ResponseEntity.badRequest().body(Map.of("error", "validation failed", "fields", fields));
    }
}
