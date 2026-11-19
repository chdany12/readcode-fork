package com.wayfarer.booking;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Currency;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class BookingRules {

    static final int MAX_NIGHTS = 30;
    static final int MAX_ADVANCE_DAYS = 500;

    private final Clock clock;

    public BookingRules(Clock clock) {
        this.clock = clock;
    }

    public List<String> check(BookingRequest request) {
        List<String> problems = new ArrayList<>();
        LocalDate today = LocalDate.now(clock);

        if (request.checkIn().isBefore(today)) {
            problems.add("checkIn must not be in the past");
        }
        if (!request.checkOut().isAfter(request.checkIn())) {
            problems.add("checkOut must be after checkIn");
        } else {
            long nights = ChronoUnit.DAYS.between(request.checkIn(), request.checkOut());
            if (nights > MAX_NIGHTS) {
                problems.add("stays are limited to " + MAX_NIGHTS + " nights");
            }
        }
        if (request.checkIn().isAfter(today.plusDays(MAX_ADVANCE_DAYS))) {
            problems.add("checkIn is too far in the future");
        }
        try {
            Currency.getInstance(request.currency());
        } catch (IllegalArgumentException e) {
            problems.add("currency is not a recognised ISO 4217 code");
        }
        for (int i = 0; i < request.travelers().size(); i++) {
            LocalDate dob = request.travelers().get(i).dateOfBirth();
            if (dob.isAfter(today)) {
                problems.add("travelers[" + i + "].dateOfBirth must not be in the future");
            }
        }
        return problems;
    }
}
