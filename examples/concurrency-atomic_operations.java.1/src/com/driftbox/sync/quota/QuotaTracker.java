package com.driftbox.sync.quota;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public class QuotaTracker {
    private final long limitBytes;
    private final Map<String, AtomicLong> usedByAccount = new ConcurrentHashMap<>();

    public QuotaTracker(long limitBytes) {
        if (limitBytes <= 0) {
            throw new IllegalArgumentException("limitBytes must be positive");
        }
        this.limitBytes = limitBytes;
    }

    public boolean tryReserve(String accountId, long bytes) {
        if (bytes < 0) {
            throw new IllegalArgumentException("bytes must not be negative");
        }
        AtomicLong used = usedByAccount.computeIfAbsent(accountId, id -> new AtomicLong());
        if (used.get() + bytes > limitBytes) {
            return false;
        }
        used.addAndGet(bytes);
        return true;
    }

    public void release(String accountId, long bytes) {
        AtomicLong used = usedByAccount.get(accountId);
        if (used != null) {
            used.updateAndGet(current -> Math.max(0L, current - bytes));
        }
    }

    public long usedBytes(String accountId) {
        AtomicLong used = usedByAccount.get(accountId);
        return used == null ? 0L : used.get();
    }

    public long remainingBytes(String accountId) {
        return Math.max(0L, limitBytes - usedBytes(accountId));
    }
}
