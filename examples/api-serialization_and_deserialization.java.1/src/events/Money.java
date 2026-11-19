package com.acme.billing.events;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.Currency;

public record Money(BigDecimal amount, String currency) {

    @JsonCreator
    public static Money parse(
            @JsonProperty(value = "amount", required = true) String amount,
            @JsonProperty(value = "currency", required = true) String currency) {
        Currency c = Currency.getInstance(currency);
        BigDecimal value = new BigDecimal(amount);
        if (value.scale() > c.getDefaultFractionDigits()) {
            throw new IllegalArgumentException(
                    "too many decimal places for " + currency + ": " + amount);
        }
        return new Money(value.setScale(c.getDefaultFractionDigits()), c.getCurrencyCode());
    }

    @JsonProperty("amount")
    String amountText() {
        return amount.toPlainString();
    }
}
