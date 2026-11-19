package com.example.notify;

import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public final class SenderFactory {
    private static final String PRODUCTION_URL = "https://api.notify-provider.example";
    private static final String SANDBOX_URL = "https://sandbox.notify-provider.example";

    private SenderFactory() {}

    public static NotificationSender create(Map<String, String> vars) {
        Environment env = Environment.parse(vars.get("APP_ENV"));
        return switch (env) {
            case LOCAL -> new LoggingSender();
            case STAGING -> new AllowListSender(
                    new ProviderSender(SANDBOX_URL, vars.get("NOTIFY_STAGING_API_KEY")),
                    parseAllowList(vars.get("NOTIFY_ALLOW_LIST")));
            case PRODUCTION -> new ProviderSender(PRODUCTION_URL, vars.get("NOTIFY_API_KEY"));
        };
    }

    private static Set<String> parseAllowList(String raw) {
        if (raw == null) {
            throw new IllegalStateException("NOTIFY_ALLOW_LIST is required outside production");
        }
        return Arrays.stream(raw.split(","))
                .map(s -> s.trim().toLowerCase(Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }
}
