package dev.ci.coordinator;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

public final class BuildRun {
    public enum State { QUEUED, RUNNING, PASSED, FAILED }

    private final String commitSha;
    private final Instant createdAt = Instant.now();
    private final AtomicReference<State> state = new AtomicReference<>(State.QUEUED);

    public BuildRun(String commitSha) {
        this.commitSha = commitSha;
    }

    public String commitSha() {
        return commitSha;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public State state() {
        return state.get();
    }

    public boolean markRunning() {
        return state.compareAndSet(State.QUEUED, State.RUNNING);
    }

    public void finish(boolean passed) {
        state.set(passed ? State.PASSED : State.FAILED);
    }
}
