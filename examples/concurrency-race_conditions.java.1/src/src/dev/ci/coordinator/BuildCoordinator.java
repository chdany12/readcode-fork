package dev.ci.coordinator;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicInteger;

public class BuildCoordinator {
    public interface BuildExecutor {
        boolean run(String commitSha) throws Exception;
    }

    private final ConcurrentHashMap<String, BuildRun> activeBuilds = new ConcurrentHashMap<>();
    private final ExecutorService executor;
    private final BuildExecutor buildExecutor;
    private final AtomicInteger executed = new AtomicInteger();

    public BuildCoordinator(ExecutorService executor, BuildExecutor buildExecutor) {
        this.executor = executor;
        this.buildExecutor = buildExecutor;
    }

    /** Returns the in-flight build for the commit, starting one if none exists. */
    public BuildRun trigger(String commitSha) {
        BuildRun existing = activeBuilds.get(commitSha);
        if (existing != null) {
            return existing;
        }
        BuildRun run = new BuildRun(commitSha);
        activeBuilds.put(commitSha, run);
        try {
            executor.submit(() -> execute(run));
        } catch (RejectedExecutionException e) {
            activeBuilds.remove(commitSha, run);
            throw e;
        }
        return run;
    }

    private void execute(BuildRun run) {
        if (!run.markRunning()) {
            return;
        }
        try {
            run.finish(buildExecutor.run(run.commitSha()));
        } catch (Exception e) {
            run.finish(false);
        } finally {
            executed.incrementAndGet();
            activeBuilds.remove(run.commitSha(), run);
        }
    }

    public int activeCount() {
        return activeBuilds.size();
    }

    public int executedCount() {
        return executed.get();
    }
}
