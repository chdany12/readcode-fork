package ticketview

import (
	"context"
	"time"
)

type Ticket struct {
	ID         string
	CustomerID string
	Subject    string
	Status     string
	OpenedAt   time.Time
}

type Customer struct {
	ID   string
	Name string
	Tier string
}

type SLAStatus struct {
	DueAt    time.Time
	Breached bool
}

type Message struct {
	Author string
	Body   string
	SentAt time.Time
}

type TicketStore interface {
	Get(ctx context.Context, id string) (Ticket, error)
}

type CustomerStore interface {
	Get(ctx context.Context, id string) (Customer, error)
}

type SLAStore interface {
	ForTicket(ctx context.Context, ticketID string) (SLAStatus, error)
}

type MessageStore interface {
	Recent(ctx context.Context, ticketID string, limit int) ([]Message, error)
}
