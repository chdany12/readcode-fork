package com.quickplate.dispatch;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.BlockingQueue;
import java.util.logging.Level;
import java.util.logging.Logger;

public class DispatchWorker implements Runnable {
    private static final Logger log = Logger.getLogger(DispatchWorker.class.getName());

    private final DispatchBoard board;
    private final BlockingQueue<String> orderIds;
    private final DriverNotifier notifier;

    public DispatchWorker(DispatchBoard board, BlockingQueue<String> orderIds, DriverNotifier notifier) {
        this.board = board;
        this.orderIds = orderIds;
        this.notifier = notifier;
    }

    @Override
    public void run() {
        while (!Thread.currentThread().isInterrupted()) {
            String orderId;
            try {
                orderId = orderIds.take();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            try {
                Optional<DispatchBoard.Assignment> assignment = board.assign(orderId);
                assignment.ifPresentOrElse(
                        a -> notifier.notifyDriver(a.driverId(), a.orderId()),
                        () -> log.info("no driver available for order " + orderId));
            } catch (RuntimeException e) {
                log.log(Level.WARNING, "dispatch failed for order " + orderId, e);
            }
        }
    }

    interface DriverNotifier {
        void notifyDriver(String driverId, String orderId);
    }

    static List<DispatchWorker> start(int n, DispatchBoard board, BlockingQueue<String> ids, DriverNotifier notifier) {
        List<DispatchWorker> workers = new java.util.ArrayList<>();
        for (int i = 0; i < n; i++) {
            DispatchWorker w = new DispatchWorker(board, ids, notifier);
            Thread t = new Thread(w, "dispatch-" + i);
            t.setDaemon(true);
            t.start();
            workers.add(w);
        }
        return workers;
    }
}
