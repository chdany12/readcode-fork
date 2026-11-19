package com.shopfront.orders.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record Order(String orderId, String customerId, String currency, Status status,
                    Instant placedAt, List<OrderLine> lines) {

    public enum Status { PENDING, RESERVED, SHIPPED, CANCELLED }

    public record OrderLine(String sku, int quantity, BigDecimal unitPrice) {
    }
}
