package dev.stashly.files;

import java.util.List;
import java.util.Optional;

public interface FileStore {

    record Write(FileMeta meta, boolean created) {}

    record Page(List<FileMeta> items, String nextCursor) {}

    Optional<FileMeta> head(String folderId, String name);

    Optional<byte[]> read(String folderId, String name);

    /** Atomic: the precondition is evaluated and the write applied under one lock. */
    Write write(String folderId, String name, byte[] content, String ifMatch, boolean createOnly);

    boolean delete(String folderId, String name);

    Page list(String folderId, String cursor, int limit);

    class PreconditionFailed extends RuntimeException {}

    class PreconditionRequired extends RuntimeException {}
}
