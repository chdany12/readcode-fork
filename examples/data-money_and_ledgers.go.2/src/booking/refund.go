package booking

import (
	"context"
	"errors"
	"fmt"
)

type Money int64

type Status string

const (
	StatusConfirmed Status = "confirmed"
	StatusCancelled Status = "cancelled"
)

type Traveler struct {
	ID string
}

type Booking struct {
	ID        string
	Status    Status
	Total     Money
	FeeBps    int64
	Travelers []Traveler
}

type Entry struct {
	Account string
	Amount  Money
}

type Journal struct {
	Key     string
	Entries []Entry
}

var (
	ErrNotCancelled = errors.New("booking is not cancelled")
	ErrNoTravelers  = errors.New("booking has no travelers")
	ErrDuplicate    = errors.New("journal already posted")
)

type Bookings interface {
	Get(ctx context.Context, id string) (Booking, error)
}

type Ledger interface {
	Post(ctx context.Context, j Journal) error
}

type RefundService struct {
	bookings Bookings
	ledger   Ledger
}

func NewRefundService(b Bookings, l Ledger) *RefundService {
	return &RefundService{bookings: b, ledger: l}
}

func (s *RefundService) Refund(ctx context.Context, bookingID string) error {
	b, err := s.bookings.Get(ctx, bookingID)
	if err != nil {
		return fmt.Errorf("load booking %s: %w", bookingID, err)
	}
	if b.Status != StatusCancelled {
		return ErrNotCancelled
	}
	if len(b.Travelers) == 0 {
		return ErrNoTravelers
	}

	fee := b.Total * Money(b.FeeBps) / 10_000
	refundable := b.Total - fee
	shares := splitEven(refundable, len(b.Travelers))

	entries := make([]Entry, 0, len(shares)+2)
	var paidOut Money
	for i, share := range shares {
		entries = append(entries, Entry{
			Account: "refund_payable:" + b.Travelers[i].ID,
			Amount:  -share,
		})
		paidOut += share
	}
	if fee > 0 {
		entries = append(entries, Entry{Account: "revenue:cancellation_fees", Amount: -fee})
	}
	entries = append(entries, Entry{Account: "liability:booking:" + b.ID, Amount: paidOut + fee})

	err = s.ledger.Post(ctx, Journal{Key: "refund:" + b.ID, Entries: entries})
	if errors.Is(err, ErrDuplicate) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("post refund for booking %s: %w", b.ID, err)
	}
	return nil
}
