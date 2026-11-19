package io.fleetsense.ingest;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public class TelemetryBatchRequest {

    @NotBlank
    @Pattern(regexp = "^[A-Za-z0-9_-]{6,64}$")
    private String deviceId;

    @NotEmpty
    @Size(max = 500)
    private List<ReadingDto> readings;

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public List<ReadingDto> getReadings() {
        return readings;
    }

    public void setReadings(List<ReadingDto> readings) {
        this.readings = readings;
    }
}
