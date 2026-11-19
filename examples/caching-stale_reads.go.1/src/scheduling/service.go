package scheduling

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

var ErrSlotTaken = errors.New("slot already booked")

type Slot struct {
	ID         string        `json:"id"`
	ProviderID string        `json:"provider_id"`
	StartsAt   time.Time     `json:"starts_at"`
	Duration   time.Duration `json:"duration"`
}

type SlotReader interface {
	OpenSlots(ctx context.Context, providerID string, day time.Time) ([]Slot, error)
}

type SlotStore interface {
	SlotReader
	BookSlot(ctx context.Context, slotID, patientID string) error
	ReleaseSlot(ctx context.Context, slotID string) error
}

type Cache interface {
	Get(ctx context.Context, key string) ([]byte, bool, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

type Service struct {
	primary SlotStore
	replica SlotReader
	cache   Cache
	ttl     time.Duration
	log     *slog.Logger
}

func NewService(primary SlotStore, replica SlotReader, cache Cache, log *slog.Logger) *Service {
	return &Service{primary: primary, replica: replica, cache: cache, ttl: 2 * time.Minute, log: log}
}

func slotsKey(providerID string, day time.Time) string {
	return fmt.Sprintf("slots:%s:%s", providerID, day.UTC().Format("2006-01-02"))
}

func (s *Service) OpenSlots(ctx context.Context, providerID string, day time.Time) ([]Slot, error) {
	key := slotsKey(providerID, day)

	raw, ok, err := s.cache.Get(ctx, key)
	if err != nil {
		s.log.Warn("slot cache read failed", "key", key, "err", err)
	} else if ok {
		var cached []Slot
		if err := json.Unmarshal(raw, &cached); err == nil {
			return cached, nil
		}
		s.log.Warn("discarding undecodable slot cache entry", "key", key)
	}

	slots, err := s.replica.OpenSlots(ctx, providerID, day)
	if err != nil {
		return nil, fmt.Errorf("list open slots for %s: %w", providerID, err)
	}

	if encoded, err := json.Marshal(slots); err == nil {
		if err := s.cache.Set(ctx, key, encoded, s.ttl); err != nil {
			s.log.Warn("slot cache write failed", "key", key, "err", err)
		}
	}
	return slots, nil
}

func (s *Service) Book(ctx context.Context, slot Slot, patientID string) error {
	if err := s.primary.BookSlot(ctx, slot.ID, patientID); err != nil {
		if errors.Is(err, ErrSlotTaken) {
			return ErrSlotTaken
		}
		return fmt.Errorf("book slot %s: %w", slot.ID, err)
	}
	s.invalidate(ctx, slot)
	return nil
}

func (s *Service) Cancel(ctx context.Context, slot Slot) error {
	if err := s.primary.ReleaseSlot(ctx, slot.ID); err != nil {
		return fmt.Errorf("release slot %s: %w", slot.ID, err)
	}
	s.invalidate(ctx, slot)
	return nil
}

func (s *Service) SlotsForConfirmation(ctx context.Context, providerID string, day time.Time) ([]Slot, error) {
	return s.primary.OpenSlots(ctx, providerID, day)
}

func (s *Service) invalidate(ctx context.Context, slot Slot) {
	key := slotsKey(slot.ProviderID, slot.StartsAt)
	if err := s.cache.Delete(ctx, key); err != nil {
		s.log.Warn("slot cache invalidation failed", "key", key, "err", err)
	}
}
