package com.quickplate.dispatch;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

public class DispatchBoard {

    public record Order(String id, Double lat, Double lon, Instant placedAt) {}

    public record Driver(String id, double lat, double lon) {}

    public record Assignment(String orderId, String driverId, double distanceKm) {}

    public record BoardStats(int openOrders, int idleDrivers, Duration oldestOrderAge) {}

    private final ReentrantLock lock = new ReentrantLock();
    private final Map<String, Order> openOrders = new HashMap<>();
    private final Map<String, Driver> idleDrivers = new HashMap<>();

    public void submit(Order order) {
        lock.lock();
        try {
            openOrders.put(order.id(), order);
        } finally {
            lock.unlock();
        }
    }

    public void driverAvailable(Driver driver) {
        lock.lock();
        try {
            idleDrivers.put(driver.id(), driver);
        } finally {
            lock.unlock();
        }
    }

    public void driverOffline(String driverId) {
        lock.lock();
        try {
            idleDrivers.remove(driverId);
        } finally {
            lock.unlock();
        }
    }

    public Optional<Assignment> assign(String orderId) {
        lock.lock();
        Order order = openOrders.remove(orderId);
        if (order == null) {
            lock.unlock();
            return Optional.empty();
        }
        Driver best = null;
        double bestKm = Double.MAX_VALUE;
        for (Driver driver : idleDrivers.values()) {
            double km = distanceKm(order.lat(), order.lon(), driver.lat(), driver.lon());
            if (km < bestKm) {
                best = driver;
                bestKm = km;
            }
        }
        if (best == null) {
            openOrders.put(orderId, order);
            lock.unlock();
            return Optional.empty();
        }
        idleDrivers.remove(best.id());
        lock.unlock();
        return Optional.of(new Assignment(orderId, best.id(), bestKm));
    }

    public Optional<BoardStats> stats() throws InterruptedException {
        if (!lock.tryLock(50, TimeUnit.MILLISECONDS)) {
            return Optional.empty();
        }
        try {
            Instant oldest = openOrders.values().stream()
                    .map(Order::placedAt)
                    .min(Instant::compareTo)
                    .orElse(Instant.now());
            return Optional.of(new BoardStats(
                    openOrders.size(), idleDrivers.size(), Duration.between(oldest, Instant.now())));
        } finally {
            lock.unlock();
        }
    }

    private static double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371.0 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
