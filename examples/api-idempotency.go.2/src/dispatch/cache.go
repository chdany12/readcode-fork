package dispatch

import (
	"sync"
	"time"
)

type entry struct {
	response []byte
	status   int
	expires  time.Time
}

type Cache struct {
	mu      sync.RWMutex
	entries map[string]entry
}

func NewCache() *Cache {
	return &Cache{entries: make(map[string]entry)}
}

func (c *Cache) Lookup(k string) ([]byte, int, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.entries[k]
	if !ok || time.Now().After(e.expires) {
		return nil, 0, false
	}
	return e.response, e.status, true
}

func (c *Cache) Save(k string, status int, resp []byte, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[k] = entry{response: resp, status: status, expires: time.Now().Add(ttl)}
}
