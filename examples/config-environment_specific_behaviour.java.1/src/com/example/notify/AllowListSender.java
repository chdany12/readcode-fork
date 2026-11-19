package com.example.notify;

import java.util.Locale;
import java.util.Set;
import java.util.logging.Logger;

public final class AllowListSender implements NotificationSender {
    private static final Logger LOG = Logger.getLogger(AllowListSender.class.getName());

    private final NotificationSender delegate;
    private final Set<String> allowed;

    public AllowListSender(NotificationSender delegate, Set<String> allowed) {
        if (allowed.isEmpty()) {
            throw new IllegalArgumentException("allow list must not be empty");
        }
        this.delegate = delegate;
        this.allowed = Set.copyOf(allowed);
    }

    @Override
    public void send(Notification n) throws Exception {
        String recipient = n.recipient().trim().toLowerCase(Locale.ROOT);
        if (!allowed.contains(recipient)) {
            LOG.info(() -> "suppressed notification outside allow list: subject=" + n.subject());
            return;
        }
        delegate.send(n);
    }
}
