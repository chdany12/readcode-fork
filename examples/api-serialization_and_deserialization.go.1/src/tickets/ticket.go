package tickets

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type Status int

const (
	StatusOpen Status = iota + 1
	StatusPending
	StatusSolved
)

var statusNames = map[Status]string{
	StatusOpen:    "open",
	StatusPending: "pending",
	StatusSolved:  "solved",
}

var statusByName = map[string]Status{
	"open":    StatusOpen,
	"pending": StatusPending,
	"solved":  StatusSolved,
}

func (s Status) MarshalJSON() ([]byte, error) {
	name, ok := statusNames[s]
	if !ok {
		return nil, fmt.Errorf("tickets: unknown status %d", int(s))
	}
	return json.Marshal(name)
}

func (s *Status) UnmarshalJSON(data []byte) error {
	var name string
	if err := json.Unmarshal(data, &name); err != nil {
		return fmt.Errorf("tickets: status must be a string: %w", err)
	}
	v, ok := statusByName[strings.ToLower(name)]
	if !ok {
		return fmt.Errorf("tickets: unknown status %q", name)
	}
	*s = v
	return nil
}

type Ticket struct {
	ID         string     `json:"id"`
	Subject    string     `json:"subject"`
	Status     Status     `json:"status"`
	AssigneeID *string    `json:"assignee_id"`
	DueAt      *time.Time `json:"due_at,omitempty"`
	Tags       []string   `json:"tags"`
	CreatedAt  time.Time  `json:"created_at"`
}

func (t Ticket) MarshalJSON() ([]byte, error) {
	type plain Ticket
	out := plain(t)
	if out.Tags == nil {
		out.Tags = []string{}
	}
	return json.Marshal(out)
}

type NewTicket struct {
	Subject string     `json:"subject"`
	Tags    []string   `json:"tags"`
	DueAt   *time.Time `json:"due_at"`
}

type TicketPatch struct {
	Subject *string    `json:"subject"`
	Status  *Status    `json:"status"`
	DueAt   *time.Time `json:"due_at"`
}
