package billing

import (
	"context"
	"errors"
	"fmt"
)

// Money is an amount in cents. Positive values are debits, negative values are credits.
type Money int64

type Entry struct {
	Account string
	Amount  Money
}

type Journal struct {
	Key     string
	Entries []Entry
}

var (
	ErrUnbalanced = errors.New("journal entries do not sum to zero")
	ErrDuplicate  = errors.New("journal already posted")
)

type JournalStore interface {
	// Insert writes the journal and all its entries atomically. It returns
	// ErrDuplicate if a journal with the same key exists.
	Insert(ctx context.Context, j Journal) error
}

type Ledger struct {
	store JournalStore
}

func NewLedger(store JournalStore) *Ledger {
	return &Ledger{store: store}
}

func (l *Ledger) Post(ctx context.Context, j Journal) error {
	if j.Key == "" || len(j.Entries) < 2 {
		return fmt.Errorf("invalid journal %q", j.Key)
	}
	var sum Money
	for _, e := range j.Entries {
		sum += e.Amount
	}
	if sum != 0 {
		return fmt.Errorf("%w: key=%s sum=%d", ErrUnbalanced, j.Key, sum)
	}
	return l.store.Insert(ctx, j)
}
