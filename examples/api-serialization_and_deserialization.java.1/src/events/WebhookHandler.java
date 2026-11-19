package com.acme.billing.events;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.function.Consumer;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class WebhookHandler {

    private final ObjectMapper mapper = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .serializationInclusion(JsonInclude.Include.NON_NULL)
            .build();

    private final byte[] secret;
    private final Consumer<PaymentEvent> sink;

    public WebhookHandler(byte[] secret, Consumer<PaymentEvent> sink) {
        this.secret = secret.clone();
        this.sink = sink;
    }

    /** Returns the HTTP status to send back to the provider. */
    public int handle(byte[] rawBody, String signatureHeader) {
        if (signatureHeader == null || !signatureMatches(rawBody, signatureHeader)) {
            return 401;
        }
        PaymentEvent event;
        try {
            event = mapper.readValue(rawBody, PaymentEvent.class);
        } catch (IOException e) {
            return 400;
        }
        if (event instanceof PaymentEvent.Unknown) {
            return 200;
        }
        sink.accept(event);
        return 200;
    }

    public String toJson(PaymentEvent event) throws IOException {
        return mapper.writeValueAsString(event);
    }

    private boolean signatureMatches(byte[] body, String header) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            String expected = HexFormat.of().formatHex(mac.doFinal(body));
            return MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.UTF_8),
                    header.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC unavailable", e);
        }
    }
}
