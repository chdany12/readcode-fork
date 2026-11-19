package com.cloudlocker.sync;

import java.io.InputStream;

public interface FileStore {

    record FileMeta(String fileId, long version, long size, String checksum) {
    }

    FileMeta write(String accountId, String fileId, long expectedVersion, InputStream body, long length);

    FileMeta stat(String accountId, String fileId);

    InputStream read(String accountId, String fileId, long start, long endInclusive);
}
