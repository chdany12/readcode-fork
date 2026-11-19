package com.example.delivery.menu;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

public class MenuService {

    public record MenuItem(String itemId, String name, BigDecimal price, boolean available) {}

    public record Menu(String restaurantId, List<MenuItem> items) {}

    public interface MenuRepository {
        Menu loadMenu(String restaurantId);
        Optional<MenuItem> loadItem(String restaurantId, String itemId);
        void updatePrice(String restaurantId, String itemId, BigDecimal price);
        void updateAvailability(String restaurantId, String itemId, boolean available);
    }

    private final MenuRepository repository;

    private final Cache<String, Menu> menus = Caffeine.newBuilder()
            .maximumSize(2_000)
            .expireAfterWrite(Duration.ofMinutes(15))
            .build();

    private final Cache<String, MenuItem> items = Caffeine.newBuilder()
            .maximumSize(50_000)
            .expireAfterWrite(Duration.ofMinutes(15))
            .build();

    public MenuService(MenuRepository repository) {
        this.repository = repository;
    }

    public Menu getMenu(String restaurantId) {
        return menus.get(restaurantId, repository::loadMenu);
    }

    public Optional<MenuItem> getItem(String restaurantId, String itemId) {
        MenuItem cached = items.getIfPresent(itemKey(restaurantId, itemId));
        if (cached != null) {
            return Optional.of(cached);
        }
        Optional<MenuItem> loaded = repository.loadItem(restaurantId, itemId);
        loaded.ifPresent(item -> items.put(itemKey(restaurantId, itemId), item));
        return loaded;
    }

    public void changePrice(String restaurantId, String itemId, BigDecimal price) {
        if (price.signum() < 0) {
            throw new IllegalArgumentException("price must not be negative");
        }
        repository.updatePrice(restaurantId, itemId, price);
        items.invalidate(itemKey(restaurantId, itemId));
    }

    public void setAvailability(String restaurantId, String itemId, boolean available) {
        repository.updateAvailability(restaurantId, itemId, available);
        items.invalidate(itemKey(restaurantId, itemId));
        menus.invalidate(restaurantId);
    }

    private static String itemKey(String restaurantId, String itemId) {
        return restaurantId + ":" + itemId;
    }
}
