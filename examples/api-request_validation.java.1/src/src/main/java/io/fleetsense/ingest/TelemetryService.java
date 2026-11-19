package io.fleetsense.ingest;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TelemetryService {

    private final TimeSeriesWriter writer;

    public TelemetryService(TimeSeriesWriter writer) {
        this.writer = writer;
    }

    public int store(String deviceId, List<ReadingDto> readings) {
        List<TimeSeriesWriter.Point> points = new ArrayList<>(readings.size());
        for (ReadingDto r : readings) {
            String unit = r.getUnit() == null ? "" : r.getUnit().trim();
            points.add(new TimeSeriesWriter.Point(
                    deviceId + "." + r.getMetric(), r.getRecordedAt().toEpochMilli(), r.getValue(), unit));
        }
        writer.writeAll(points);
        return points.size();
    }
}
