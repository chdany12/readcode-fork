package io.fleetsense.ingest;

import io.fleetsense.flags.RolloutFlags;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.zip.GZIPOutputStream;

public final class BatchEncoder {
    private final RolloutFlags flags;

    public BatchEncoder(RolloutFlags flags) {
        this.flags = flags;
    }

    public byte[] encode(String deviceId, String model, List<String> readings) {
        byte[] payload = String.join("\n", readings).getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (!flags.isEnabled("compressed-batches", deviceId, model)) {
            return payload;
        }
        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             GZIPOutputStream gz = new GZIPOutputStream(out)) {
            gz.write(payload);
            gz.finish();
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
