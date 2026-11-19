package com.wayfarer.booking;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/bookings")
public class BookingController {

    private final BookingRules rules;
    private final BookingService service;

    public BookingController(BookingRules rules, BookingService service) {
        this.rules = rules;
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody BookingRequest request) {
        List<String> problems = rules.check(request);
        if (!problems.isEmpty()) {
            return ResponseEntity.unprocessableEntity().body(Map.of("problems", problems));
        }
        String bookingId = service.reserve(request);
        return ResponseEntity.status(201).body(Map.of("bookingId", bookingId));
    }
}
