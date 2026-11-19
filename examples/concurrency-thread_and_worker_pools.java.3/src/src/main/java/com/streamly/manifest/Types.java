package com.streamly.manifest;

import java.io.IOException;
import java.util.List;

record Manifest(String streamId, long sequence, List<String> segmentUrls) {}

interface StreamCatalog {
    List<String> liveStreamIds();
}

interface OriginClient {
    String fetch(String streamId) throws IOException;
}

interface ManifestParser {
    /** Throws IllegalArgumentException when the playlist is malformed. */
    Manifest parse(String streamId, String raw);
}
