package com.haulway.routing;

import java.math.BigDecimal;

public record RouteQuote(String carrier, String lane, BigDecimal price) {}

interface Carrier {
    String name();

    BigDecimal basePrice(String lane);
}

interface FuelIndexClient {
    BigDecimal fetchLatest();
}
