package com.acme.iam.flags;

import java.util.Map;

public record FlagDefinition(
        String key,
        boolean enabled,
        int rolloutPercent,
        Map<String, Boolean> tenantOverrides) {

    public FlagDefinition {
        if (rolloutPercent < 0 || rolloutPercent > 100) {
            throw new IllegalArgumentException("rolloutPercent out of range for " + key);
        }
        tenantOverrides = Map.copyOf(tenantOverrides);
    }
}
