package ticketview

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Summary struct {
	Ticket          Ticket
	Customer        Customer
	SLA             SLAStatus
	RecentMessages  []Message
	MessagesPartial bool
}

type Loader struct {
	tickets         TicketStore
	customers       CustomerStore
	sla             SLAStore
	messages        MessageStore
	messageTimeout  time.Duration
	maxParallelLoad int
}

func NewLoader(t TicketStore, c CustomerStore, s SLAStore, m MessageStore) *Loader {
	return &Loader{
		tickets: t, customers: c, sla: s, messages: m,
		messageTimeout:  300 * time.Millisecond,
		maxParallelLoad: 8,
	}
}

func (l *Loader) Load(parent context.Context, ticketID string) (*Summary, error) {
	ctx, cancel := context.WithCancel(parent)
	defer cancel()

	ticket, err := l.tickets.Get(ctx, ticketID)
	if err != nil {
		return nil, fmt.Errorf("load ticket %s: %w", ticketID, err)
	}

	var (
		sum      = &Summary{Ticket: ticket}
		wg       sync.WaitGroup
		failOnce sync.Once
		firstErr error
	)
	fail := func(err error) {
		failOnce.Do(func() {
			firstErr = err
			cancel()
		})
	}

	wg.Add(3)
	go func() {
		defer wg.Done()
		c, err := l.customers.Get(ctx, ticket.CustomerID)
		if err != nil {
			fail(fmt.Errorf("load customer %s: %w", ticket.CustomerID, err))
			return
		}
		sum.Customer = c
	}()
	go func() {
		defer wg.Done()
		s, err := l.sla.ForTicket(ctx, ticketID)
		if err != nil {
			fail(fmt.Errorf("load sla for %s: %w", ticketID, err))
			return
		}
		sum.SLA = s
	}()
	go func() {
		defer wg.Done()
		msgCtx, msgCancel := context.WithTimeout(ctx, l.messageTimeout)
		defer msgCancel()
		msgs, err := l.messages.Recent(msgCtx, ticketID, 20)
		if err != nil {
			sum.MessagesPartial = true
			return
		}
		sum.RecentMessages = msgs
	}()
	wg.Wait()

	if firstErr != nil {
		return nil, firstErr
	}
	if err := parent.Err(); err != nil {
		return nil, fmt.Errorf("load ticket %s: %w", ticketID, err)
	}
	return sum, nil
}

func (l *Loader) LoadMany(ctx context.Context, ids []string) ([]*Summary, []error) {
	results := make([]*Summary, len(ids))
	errs := make([]error, len(ids))
	sem := make(chan struct{}, l.maxParallelLoad)

	var wg sync.WaitGroup
	for i, id := range ids {
		select {
		case sem <- struct{}{}:
		case <-ctx.Done():
			errs[i] = ctx.Err()
			continue
		}
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			defer func() { <-sem }()
			results[i], errs[i] = l.Load(ctx, id)
		}(i, id)
	}
	wg.Wait()
	return results, errs
}
