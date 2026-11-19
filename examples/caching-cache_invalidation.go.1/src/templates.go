package notify

import (
	"context"
	"sync"
	"time"
)

type Template struct {
	ID      string
	Subject string
	Body    string
	Rev     int
}

type Loader interface {
	LoadTemplate(ctx context.Context, id string) (*Template, error)
}

type entry struct {
	tmpl    *Template
	expires time.Time
}

type TemplateCache struct {
	mu      sync.Mutex
	entries map[string]entry
	gen     map[string]uint64
	epoch   uint64
	loader  Loader
	ttl     time.Duration
	now     func() time.Time
}

func NewTemplateCache(loader Loader, ttl time.Duration) *TemplateCache {
	return &TemplateCache{
		entries: make(map[string]entry),
		gen:     make(map[string]uint64),
		loader:  loader,
		ttl:     ttl,
		now:     time.Now,
	}
}

func (c *TemplateCache) Get(ctx context.Context, id string) (*Template, error) {
	c.mu.Lock()
	if e, ok := c.entries[id]; ok && c.now().Before(e.expires) {
		c.mu.Unlock()
		return e.tmpl, nil
	}
	gen, epoch := c.gen[id], c.epoch
	c.mu.Unlock()

	t, err := c.loader.LoadTemplate(ctx, id)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	if c.gen[id] == gen && c.epoch == epoch {
		c.entries[id] = entry{tmpl: t, expires: c.now().Add(c.ttl)}
	}
	return t, nil
}

func (c *TemplateCache) Invalidate(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, id)
	c.gen[id]++
}

func (c *TemplateCache) InvalidateAll() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]entry)
	c.epoch++
}
