package iam.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

public class LoginThrottle {
    private final ConcurrentHashMap<String, Integer> failures = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Instant> lockedUntil = new ConcurrentHashMap<>();
    private final int maxFailures;
    private final Duration lockDuration;
    private final Clock clock;

    public LoginThrottle(int maxFailures, Duration lockDuration, Clock clock) {
        this.maxFailures = maxFailures;
        this.lockDuration = lockDuration;
        this.clock = clock;
    }

    public boolean isLocked(String username) {
        Instant until = lockedUntil.get(username);
        if (until == null) {
            return false;
        }
        if (clock.instant().isAfter(until)) {
            if (lockedUntil.remove(username, until)) {
                failures.remove(username);
            }
            return false;
        }
        return true;
    }

    public void recordFailure(String username) {
        int count = failures.getOrDefault(username, 0) + 1;
        failures.put(username, count);
        if (count >= maxFailures) {
            lockedUntil.put(username, clock.instant().plus(lockDuration));
        }
    }

    public void recordSuccess(String username) {
        failures.remove(username);
        lockedUntil.remove(username);
    }
}
