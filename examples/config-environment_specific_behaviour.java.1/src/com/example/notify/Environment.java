package com.example.notify;

import java.util.Locale;

public enum Environment {
    LOCAL, STAGING, PRODUCTION;

    public static Environment parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalStateException("APP_ENV is not set");
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "local", "dev" -> LOCAL;
            case "staging", "stage" -> STAGING;
            case "production", "prod" -> PRODUCTION;
            default -> throw new IllegalStateException("Unknown APP_ENV: " + raw);
        };
    }
}
