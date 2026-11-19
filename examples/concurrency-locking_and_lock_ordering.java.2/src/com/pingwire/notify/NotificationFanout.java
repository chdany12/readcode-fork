package com.pingwire.notify;

import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

public class NotificationFanout {
    private static final Logger log = Logger.getLogger(NotificationFanout.class.getName());

    public interface Sender {
        void send(String userId, String payload) throws Exception;
    }

    public record Result(int delivered, int failed) {}

    private final TopicSubscriptions subscriptions;
    private final Sender sender;

    public NotificationFanout(TopicSubscriptions subscriptions, Sender sender) {
        this.subscriptions = subscriptions;
        this.sender = sender;
    }

    public Result publish(String topic, String payload) {
        List<String> recipients = subscriptions.subscribersOf(topic);
        int delivered = 0;
        int failed = 0;
        for (String userId : recipients) {
            try {
                sender.send(userId, payload);
                delivered++;
            } catch (Exception e) {
                failed++;
                log.log(Level.WARNING, "delivery to " + userId + " failed on topic " + topic, e);
            }
        }
        return new Result(delivered, failed);
    }
}
