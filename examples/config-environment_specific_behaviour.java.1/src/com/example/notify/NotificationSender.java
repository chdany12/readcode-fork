package com.example.notify;

public interface NotificationSender {
    void send(Notification notification) throws Exception;
}
