package com.northgate.ledger;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class LedgerService {

    public record Entry(Instant at, String fromId, String toId, long amountMinor) {}

    private final Object auditLock = new Object();
    private final List<Entry> auditTrail = new ArrayList<>();

    public void transfer(Account from, Account to, long amountMinor) {
        if (amountMinor <= 0) {
            throw new IllegalArgumentException("amount must be positive");
        }
        if (from == to) {
            throw new IllegalArgumentException("cannot transfer to the same account");
        }

        Account first = System.identityHashCode(from) < System.identityHashCode(to) ? from : to;
        Account second = first == from ? to : from;

        synchronized (first) {
            synchronized (second) {
                from.debit(amountMinor);
                to.credit(amountMinor);
            }
        }
        record(new Entry(Instant.now(), from.id(), to.id(), amountMinor));
    }

    public long totalHeld(Collection<Account> accounts) {
        long total = 0;
        for (Account account : accounts) {
            total += account.balanceMinor();
        }
        return total;
    }

    public List<Entry> auditSnapshot() {
        synchronized (auditLock) {
            return List.copyOf(auditTrail);
        }
    }

    private void record(Entry entry) {
        synchronized (auditLock) {
            auditTrail.add(entry);
        }
    }
}
