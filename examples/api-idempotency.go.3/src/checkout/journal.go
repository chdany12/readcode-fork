package checkout

import (
	"errors"
	"sync"
)

var ErrInFlight = errors.New("request with this key is still processing")

type Saved struct {
	Status int
	Body   []byte
}

type Journal struct {
	mu   sync.Mutex
	done map[string]Saved
	busy map[string]struct{}
}

func NewJournal() *Journal {
	return &Journal{done: map[string]Saved{}, busy: map[string]struct{}{}}
}

// Begin returns a saved response if the key already finished, ErrInFlight if
// another request holds it, or nil if the caller now owns the key.
func (j *Journal) Begin(key string) (*Saved, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if s, ok := j.done[key]; ok {
		return &s, nil
	}
	if _, ok := j.busy[key]; ok {
		return nil, ErrInFlight
	}
	j.busy[key] = struct{}{}
	return nil, nil
}

func (j *Journal) Complete(key string, s Saved) {
	j.mu.Lock()
	defer j.mu.Unlock()
	delete(j.busy, key)
	j.done[key] = s
}
