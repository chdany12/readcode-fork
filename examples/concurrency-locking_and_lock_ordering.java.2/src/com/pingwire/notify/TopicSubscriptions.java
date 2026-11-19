package com.pingwire.notify;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public class TopicSubscriptions {
    private final ReentrantReadWriteLock rw = new ReentrantReadWriteLock();
    private final Map<String, Set<String>> subscribersByTopic = new HashMap<>();

    public boolean subscribe(String topic, String userId) {
        rw.readLock().lock();
        try {
            Set<String> subscribers = ensureTopic(topic);
            if (subscribers.contains(userId)) {
                return false;
            }
            subscribers.add(userId);
            return true;
        } finally {
            rw.readLock().unlock();
        }
    }

    public boolean unsubscribe(String topic, String userId) {
        rw.writeLock().lock();
        try {
            Set<String> subscribers = subscribersByTopic.get(topic);
            if (subscribers == null || !subscribers.remove(userId)) {
                return false;
            }
            if (subscribers.isEmpty()) {
                subscribersByTopic.remove(topic);
            }
            return true;
        } finally {
            rw.writeLock().unlock();
        }
    }

    public List<String> subscribersOf(String topic) {
        rw.readLock().lock();
        try {
            Set<String> subscribers = subscribersByTopic.get(topic);
            return subscribers == null ? List.of() : new ArrayList<>(subscribers);
        } finally {
            rw.readLock().unlock();
        }
    }

    public int topicCount() {
        rw.readLock().lock();
        try {
            return subscribersByTopic.size();
        } finally {
            rw.readLock().unlock();
        }
    }

    private Set<String> ensureTopic(String topic) {
        Set<String> existing = subscribersByTopic.get(topic);
        if (existing != null) {
            return existing;
        }
        rw.writeLock().lock();
        try {
            return subscribersByTopic.computeIfAbsent(topic, t -> new HashSet<>());
        } finally {
            rw.writeLock().unlock();
        }
    }
}
