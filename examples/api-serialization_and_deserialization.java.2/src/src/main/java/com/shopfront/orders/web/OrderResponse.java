package com.shopfront.orders.web;

import com.shopfront.orders.domain.Order;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record OrderResponse(String orderId, String status, String currency, double total,
                            Instant placedAt, List<LineView> lines) {

    public record LineView(String sku, int quantity, BigDecimal unitPrice) {
    }

    public static OrderResponse from(Order order) {
        double total = order.lines().stream().mapToDouble(l -> l.unitPrice().doubleValue() * l.quantity()).sum();
        List<LineView> views = order.lines().stream()
                .map(l -> new LineView(l.sku(), l.quantity(), l.unitPrice()))
                .toList();
        return new OrderResponse(order.orderId(), order.status().name().toLowerCase(),
                order.currency(), total, order.placedAt(), views);
    }
}
