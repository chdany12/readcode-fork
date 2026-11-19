package com.northgate.ledger;

public class Account {
    private final String id;
    private long balanceMinor;
    private boolean frozen;

    public Account(String id, long openingBalanceMinor) {
        this.id = id;
        this.balanceMinor = openingBalanceMinor;
    }

    public String id() {
        return id;
    }

    public synchronized long balanceMinor() {
        return balanceMinor;
    }

    public synchronized boolean isFrozen() {
        return frozen;
    }

    public synchronized void freeze() {
        frozen = true;
    }

    void debit(long amountMinor) {
        if (frozen) {
            throw new IllegalStateException("account " + id + " is frozen");
        }
        if (balanceMinor < amountMinor) {
            throw new InsufficientFundsException(id, balanceMinor, amountMinor);
        }
        balanceMinor -= amountMinor;
    }

    void credit(long amountMinor) {
        if (frozen) {
            throw new IllegalStateException("account " + id + " is frozen");
        }
        balanceMinor += amountMinor;
    }
}
