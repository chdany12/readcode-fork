package com.pingly.notify;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

public class NotificationDispatcher {

    private static final long PUSH_TIMEOUT_SECONDS = 5;

    private final ThreadPoolExecutor workers;
    private final PushGateway gateway;
    private final DeliveryAudit audit;

    public NotificationDispatcher(PushGateway gateway, DeliveryAudit audit, int poolSize) {
        this.gateway = gateway;
        this.audit = audit;
        AtomicInteger seq = new AtomicInteger();
        this.workers = new ThreadPoolExecutor(
                poolSize, poolSize, 0L, TimeUnit.MILLISECONDS,
                new LinkedBlockingQueue<>(),
                r -> {
                    Thread t = new Thread(r, "notify-worker-" + seq.incrementAndGet());
                    t.setDaemon(true);
                    return t;
                });
    }

    public Future<BatchResult> dispatchCampaign(Campaign campaign) {
        return workers.submit(() -> deliverCampaign(campaign));
    }

    public int backlog() {
        return workers.getQueue().size();
    }

    private BatchResult deliverCampaign(Campaign campaign) throws InterruptedException {
        List<Future<Boolean>> pending = new ArrayList<>();
        for (String token : campaign.deviceTokens()) {
            pending.add(workers.submit(() -> gateway.push(token, campaign.payload())));
        }

        int delivered = 0;
        int failed = 0;
        for (Future<Boolean> result : pending) {
            try {
                if (result.get(PUSH_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                    delivered++;
                } else {
                    failed++;
                }
            } catch (ExecutionException | TimeoutException e) {
                failed++;
            }
        }
        audit.record(campaign.id(), delivered, failed);
        return new BatchResult(campaign.id(), delivered, failed);
    }
}
