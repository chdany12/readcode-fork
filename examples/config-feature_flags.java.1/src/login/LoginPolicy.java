package com.acme.iam.login;

import com.acme.iam.flags.FlagService;

public final class LoginPolicy {
    private final FlagService flags;

    public LoginPolicy(FlagService flags) {
        this.flags = flags;
    }

    public boolean mfaRequired(Account account) {
        return flags.isEnabled("enforce-mfa", account.tenantId(), account.id(), false);
    }

    public boolean allowPasswordlessLogin(Account account) {
        return flags.isEnabled("passwordless-login", account.tenantId(), account.id(), false);
    }

    public record Account(String id, String tenantId) {}
}
