package com.findit.search.api;

public final class SearchErrors {

    private SearchErrors() {
    }

    public static class IndexNotFoundException extends RuntimeException {
        public IndexNotFoundException(String index) {
            super("no such index: " + index);
        }
    }

    public static class IndexExistsException extends RuntimeException {
        public IndexExistsException(String index) {
            super("index already exists: " + index);
        }
    }

    public static class QuerySyntaxException extends RuntimeException {
        private final int position;

        public QuerySyntaxException(String message, int position) {
            super(message);
            this.position = position;
        }

        public int position() {
            return position;
        }
    }

    public static class RateLimitedException extends RuntimeException {
        private final int retryAfterSeconds;

        public RateLimitedException(int retryAfterSeconds) {
            super("tenant rate limit reached");
            this.retryAfterSeconds = retryAfterSeconds;
        }

        public int retryAfterSeconds() {
            return retryAfterSeconds;
        }
    }

    public static class IndexRecoveringException extends RuntimeException {
        public IndexRecoveringException(String index) {
            super("index is recovering shards: " + index);
        }
    }

    public static class SearchTimeoutException extends RuntimeException {
        public SearchTimeoutException(long millis) {
            super("search exceeded " + millis + " ms");
        }
    }
}
