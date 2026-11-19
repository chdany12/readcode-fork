package ledger

import (
	"errors"
	"fmt"
	"sync"
	"time"
)

var (
	ErrUnknownAccount    = errors.New("unknown account")
	ErrInsufficientFunds = errors.New("insufficient funds")
	ErrInvalidAmount     = errors.New("amount must be positive")
)

type Entry struct {
	AccountID string
	Delta     int64
	Reason    string
	At        time.Time
}

type Account struct {
	ID      string
	Balance int64
}

type Store struct {
	mu       sync.RWMutex
	accounts map[string]*Account
	journal  []Entry
}

func NewStore() *Store {
	return &Store{accounts: make(map[string]*Account)}
}

func (s *Store) record(id string, delta int64, reason string) {
	s.journal = append(s.journal, Entry{AccountID: id, Delta: delta, Reason: reason, At: time.Now()})
}

func (s *Store) Open(id string, initial int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.accounts[id]; exists {
		return fmt.Errorf("account %s already open", id)
	}
	s.accounts[id] = &Account{ID: id, Balance: initial}
	s.record(id, initial, "open")
	return nil
}

func (s *Store) Balance(id string) (int64, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	acct, ok := s.accounts[id]
	if !ok {
		return 0, ErrUnknownAccount
	}
	return acct.Balance, nil
}

func (s *Store) Deposit(id string, amount int64, reason string) error {
	if amount <= 0 {
		return ErrInvalidAmount
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	acct, ok := s.accounts[id]
	if !ok {
		return ErrUnknownAccount
	}
	acct.Balance += amount
	s.record(id, amount, reason)
	return nil
}

func (s *Store) Withdraw(id string, amount int64, reason string) error {
	if amount <= 0 {
		return ErrInvalidAmount
	}
	s.mu.RLock()
	acct, ok := s.accounts[id]
	if !ok {
		s.mu.RUnlock()
		return ErrUnknownAccount
	}
	balance := acct.Balance
	s.mu.RUnlock()

	if balance < amount {
		return ErrInsufficientFunds
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	acct.Balance -= amount
	s.record(id, -amount, reason)
	return nil
}

func (s *Store) Transfer(from, to string, amount int64) error {
	if amount <= 0 {
		return ErrInvalidAmount
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	src, ok := s.accounts[from]
	if !ok {
		return ErrUnknownAccount
	}
	dst, ok := s.accounts[to]
	if !ok {
		return ErrUnknownAccount
	}
	if src.Balance < amount {
		return ErrInsufficientFunds
	}
	src.Balance -= amount
	dst.Balance += amount
	s.record(from, -amount, "transfer out")
	s.record(to, amount, "transfer in")
	return nil
}

func (s *Store) Statement(id string) []Entry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Entry
	for _, e := range s.journal {
		if e.AccountID == id {
			out = append(out, e)
		}
	}
	return out
}
