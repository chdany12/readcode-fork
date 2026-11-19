package io.searchlane.index;

import java.util.ArrayList;
import java.util.List;

public record IndexSnapshot(long generation, List<Segment> segments) {

    public static IndexSnapshot empty() {
        return new IndexSnapshot(0L, List.of());
    }

    public IndexSnapshot withSegment(Segment segment) {
        List<Segment> next = new ArrayList<>(segments);
        next.add(segment);
        return new IndexSnapshot(generation + 1, List.copyOf(next));
    }

    public IndexSnapshot replaceAll(Segment merged) {
        return new IndexSnapshot(generation + 1, List.of(merged));
    }
}

record Document(String id, String body) {}

record Hit(String docId, double score, long generation) {
    Hit withGeneration(long g) {
        return new Hit(docId, score, g);
    }
}

interface Segment {
    List<Hit> match(String query);
}

interface SegmentBuilder {
    Segment build(List<Document> documents);

    Segment merge(List<Segment> segments);
}
