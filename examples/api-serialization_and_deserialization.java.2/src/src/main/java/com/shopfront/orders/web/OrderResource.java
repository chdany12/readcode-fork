package com.shopfront.orders.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopfront.orders.domain.Order;
import com.shopfront.orders.domain.OrderService;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public class OrderResource {

    public record HttpResult(int status, byte[] body) {
    }

    private final ObjectMapper mapper = JsonConfig.mapper();
    private final OrderService service;

    public OrderResource(OrderService service) {
        this.service = service;
    }

    public HttpResult placeOrder(byte[] body) {
        PlaceOrderRequest request;
        try {
            request = mapper.readValue(body, PlaceOrderRequest.class);
        } catch (JsonProcessingException e) {
            return error(400, "malformed_body");
        }
        if (request.customerId() == null || request.currency() == null) {
            return error(422, "missing_fields");
        }
        if (request.lines() == null || request.lines().isEmpty()) {
            return error(422, "no_lines");
        }
        for (PlaceOrderRequest.Line line : request.lines()) {
            if (line.sku() == null || line.quantity() <= 0 || line.unitPrice() == null) {
                return error(422, "invalid_line");
            }
        }
        Order order = service.place(request.customerId(), request.currency(), request.lines());
        try {
            return new HttpResult(201, mapper.writeValueAsBytes(OrderResponse.from(order)));
        } catch (JsonProcessingException e) {
            return error(500, "serialization_failed");
        }
    }

    private HttpResult error(int status, String code) {
        try {
            return new HttpResult(status, mapper.writeValueAsBytes(Map.of("error", code)));
        } catch (JsonProcessingException e) {
            return new HttpResult(status, code.getBytes(StandardCharsets.UTF_8));
        }
    }
}
