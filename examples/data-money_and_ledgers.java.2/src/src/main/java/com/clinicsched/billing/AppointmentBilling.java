package com.clinicsched.billing;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

public class AppointmentBilling {

    public enum Status { SCHEDULED, COMPLETED, NO_SHOW }

    public record Appointment(String id, String patientId, String visitType, Status status,
                              long visitPriceCents, long copayCents) {}

    public record Entry(String id, String journalId, String account, long amountCents) {}

    public interface TransactionRunner {
        void run(TransactionBody body);
    }

    @FunctionalInterface
    public interface TransactionBody {
        void execute(Connection conn) throws SQLException;
    }

    public interface Appointments {
        Appointment find(String id);
        boolean markNoShowFeeCharged(Connection conn, String id) throws SQLException;
    }

    public interface LedgerStore {
        void append(Connection conn, Entry entry) throws SQLException;
        long depositBalanceCents(String patientId);
    }

    private static final long BPS = 10_000;

    private final TransactionRunner tx;
    private final Appointments appointments;
    private final LedgerStore store;
    private final long noShowFeeBps;

    public AppointmentBilling(TransactionRunner tx, Appointments appointments, LedgerStore store, long noShowFeeBps) {
        this.tx = tx;
        this.appointments = appointments;
        this.store = store;
        this.noShowFeeBps = noShowFeeBps;
    }

    public void chargeNoShowFee(String appointmentId) {
        Appointment appt = appointments.find(appointmentId);
        if (appt.status() != Status.NO_SHOW) {
            throw new IllegalStateException("appointment " + appointmentId + " is not a no-show");
        }
        long fee = Math.multiplyExact(appt.visitPriceCents(), noShowFeeBps) / BPS;
        if (fee == 0) {
            return;
        }
        tx.run(conn -> {
            if (!appointments.markNoShowFeeCharged(conn, appt.id())) {
                return;
            }
            postJournal(conn, List.of(
                    new Entry(newId(), "noshow:" + appt.id(), "receivable:patient:" + appt.patientId(), fee),
                    new Entry(newId(), "noshow:" + appt.id(), "revenue:no_show_fees", -fee)));
        });
    }

    public void applyDeposit(String appointmentId) {
        Appointment appt = appointments.find(appointmentId);
        if (appt.status() != Status.COMPLETED) {
            throw new IllegalStateException("appointment " + appointmentId + " is not completed");
        }
        long amount = Math.min(store.depositBalanceCents(appt.patientId()), appt.copayCents());
        if (amount <= 0) {
            return;
        }
        String journalId = "deposit:" + appt.id();
        tx.run(conn -> store.append(conn,
                new Entry(newId(), journalId, "deposit:patient:" + appt.patientId(), amount)));
        tx.run(conn -> store.append(conn,
                new Entry(newId(), journalId, "copay:appointment:" + appt.id(), -amount)));
    }

    private void postJournal(Connection conn, List<Entry> entries) throws SQLException {
        long sum = 0;
        for (Entry e : entries) {
            sum += e.amountCents();
        }
        if (sum != 0) {
            throw new IllegalArgumentException("journal " + entries.get(0).journalId() + " is unbalanced by " + sum);
        }
        for (Entry e : entries) {
            store.append(conn, e);
        }
    }

    private static String newId() {
        return UUID.randomUUID().toString();
    }
}
