package com.example.dispatch.pricing;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Optional;

public class SurgeQuoteService {

    public record SurgeQuote(String zoneId, BigDecimal multiplier, Instant updatedAt) {}

    public interface SurgeRepository {
        Optional<SurgeQuote> find(String zoneId);
        void upsert(String zoneId, BigDecimal multiplier);
    }

    public interface TransactionRunner {
        void inTransaction(Runnable work);
    }

    private static final BigDecimal DEFAULT_MULTIPLIER = BigDecimal.ONE;

    private final SurgeRepository repository;
    private final TransactionRunner transactions;
    private final Cache<String, SurgeQuote> cache = Caffeine.newBuilder()
            .maximumSize(5_000)
            .expireAfterWrite(Duration.ofMinutes(5))
            .build();

    public SurgeQuoteService(SurgeRepository repository, TransactionRunner transactions) {
        this.repository = repository;
        this.transactions = transactions;
    }

    public SurgeQuote quoteFor(String zoneId) {
        return cache.get(zoneId, this::loadQuote);
    }

    public void updateSurge(String zoneId, BigDecimal multiplier) {
        if (multiplier.signum() <= 0) {
            throw new IllegalArgumentException("multiplier must be positive");
        }
        transactions.inTransaction(() -> {
            repository.upsert(zoneId, multiplier);
            cache.invalidate(zoneId);
        });
    }

    public void resetZones(Collection<String> zoneIds) {
        transactions.inTransaction(() -> {
            for (String zoneId : zoneIds) {
                repository.upsert(zoneId, DEFAULT_MULTIPLIER);
            }
        });
        cache.invalidateAll(zoneIds);
    }

    private SurgeQuote loadQuote(String zoneId) {
        return repository.find(zoneId)
                .orElseGet(() -> new SurgeQuote(zoneId, DEFAULT_MULTIPLIER, Instant.EPOCH));
    }
}
