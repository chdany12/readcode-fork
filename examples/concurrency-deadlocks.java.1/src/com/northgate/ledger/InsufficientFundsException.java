package com.northgate.ledger;

public class InsufficientFundsException extends RuntimeException {
    private final String accountId;
    private final long availableMinor;
    private final long requestedMinor;

    public InsufficientFundsException(String accountId, long availableMinor, long requestedMinor) {
        super("account " + accountId + " has " + availableMinor + " but " + requestedMinor + " was requested");
        this.accountId = accountId;
        this.availableMinor = availableMinor;
        this.requestedMinor = requestedMinor;
    }

    public String accountId() {
        return accountId;
    }

    public long availableMinor() {
        return availableMinor;
    }

    public long requestedMinor() {
        return requestedMinor;
    }
}
