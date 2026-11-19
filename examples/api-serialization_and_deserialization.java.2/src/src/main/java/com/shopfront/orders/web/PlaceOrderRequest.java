package com.shopfront.orders.web;

import java.math.BigDecimal;
import java.util.List;

public record PlaceOrderRequest(String customerId, String currency, List<Line> lines) {

    public record Line(String sku, int quantity, BigDecimal unitPrice) {
    }
}
