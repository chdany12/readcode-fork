package orders

import (
	"sync"
	"time"
)

type Record struct {
	Status    int
	Body      []byte
	CreatedAt time.Time
}

type KeyStore struct {
	mu      sync.Mutex
	ttl     time.Duration
	records map[string]Record
}

func NewKeyStore(ttl time.Duration) *KeyStore {
	return &KeyStore{ttl: ttl, records: make(map[string]Record)}
}

func (s *KeyStore) Get(key string) (Record, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rec, ok := s.records[key]
	if !ok {
		return Record{}, false
	}
	if time.Since(rec.CreatedAt) > s.ttl {
		delete(s.records, key)
		return Record{}, false
	}
	return rec, true
}

func (s *KeyStore) Put(key string, rec Record) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rec.CreatedAt = time.Now()
	s.records[key] = rec
}
