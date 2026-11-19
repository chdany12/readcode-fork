package io.searchlane.index;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.LongAdder;

public class IndexCoordinator {
    private final AtomicReference<IndexSnapshot> current = new AtomicReference<>(IndexSnapshot.empty());
    private final ConcurrentLinkedQueue<Document> buffer = new ConcurrentLinkedQueue<>();
    private final LongAdder pendingDocs = new LongAdder();
    private final LongAdder totalIndexed = new LongAdder();
    private final AtomicBoolean refreshing = new AtomicBoolean(false);
    private final SegmentBuilder segmentBuilder;
    private final int refreshThreshold;

    public IndexCoordinator(SegmentBuilder segmentBuilder, int refreshThreshold) {
        this.segmentBuilder = segmentBuilder;
        this.refreshThreshold = refreshThreshold;
    }

    public void add(Document doc) {
        buffer.add(doc);
        pendingDocs.increment();
        if (pendingDocs.sum() >= refreshThreshold) {
            maybeRefresh();
        }
    }

    public List<Hit> search(String query, int limit) {
        IndexSnapshot snapshot = current.get();
        List<Hit> hits = new ArrayList<>();
        for (Segment segment : snapshot.segments()) {
            hits.addAll(segment.match(query));
        }
        hits.sort((a, b) -> Double.compare(b.score(), a.score()));
        long generation = snapshot.generation();
        List<Hit> top = hits.subList(0, Math.min(limit, hits.size()));
        return top.stream().map(h -> h.withGeneration(generation)).toList();
    }

    public void compact() {
        IndexSnapshot prev;
        IndexSnapshot next;
        do {
            prev = current.get();
            if (prev.segments().size() < 2) {
                return;
            }
            Segment merged = segmentBuilder.merge(prev.segments());
            next = prev.replaceAll(merged);
        } while (!current.compareAndSet(prev, next));
    }

    public long totalIndexed() {
        return totalIndexed.sum();
    }

    public long pending() {
        return pendingDocs.sum();
    }

    private void maybeRefresh() {
        if (!refreshing.compareAndSet(false, true)) {
            return;
        }
        try {
            refresh();
        } finally {
            refreshing.set(false);
        }
    }

    private void refresh() {
        List<Document> batch = new ArrayList<>();
        Document doc;
        while ((doc = buffer.poll()) != null) {
            batch.add(doc);
        }
        if (batch.isEmpty()) {
            return;
        }
        long flushed = pendingDocs.sum();
        pendingDocs.reset();

        Segment segment = segmentBuilder.build(batch);
        IndexSnapshot prev;
        IndexSnapshot next;
        do {
            prev = current.get();
            next = prev.withSegment(segment);
        } while (!current.compareAndSet(prev, next));
        totalIndexed.add(batch.size());
    }
}
