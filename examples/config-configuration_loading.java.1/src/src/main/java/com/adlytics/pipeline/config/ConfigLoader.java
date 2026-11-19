package com.adlytics.pipeline.config;

import java.io.IOException;
import java.io.InputStream;
import java.io.Reader;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;

public final class ConfigLoader {

    private static final String ENV_PREFIX = "ADS_PIPELINE_";

    private ConfigLoader() {}

    public static PipelineConfig load(Path optionalOverrides, Map<String, String> env) throws IOException {
        Properties props = new Properties();
        try (InputStream in = ConfigLoader.class.getResourceAsStream("/defaults.properties")) {
            if (in == null) {
                throw new IllegalStateException("defaults.properties missing from classpath");
            }
            props.load(in);
        }
        if (optionalOverrides != null && Files.exists(optionalOverrides)) {
            try (Reader reader = Files.newBufferedReader(optionalOverrides)) {
                props.load(reader);
            }
        }
        for (String key : props.stringPropertyNames()) {
            String fromEnv = env.get(envName(key));
            if (fromEnv != null && !fromEnv.isBlank()) {
                props.setProperty(key, fromEnv.trim());
            }
        }
        return build(props);
    }

    static String envName(String key) {
        return ENV_PREFIX + key.toUpperCase(Locale.ROOT).replace('.', '_');
    }

    static PipelineConfig build(Properties props) {
        int batchSize = requireInt(props, "batch.size", 1, 10_000);
        Duration flushInterval = Duration.ofMillis(requireInt(props, "flush.interval.ms", 100, 60_000));
        int workers = requireInt(props, "worker.threads", 1, 64);
        boolean dedupeEnabled = Boolean.parseBoolean(props.getProperty("dedupe.enabled"));
        boolean piiHashing = requireBool(props, "pii.hashing.enabled");
        URI sink = URI.create(require(props, "sink.url"));
        if (sink.getScheme() == null || sink.getHost() == null) {
            throw new IllegalArgumentException("sink.url must be an absolute URL: " + sink);
        }
        return new PipelineConfig(batchSize, flushInterval, workers, dedupeEnabled, piiHashing, sink);
    }

    private static String require(Properties props, String key) {
        String value = props.getProperty(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("missing required setting: " + key);
        }
        return value.trim();
    }

    private static int requireInt(Properties props, String key, int min, int max) {
        String raw = require(props, key);
        int value;
        try {
            value = Integer.parseInt(raw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(key + " is not an integer: " + raw, e);
        }
        if (value < min || value > max) {
            throw new IllegalArgumentException(key + " must be in [" + min + ", " + max + "], got " + value);
        }
        return value;
    }

    private static boolean requireBool(Properties props, String key) {
        String raw = require(props, key).toLowerCase(Locale.ROOT);
        if (!raw.equals("true") && !raw.equals("false")) {
            throw new IllegalArgumentException(key + " must be true or false, got " + raw);
        }
        return Boolean.parseBoolean(raw);
    }
}
