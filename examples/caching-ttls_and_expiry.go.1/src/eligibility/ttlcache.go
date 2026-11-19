package eligibility

import (
	"context"
	"sync"
	"time"
)

type entry[V any] struct {
	value     V
	expiresAt time.Time
}

type TTLCache[K comparable, V any] struct {
	mu    sync.Mutex
	now   func() time.Time
	ttl   time.Duration
	items map[K]entry[V]
}

func NewTTLCache[K comparable, V any](ttl time.Duration, now func() time.Time) *TTLCache[K, V] {
	return &TTLCache[K, V]{now: now, ttl: ttl, items: make(map[K]entry[V])}
}

func (c *TTLCache[K, V]) Get(key K) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	var zero V
	e, ok := c.items[key]
	if !ok {
		return zero, false
	}
	now := c.now()
	if !now.Before(e.expiresAt) {
		delete(c.items, key)
		return zero, false
	}
	e.expiresAt = now.Add(c.ttl)
	c.items[key] = e
	return e.value, true
}

func (c *TTLCache[K, V]) Set(key K, value V) {
	c.SetWithTTL(key, value, c.ttl)
}

func (c *TTLCache[K, V]) SetWithTTL(key K, value V, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = entry[V]{value: value, expiresAt: c.now().Add(ttl)}
}

func (c *TTLCache[K, V]) Delete(key K) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, key)
}

func (c *TTLCache[K, V]) Sweep() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	removed := 0
	for k, e := range c.items {
		if !now.Before(e.expiresAt) {
			delete(c.items, k)
			removed++
		}
	}
	return removed
}

func (c *TTLCache[K, V]) StartSweeper(ctx context.Context, every time.Duration) {
	go func() {
		t := time.NewTicker(every)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				c.Sweep()
			}
		}
	}()
}
