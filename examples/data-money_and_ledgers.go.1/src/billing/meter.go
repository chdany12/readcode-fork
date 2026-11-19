package billing

import (
	"context"
	"errors"
	"fmt"
	"time"
)

const microsPerCent = 10_000

var ErrEmptyBatch = errors.New("batch has no messages")

type Batch struct {
	ID         string
	AccountID  string
	DeviceID   string
	Messages   int64
	ReceivedAt time.Time
}

type Tariff struct {
	// PriceMicros is the price of one message in millionths of a dollar.
	PriceMicros int64
}

type TariffSource interface {
	For(ctx context.Context, accountID string) (Tariff, error)
}

type Poster interface {
	Post(ctx context.Context, j Journal) error
}

type Meter struct {
	tariffs TariffSource
	ledger  Poster
}

func NewMeter(tariffs TariffSource, ledger Poster) *Meter {
	return &Meter{tariffs: tariffs, ledger: ledger}
}

// Bill charges an account for one batch of device messages. It is safe to call
// again with the same batch after a failure or a redelivery.
func (m *Meter) Bill(ctx context.Context, b Batch) error {
	if b.Messages <= 0 {
		return ErrEmptyBatch
	}
	tariff, err := m.tariffs.For(ctx, b.AccountID)
	if err != nil {
		return fmt.Errorf("tariff for account %s: %w", b.AccountID, err)
	}

	micros := b.Messages * tariff.PriceMicros
	charge := Money((micros + microsPerCent/2) / microsPerCent)
	if charge == 0 {
		return nil
	}

	err = m.ledger.Post(ctx, Journal{
		Key: "batch:" + b.ID,
		Entries: []Entry{
			{Account: "receivable:" + b.AccountID, Amount: charge},
			{Account: "revenue:telemetry", Amount: -charge},
		},
	})
	if errors.Is(err, ErrDuplicate) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("post batch %s: %w", b.ID, err)
	}
	return nil
}
