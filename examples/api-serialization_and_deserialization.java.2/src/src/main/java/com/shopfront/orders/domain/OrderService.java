package com.shopfront.orders.domain;

import com.shopfront.orders.web.PlaceOrderRequest;
import java.util.List;

public interface OrderService {

    Order place(String customerId, String currency, List<PlaceOrderRequest.Line> lines);
}
