package notify

import "context"

type TemplateEvent struct {
	TemplateID string
	Reset      bool
}

func (c *TemplateCache) Listen(ctx context.Context, events <-chan TemplateEvent) {
	for {
		select {
		case <-ctx.Done():
			return
		case ev, ok := <-events:
			if !ok {
				return
			}
			if ev.Reset {
				c.InvalidateAll()
				continue
			}
			c.Invalidate(ev.TemplateID)
		}
	}
}

type Renderer struct {
	cache *TemplateCache
}

func NewRenderer(cache *TemplateCache) *Renderer {
	return &Renderer{cache: cache}
}

func (r *Renderer) Render(ctx context.Context, id string, expand func(string) string) (subject, body string, err error) {
	t, err := r.cache.Get(ctx, id)
	if err != nil {
		return "", "", err
	}
	return expand(t.Subject), expand(t.Body), nil
}
