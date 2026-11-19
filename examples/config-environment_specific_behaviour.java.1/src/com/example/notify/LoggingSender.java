package com.example.notify;

import java.util.logging.Logger;

public final class LoggingSender implements NotificationSender {
    private static final Logger LOG = Logger.getLogger(LoggingSender.class.getName());

    @Override
    public void send(Notification n) {
        LOG.info(() -> "notification not delivered (local): subject=" + n.subject());
    }
}
