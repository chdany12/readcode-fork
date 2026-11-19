package com.pingly.notify;

import java.io.IOException;
import java.util.List;
import java.util.Map;

interface PushGateway {
    /** Returns true when the provider accepted the message. */
    boolean push(String deviceToken, Map<String, String> payload) throws IOException;
}

interface DeliveryAudit {
    void record(String campaignId, int delivered, int failed);
}

record Campaign(String id, List<String> deviceTokens, Map<String, String> payload) {}

record BatchResult(String campaignId, int delivered, int failed) {}
