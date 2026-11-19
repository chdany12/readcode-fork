package com.acme.billing.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.time.Instant;

@JsonTypeInfo(
        use = JsonTypeInfo.Id.NAME,
        property = "type",
        defaultImpl = PaymentEvent.Unknown.class)
@JsonSubTypes({
    @JsonSubTypes.Type(value = PaymentEvent.Succeeded.class, name = "payment.succeeded"),
    @JsonSubTypes.Type(value = PaymentEvent.Refunded.class, name = "refund.created")
})
public sealed interface PaymentEvent {

    String id();

    Instant occurredAt();

    record Succeeded(String id, Instant occurredAt, String paymentId, Money amount)
            implements PaymentEvent {}

    record Refunded(String id, Instant occurredAt, String paymentId, Money amount, String reason)
            implements PaymentEvent {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Unknown(String id, Instant occurredAt) implements PaymentEvent {}
}
