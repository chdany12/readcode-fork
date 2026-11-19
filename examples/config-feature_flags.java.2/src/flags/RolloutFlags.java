package io.fleetsense.flags;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.stream.Collectors;

public class RolloutFlags {
    record Rule(int percent, Set<String> models, boolean kill) {}

    private final Path file;
    private volatile Map<String, Rule> rules = Map.of();
    private FileTime loadedModified = FileTime.fromMillis(0);

    public RolloutFlags(Path file) {
        this.file = file;
    }

    public synchronized boolean reloadIfChanged() throws IOException {
        FileTime modified = Files.getLastModifiedTime(file);
        if (modified.equals(loadedModified)) {
            return false;
        }
        Properties props = new Properties();
        try (InputStream in = Files.newInputStream(file)) {
            props.load(in);
        }
        Map<String, Rule> parsed = new HashMap<>();
        for (String name : props.stringPropertyNames()) {
            if (!name.endsWith(".percent")) {
                continue;
            }
            String flag = name.substring(0, name.length() - ".percent".length());
            int percent = Integer.parseInt(props.getProperty(name).trim());
            if (percent < 0 || percent > 100) {
                throw new IllegalArgumentException("percent out of range for " + flag);
            }
            Set<String> models = parseList(props.getProperty(flag + ".models", ""));
            boolean kill = Boolean.parseBoolean(props.getProperty(flag + ".kill", "false"));
            parsed.put(flag, new Rule(percent, models, kill));
        }
        rules = Map.copyOf(parsed);
        loadedModified = modified;
        return true;
    }

    public boolean isEnabled(String flag, String deviceId, String model) {
        Rule rule = rules.get(flag);
        if (rule == null || rule.kill()) {
            return false;
        }
        if (!rule.models().isEmpty() && !rule.models().contains(model)) {
            return false;
        }
        return bucket(deviceId) < rule.percent();
    }

    static int bucket(String deviceId) {
        return deviceId.hashCode() % 100;
    }

    private static Set<String> parseList(String csv) {
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }
}
