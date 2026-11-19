package com.haulway.routing;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class ShipmentRouter {
    private static final Duration QUOTE_TTL = Duration.ofMinutes(10);
    private static final Duration FUEL_INDEX_TTL = Duration.ofHours(1);

    private final List<Carrier> carriers;
    private final FuelIndexClient fuelIndexClient;
    private final Clock clock;
    private final ExecutorService carrierPool = Executors.newFixedThreadPool(4);
    private final Map<String, CachedQuote> quoteCache = new HashMap<>();

    private volatile BigDecimal fuelIndex = BigDecimal.ONE;
    private volatile Instant fuelIndexFetchedAt = Instant.EPOCH;

    public ShipmentRouter(List<Carrier> carriers, FuelIndexClient fuelIndexClient, Clock clock) {
        this.carriers = List.copyOf(carriers);
        this.fuelIndexClient = fuelIndexClient;
        this.clock = clock;
    }

    public synchronized RouteQuote quote(String lane) throws InterruptedException, ExecutionException {
        CachedQuote cached = quoteCache.get(lane);
        if (cached != null && cached.expiresAt().isAfter(clock.instant())) {
            return cached.quote();
        }

        List<Future<RouteQuote>> pending = new ArrayList<>();
        for (Carrier carrier : carriers) {
            pending.add(carrierPool.submit(() -> fetchQuote(carrier, lane)));
        }

        RouteQuote best = null;
        for (Future<RouteQuote> future : pending) {
            RouteQuote candidate = future.get();
            if (best == null || candidate.price().compareTo(best.price()) < 0) {
                best = candidate;
            }
        }
        quoteCache.put(lane, new CachedQuote(best, clock.instant().plus(QUOTE_TTL)));
        return best;
    }

    public synchronized void invalidate(String lane) {
        quoteCache.remove(lane);
    }

    public synchronized int cachedLanes() {
        return quoteCache.size();
    }

    private RouteQuote fetchQuote(Carrier carrier, String lane) {
        BigDecimal surcharge = currentFuelIndex();
        BigDecimal base = carrier.basePrice(lane);
        return new RouteQuote(carrier.name(), lane, base.multiply(surcharge));
    }

    private BigDecimal currentFuelIndex() {
        boolean stale = fuelIndexFetchedAt.plus(FUEL_INDEX_TTL).isBefore(clock.instant());
        return stale ? refreshFuelIndex() : fuelIndex;
    }

    private synchronized BigDecimal refreshFuelIndex() {
        if (fuelIndexFetchedAt.plus(FUEL_INDEX_TTL).isAfter(clock.instant())) {
            return fuelIndex;
        }
        fuelIndex = fuelIndexClient.fetchLatest();
        fuelIndexFetchedAt = clock.instant();
        return fuelIndex;
    }

    public void shutdown() {
        carrierPool.shutdown();
    }

    private record CachedQuote(RouteQuote quote, Instant expiresAt) {}
}
