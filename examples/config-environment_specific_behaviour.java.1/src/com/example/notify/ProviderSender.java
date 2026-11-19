package com.example.notify;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Objects;

public final class ProviderSender implements NotificationSender {
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    private final URI endpoint;
    private final String apiKey;

    public ProviderSender(String baseUrl, String apiKey) {
        Objects.requireNonNull(baseUrl, "baseUrl");
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("provider API key is required");
        }
        this.endpoint = URI.create(baseUrl + "/v1/messages");
        this.apiKey = apiKey;
    }

    @Override
    public void send(Notification n) throws IOException, InterruptedException {
        String json = "{\"to\":\"" + escape(n.recipient()) + "\",\"subject\":\"" + escape(n.subject())
                + "\",\"body\":\"" + escape(n.body()) + "\"}";
        HttpRequest request = HttpRequest.newBuilder(endpoint)
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        HttpResponse<Void> response = http.send(request, HttpResponse.BodyHandlers.discarding());
        if (response.statusCode() / 100 != 2) {
            throw new IOException("provider rejected notification: HTTP " + response.statusCode());
        }
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }
}
