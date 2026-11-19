package io.fleetsense.ingest;

import java.util.List;

public interface TimeSeriesWriter {

    record Point(String series, long epochMillis, double value, String unit) {}

    void writeAll(List<Point> points);
}
