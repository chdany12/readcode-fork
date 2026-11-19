package flags

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"log"
	"sync/atomic"
	"time"
)

type Flag struct {
	Key        string   `json:"key"`
	Enabled    bool     `json:"enabled"`
	RolloutPct int      `json:"rollout_pct"`
	AllowList  []string `json:"allow_list"`
}

type snapshot struct {
	flags   map[string]Flag
	version int64
}

type Source interface {
	Fetch(ctx context.Context) ([]byte, error)
}

type Store struct {
	src      Source
	interval time.Duration
	current  atomic.Pointer[snapshot]
}

func NewStore(ctx context.Context, src Source, interval time.Duration) (*Store, error) {
	s := &Store{src: src, interval: interval}
	s.current.Store(&snapshot{flags: map[string]Flag{}})
	if err := s.refresh(ctx); err != nil {
		return nil, fmt.Errorf("initial flag load: %w", err)
	}
	go s.poll(ctx)
	return s, nil
}

func (s *Store) refresh(ctx context.Context) error {
	raw, err := s.src.Fetch(ctx)
	if err != nil {
		return err
	}
	var list []Flag
	if err := json.Unmarshal(raw, &list); err != nil {
		return fmt.Errorf("decode flags: %w", err)
	}
	next := make(map[string]Flag, len(list))
	for _, f := range list {
		next[f.Key] = f
	}
	prev := s.current.Load()
	s.current.Store(&snapshot{flags: next, version: prev.version + 1})
	return nil
}

func (s *Store) poll(ctx context.Context) {
	t := time.NewTicker(s.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := s.refresh(ctx); err != nil {
				log.Printf("flag refresh failed, still serving version %d: %v", s.current.Load().version, err)
			}
		}
	}
}

func (s *Store) IsEnabled(key, userID string, defaultValue bool) bool {
	f, ok := s.current.Load().flags[key]
	if !ok {
		return defaultValue
	}
	if !f.Enabled {
		return false
	}
	for _, id := range f.AllowList {
		if id == userID {
			return true
		}
	}
	if f.RolloutPct >= 100 {
		return true
	}
	if f.RolloutPct <= 0 {
		return false
	}
	return bucket(userID) < f.RolloutPct
}

func bucket(userID string) int {
	h := fnv.New32a()
	h.Write([]byte(userID))
	return int(h.Sum32() % 100)
}
