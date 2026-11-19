package notify

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

var ErrNotFound = errors.New("preferences not found")

type Preferences struct {
	UserID     string `json:"user_id"`
	Email      bool   `json:"email"`
	Push       bool   `json:"push"`
	SMS        bool   `json:"sms"`
	QuietStart int    `json:"quiet_start"`
	QuietEnd   int    `json:"quiet_end"`
	Version    int64  `json:"version"`
}

type Cache interface {
	Get(ctx context.Context, key string) ([]byte, bool)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

type Repository interface {
	Load(ctx context.Context, userID string) (*Preferences, error)
	Save(ctx context.Context, p *Preferences) error
}

type Store struct {
	cache Cache
	repo  Repository
	ttl   time.Duration
}

func NewStore(cache Cache, repo Repository, ttl time.Duration) *Store {
	return &Store{cache: cache, repo: repo, ttl: ttl}
}

func cacheKey(userID string) string {
	return "notify:prefs:" + userID
}

func (s *Store) Get(ctx context.Context, userID string) (*Preferences, error) {
	key := cacheKey(userID)
	if raw, ok := s.cache.Get(ctx, key); ok {
		var p Preferences
		if err := json.Unmarshal(raw, &p); err == nil {
			return &p, nil
		}
		_ = s.cache.Delete(ctx, key)
	}

	p, err := s.repo.Load(ctx, userID)
	if err != nil {
		return nil, err
	}
	s.fill(ctx, key, p)
	return p, nil
}

func (s *Store) Update(ctx context.Context, p *Preferences) error {
	p.Version++
	s.fill(ctx, cacheKey(p.UserID), p)
	if err := s.repo.Save(ctx, p); err != nil {
		return fmt.Errorf("save preferences for %s: %w", p.UserID, err)
	}
	return nil
}

func (s *Store) SetChannel(ctx context.Context, userID, channel string, enabled bool) error {
	p, err := s.repo.Load(ctx, userID)
	if err != nil {
		return err
	}
	switch channel {
	case "email":
		p.Email = enabled
	case "push":
		p.Push = enabled
	case "sms":
		p.SMS = enabled
	default:
		return fmt.Errorf("unknown channel %q", channel)
	}
	p.Version++
	if err := s.repo.Save(ctx, p); err != nil {
		return fmt.Errorf("save preferences for %s: %w", userID, err)
	}
	if err := s.cache.Delete(ctx, cacheKey(userID)); err != nil {
		return fmt.Errorf("invalidate preferences for %s: %w", userID, err)
	}
	return nil
}

func (s *Store) fill(ctx context.Context, key string, p *Preferences) {
	raw, err := json.Marshal(p)
	if err != nil {
		return
	}
	_ = s.cache.Set(ctx, key, raw, s.ttl)
}
