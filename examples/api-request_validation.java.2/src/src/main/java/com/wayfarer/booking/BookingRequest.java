package com.wayfarer.booking;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public record BookingRequest(
        @NotBlank @Pattern(regexp = "^[A-Z0-9]{8,12}$") String propertyId,
        @NotNull LocalDate checkIn,
        @NotNull LocalDate checkOut,
        @NotNull @Pattern(regexp = "^[A-Z]{3}$") String currency,
        @NotBlank @Email @Size(max = 254) String contactEmail,
        @NotEmpty @Size(max = 9) List<@NotNull @Valid Traveler> travelers) {

    public record Traveler(
            @NotBlank @Size(max = 80) String fullName,
            @NotNull LocalDate dateOfBirth) {}
}
