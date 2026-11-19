package builds

import (
	"errors"
	"sort"
	"sync"
	"time"
)

var (
	ErrNotFound = errors.New("build not found")
	ErrConflict = errors.New("build is not in a cancellable state")
)

type Build struct {
	ID        string    `json:"id"`
	Project   string    `json:"project"`
	Ref       string    `json:"ref"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type Store struct {
	mu     sync.Mutex
	nextID int
	items  map[string]*Build
}

func NewStore() *Store {
	return &Store{items: make(map[string]*Build)}
}

func (s *Store) Create(project, ref string) Build {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nextID++
	b := &Build{
		ID:        formatID(s.nextID),
		Project:   project,
		Ref:       ref,
		Status:    "queued",
		CreatedAt: time.Now().UTC(),
	}
	s.items[b.ID] = b
	return *b
}

func (s *Store) Get(project, id string) (Build, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, ok := s.items[id]
	if !ok || b.Project != project {
		return Build{}, ErrNotFound
	}
	return *b, nil
}

func (s *Store) List(project, status string) []Build {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Build
	for _, b := range s.items {
		if b.Project == project && (status == "" || b.Status == status) {
			out = append(out, *b)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (s *Store) Cancel(project, id string) (Build, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, ok := s.items[id]
	if !ok || b.Project != project {
		return Build{}, ErrNotFound
	}
	switch b.Status {
	case "queued", "running":
		b.Status = "cancelling"
	case "cancelling":
	default:
		return Build{}, ErrConflict
	}
	return *b, nil
}

func (s *Store) Delete(project, id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if b, ok := s.items[id]; ok && b.Project == project {
		delete(s.items, id)
	}
}

func formatID(n int) string {
	const digits = "0123456789"
	if n == 0 {
		return "b0"
	}
	var buf []byte
	for ; n > 0; n /= 10 {
		buf = append([]byte{digits[n%10]}, buf...)
	}
	return "b" + string(buf)
}
