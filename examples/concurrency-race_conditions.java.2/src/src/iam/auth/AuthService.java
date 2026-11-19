package iam.auth;

import java.util.Optional;

public class AuthService {
    public interface PasswordVerifier {
        boolean verify(String username, char[] password);
    }

    public interface TokenIssuer {
        String issue(String username);
    }

    public static class AuthenticationException extends RuntimeException {
        public AuthenticationException(String message) {
            super(message);
        }
    }

    private final LoginThrottle throttle;
    private final PasswordVerifier verifier;
    private final TokenIssuer tokens;

    public AuthService(LoginThrottle throttle, PasswordVerifier verifier, TokenIssuer tokens) {
        this.throttle = throttle;
        this.verifier = verifier;
        this.tokens = tokens;
    }

    public String authenticate(String username, char[] password) {
        String normalized = normalize(username)
                .orElseThrow(() -> new AuthenticationException("invalid credentials"));

        if (throttle.isLocked(normalized)) {
            throw new AuthenticationException("account temporarily locked");
        }

        boolean ok = verifier.verify(normalized, password);
        java.util.Arrays.fill(password, '\0');

        if (!ok) {
            throttle.recordFailure(normalized);
            throw new AuthenticationException("invalid credentials");
        }

        throttle.recordSuccess(normalized);
        return tokens.issue(normalized);
    }

    private static Optional<String> normalize(String username) {
        if (username == null) {
            return Optional.empty();
        }
        String trimmed = username.trim().toLowerCase();
        return trimmed.isEmpty() ? Optional.empty() : Optional.of(trimmed);
    }
}
