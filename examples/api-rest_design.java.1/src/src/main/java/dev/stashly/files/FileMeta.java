package dev.stashly.files;

import java.time.Instant;

public record FileMeta(String folderId, String name, long size, String etag, Instant modifiedAt) {}
