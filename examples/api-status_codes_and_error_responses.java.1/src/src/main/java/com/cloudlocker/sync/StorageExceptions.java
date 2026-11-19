package com.cloudlocker.sync;

public final class StorageExceptions {

    private StorageExceptions() {
    }

    public static class FileNotFoundException extends RuntimeException {
        public FileNotFoundException(String fileId) {
            super("file not found: " + fileId);
        }
    }

    public static class PreconditionRequiredException extends RuntimeException {
        public PreconditionRequiredException() {
            super("If-Match header is required");
        }
    }

    public static class StaleVersionException extends RuntimeException {
        private final long currentVersion;

        public StaleVersionException(long currentVersion) {
            super("stale version");
            this.currentVersion = currentVersion;
        }

        public long currentVersion() {
            return currentVersion;
        }
    }

    public static class PayloadTooLargeException extends RuntimeException {
        public PayloadTooLargeException(long size, long max) {
            super("upload of " + size + " bytes exceeds limit of " + max);
        }
    }

    public static class QuotaExceededException extends RuntimeException {
        public QuotaExceededException(String accountId) {
            super("storage quota exceeded for " + accountId);
        }
    }

    public static class InvalidRangeException extends RuntimeException {
        private final long size;

        public InvalidRangeException(long size) {
            super("range not satisfiable");
            this.size = size;
        }

        public long size() {
            return size;
        }
    }
}
